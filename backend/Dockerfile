FROM python:3.11-slim

WORKDIR /app

# gcc не нужен: psycopg2-binary. curl — healthcheck в compose.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src ./src
COPY backend/alembic ./backend/alembic
COPY backend/alembic.ini ./backend/alembic.ini

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

WORKDIR /app/backend

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn src.backend.main:app --host 0.0.0.0 --port 8000"]
