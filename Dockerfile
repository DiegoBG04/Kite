FROM python:3.11-slim

WORKDIR /app

# ── Layer 1: Heavy ML packages ───────────────────────────────────────────────
# sentence-transformers pulls in torch (~1.5 GB).
# This layer is cached as long as requirements-ml.txt doesn't change,
# so code-only pushes skip this entirely and deploy in ~1 min.
COPY backend/requirements-ml.txt backend/requirements-ml.txt
RUN pip install -r backend/requirements-ml.txt

# ── Layer 2: API packages ────────────────────────────────────────────────────
# Lightweight — rebuilds only when you add/change a dependency.
COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt

# ── Layer 3: Application code ────────────────────────────────────────────────
# Rebuilds on every push. Fast since no packages are installed here.
COPY . .

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port $PORT"]
