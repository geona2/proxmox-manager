FROM python:3.12-slim AS base

WORKDIR /app

# Install system dependencies if any are needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy dependencies list and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY app/ ./app/

# Create directory for persistent data
RUN mkdir -p data

EXPOSE 8000

# Development stage (seeds mock data, enables reload)
FROM base AS development
ENV APP_ENV=development
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# Production stage (no mock data, normal run)
FROM base AS production
ENV APP_ENV=production
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
