FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl jq cron tmux git \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir clawteam

WORKDIR /app
COPY advisor.py crontab.txt ./

# ตั้ง cron ทุก 1 ชม.
RUN crontab crontab.txt

# Health check script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
