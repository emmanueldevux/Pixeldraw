FROM mcr.microsoft.com/playwright/python:v1.49.0-jammy
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV FLOW_HEADLESS=1 ACCOUNTS_DIR=/data/accounts FILES_DIR=/data/files
# Railway: attach a volume at /data so logins and pool state survive redeploys
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
