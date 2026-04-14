"""
edgar.py — SEC EDGAR Filing Downloader and Text Extractor

Purpose: Downloads 10-K and 10-Q filings for a given ticker symbol using
the sec-edgar-downloader library, strips all HTML/XML markup from the
raw filing documents, and returns clean plain text ready to be handed
off to the chunker pipeline.

This is Stage 1 of the Kite ingestion pipeline:
    edgar.py → chunker.py → embedder.py → store.py

The main function to call from outside this module is download_and_extract().
"""

import os
import json
import logging
from pathlib import Path
from typing import Optional

from bs4 import BeautifulSoup
from sec_edgar_downloader import Downloader

logger = logging.getLogger(__name__)

# Base URL for the EDGAR document archive — all filing URLs start here
EDGAR_ARCHIVE_BASE = "https://www.sec.gov/Archives/edgar/data"

# Base URL for EDGAR company search — used as fallback when we can't build exact URL
EDGAR_SEARCH_BASE = "https://www.sec.gov/cgi-bin/browse-edgar"

# Directory where sec-edgar-downloader saves files (relative to working dir)
DEFAULT_SAVE_DIR = Path("sec-edgar-filings")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _make_downloader() -> Downloader:
    """
    Create a Downloader instance using the EDGAR_USER_AGENT env variable.

    EDGAR requires identifying your app. The env var format is:
        "AppName/version your@email.com"
    Example: "Kite/1.0 yourname@gmail.com"
    """
    user_agent = os.environ.get("EDGAR_USER_AGENT", "Kite/1.0 kite@example.com")
    parts = user_agent.strip().split()

    # Extract email (last token) and company name (first token before the slash)
    email = parts[-1] if len(parts) >= 2 else "kite@example.com"
    company = parts[0].split("/")[0] if parts else "Kite"

    return Downloader(company_name=company, email_address=email)


def _extract_text_from_html(raw: str) -> str:
    """
    Strip all HTML/XML tags from a filing document and return plain text.

    Uses BeautifulSoup with the lxml parser for speed and robustness.
    Collapses excessive blank lines to keep the text clean.
    """
    soup = BeautifulSoup(raw, "lxml")

    # Drop non-content tags entirely so their text doesn't bleed into the output
    for tag in soup(["script", "style", "meta", "link", "head"]):
        tag.decompose()

    # get_text with newline separator preserves paragraph structure better than a space
    raw_text = soup.get_text(separator="\n")

    # Strip each line and drop empty ones, then rejoin
    lines = [line.strip() for line in raw_text.splitlines()]
    cleaned = "\n".join(line for line in lines if line)

    return cleaned


def _find_primary_document(filing_dir: Path) -> Optional[Path]:
    """
    Locate the main filing document inside a downloaded EDGAR directory.

    sec-edgar-downloader v5 saves each filing into its own subdirectory
    named by accession number. This function finds the largest .htm/.html
    file (which is almost always the full filing text), falling back to
    full-submission.txt if no HTML file exists.
    """
    # Some versions write an index.json with the primary document named explicitly
    index_path = filing_dir / "index.json"
    if index_path.exists():
        try:
            with open(index_path) as f:
                index = json.load(f)
            # "documents" list — first entry is usually the primary document
            for doc in index.get("documents", []):
                filename = doc.get("filename", "")
                candidate = filing_dir / filename
                if candidate.exists() and candidate.suffix.lower() in (".htm", ".html", ".txt"):
                    return candidate
        except Exception:
            pass  # If index.json is malformed, fall through to glob approach

    # Fallback: pick the largest HTML file (the full 10-K/10-Q text)
    html_files = list(filing_dir.glob("*.htm*"))
    if html_files:
        return max(html_files, key=lambda p: p.stat().st_size)

    # Last resort: the raw SGML submission text
    full_txt = filing_dir / "full-submission.txt"
    if full_txt.exists():
        return full_txt

    return None


def _get_fiscal_year(filing_dir: Path) -> str:
    """
    Extract the 4-digit fiscal year from the filing's index.json.
    Falls back to the current year if the metadata isn't available.
    """
    index_path = filing_dir / "index.json"
    if index_path.exists():
        try:
            with open(index_path) as f:
                index = json.load(f)
            # period_of_report is in "YYYY-MM-DD" format
            period = index.get("period_of_report", "")
            if len(period) >= 4:
                return period[:4]
        except Exception:
            pass

    # Fallback: current year
    from datetime import datetime
    return str(datetime.now().year)


def _build_edgar_url(cik: str, accession_number: str, filename: str) -> str:
    """
    Construct the direct EDGAR archive URL for a specific filing document.

    Example result:
        https://www.sec.gov/Archives/edgar/data/320193/000032019324000123/aapl-20240930.htm

    Args:
        cik: The company's SEC CIK number (no leading zeros required)
        accession_number: Format like "0000320193-24-000123" (dashes included)
        filename: The document filename (e.g. "aapl-20240930.htm")
    """
    # EDGAR archive URLs use the accession number with dashes removed
    acc_clean = accession_number.replace("-", "")
    return f"{EDGAR_ARCHIVE_BASE}/{cik}/{acc_clean}/{filename}"


