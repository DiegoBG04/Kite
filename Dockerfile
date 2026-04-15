# syntax=docker/dockerfile:1
FROM python:3.11-slim

WORKDIR /app

# Install dependencies with BuildKit pip cache — persists across builds
# even when the base image changes
COPY backend/requirements.txt backend/requirements.txt
RUN --mount=type=cache,id=pip-cache,target=/root/.cache/pip \
    pip install -r backend/requirements.txt

# Copy the rest of the code
COPY . .

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port $PORT"]
