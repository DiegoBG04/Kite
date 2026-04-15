FROM python:3.11-slim

WORKDIR /app

# Install dependencies first — this layer is cached until requirements.txt changes
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the rest of the code — changes here don't bust the deps cache
COPY . .

CMD uvicorn backend.main:app --host 0.0.0.0 --port $PORT