def _get_cik_from_dir(filing_dir: Path) -> Optional[str]:
    """
    Try to read the CIK from a cik.txt file saved by sec-edgar-downloader,
    or extract it from the accession number directory structure.
    """
    cik_file = filing_dir / "cik.txt"
    if cik_file.exists():
        return cik_file.read_text().strip()

    # Try reading from index.json
    index_path = filing_dir / "index.json"
    if index_path.exists():
        try:
            with open(index_path) as f:
                index = json.load(f)
            return str(index.get("cik", "")).strip() or None
        except Exception:
            pass

    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def download_and_extract(
    ticker: str,
    filing_types: list[str] | None = None,
    limit_per_type: int = 2,
    save_dir: Path | None = None,
) -> list[dict]:
    """
    Download SEC filings for a ticker and return extracted plain text documents.

    This is the main entry point for the EDGAR ingestion stage.

    Args:
        ticker:          Stock ticker symbol (e.g. "AAPL"). Case-insensitive.
        filing_types:    List of SEC form types to download. Defaults to ["10-K", "10-Q"].
        limit_per_type:  Max number of filings to download per type (most recent first).
        save_dir:        Where to save downloaded files. Defaults to ./sec-edgar-filings.

    Returns:
        List of document dicts. Each dict has:
            - text (str):            Extracted plain text of the filing
            - ticker (str):          Uppercase ticker symbol
            - doc_type (str):        Filing type e.g. "10-K"
            - fiscal_year (str):     4-digit year e.g. "2024"
            - source_label (str):    Human-readable label e.g. "10-K FY2024"
            - source_url (str):      Direct EDGAR link (or search URL as fallback)
            - accession_number (str): Raw accession number from EDGAR

    Example:
        docs = download_and_extract("AAPL", filing_types=["10-K"], limit_per_type=1)
        # Pass the result directly to chunker.chunk_documents(docs)
    """
    if filing_types is None:
        filing_types = ["10-K", "10-Q"]

    ticker = ticker.upper()
    base_dir = save_dir or DEFAULT_SAVE_DIR

    dl = _make_downloader()
    results = []

    for filing_type in filing_types:
        logger.info(f"[EDGAR] Downloading {ticker} {filing_type} (limit={limit_per_type})")

        try:
            # sec-edgar-downloader saves files to:
            #   {base_dir}/{ticker}/{filing_type}/{accession-number}/
            dl.get(filing_type, ticker, limit=limit_per_type)
        except Exception as exc:
            logger.error(f"[EDGAR] Download failed for {ticker} {filing_type}: {exc}")
            continue

        filing_type_dir = base_dir / ticker / filing_type
        if not filing_type_dir.exists():
            logger.warning(f"[EDGAR] No directory found at {filing_type_dir} — skipping")
            continue

        # Each subdirectory is one accession (one filing)
        accession_dirs = sorted(
            [d for d in filing_type_dir.iterdir() if d.is_dir()],
            reverse=True  # Most recent first (directories are named by date-based accession)
        )

        for filing_dir in accession_dirs:
            accession_number = filing_dir.name
            logger.info(f"[EDGAR] Processing {ticker} {filing_type} accession: {accession_number}")

            # Find and read the primary document
            primary_doc = _find_primary_document(filing_dir)
            if primary_doc is None:
                logger.warning(f"[EDGAR] No readable document in {filing_dir} — skipping")
                continue

            try:
                raw_content = primary_doc.read_text(encoding="utf-8", errors="ignore")
            except Exception as exc:
                logger.error(f"[EDGAR] Could not read {primary_doc}: {exc}")
                continue

            # Extract plain text
            text = _extract_text_from_html(raw_content)

            if len(text.strip()) < 200:
                # Very short text usually means we only got boilerplate, skip it
                logger.warning(
                    f"[EDGAR] Extracted text too short ({len(text)} chars) from "
                    f"{primary_doc.name} — skipping"
                )
                continue

            # Build metadata
            fiscal_year = _get_fiscal_year(filing_dir)
            source_label = f"{filing_type} FY{fiscal_year}"

            # Try to build the exact EDGAR archive URL, fall back to search URL
            source_url = (
                f"{EDGAR_SEARCH_BASE}?action=getcompany&CIK={ticker}"
                f"&type={filing_type}&dateb=&owner=include&count=10"
            )
            cik = _get_cik_from_dir(filing_dir)
            if cik:
                source_url = _build_edgar_url(cik, accession_number, primary_doc.name)

            results.append({
                "text": text,
                "ticker": ticker,
                "doc_type": filing_type,
                "fiscal_year": fiscal_year,
                "source_label": source_label,
                "source_url": source_url,
                "accession_number": accession_number,
            })

            logger.info(
                f"[EDGAR] ✓ {ticker} {source_label} — "
                f"{len(text):,} chars extracted from {primary_doc.name}"
            )

    logger.info(f"[EDGAR] Done. {len(results)} document(s) extracted for {ticker}")
    return results
