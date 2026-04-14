"""
risk_flags.py — Risk Language Detector

Purpose: Compares the frequency of risk-related terms in a company's most
recent SEC filing against the previous filing. Flags any terms that appear
significantly more often — a potential signal of emerging risk that warrants
closer attention.

Example: "regulatory risk" appearing 11x in FY2024 vs 4x in FY2023 → flagged.

The count of active flags feeds the MetricsRow.jsx "Risk Flags" metric block.

TODO (Step 5+): Implement detect_risk_flags().
"""


# Terms to monitor across filings.
# This list can be expanded as we learn which language correlates with real risk.
RISK_TERMS = [
    "regulatory risk",
    "litigation",
    "impairment",
    "going concern",
    "material weakness",
    "cybersecurity",
    "supply chain disruption",
    "tariff",
    "sanctions",
]

# A term is flagged if its count in the new filing is this many times higher
# than in the previous filing.
FLAG_THRESHOLD_MULTIPLIER = 2.0


def detect_risk_flags(ticker: str, current_year: str, previous_year: str) -> list[dict]:
    """
    Compare risk term frequencies between two fiscal years for a ticker.

    Args:
        ticker:        Stock ticker e.g. "AAPL"
        current_year:  Fiscal year of the newer filing e.g. "2024"
        previous_year: Fiscal year of the older filing e.g. "2023"

    Returns:
        List of flag dicts for terms that spiked significantly:
            {
              "term": "regulatory risk",
              "current_count": 11,
              "previous_count": 4,
              "source_label": "10-K FY2024",
              "source_url": "https://..."
            }
    """
    raise NotImplementedError("risk_flags.detect_risk_flags() — not yet implemented (Step 5+)")
