FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv/app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --create-home appuser
COPY . .
USER appuser
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && python scripts/seed_demo_data.py && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
