# ASTERION — Worker + D1 dijalankan lewat runtime lokal wrangler (workerd)
# Debian 13 (trixie) dipakai karena paket OS di Debian 12 masih membawa
# temuan keamanan high/critical yang belum ada perbaikannya.
FROM node:24-trixie-slim

ENV NODE_ENV=production \
    PORT=3000 \
    CI=1 \
    WRANGLER_SEND_METRICS=false \
    WRANGLER_SEND_METRICS_TIMEOUT=0

WORKDIR /app

# patch paket OS pada rilis yang didukung sebelum menjatuhkan hak akses
RUN apt-get update \
 && apt-get -y upgrade \
 && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .

EXPOSE 3000

# migrasi D1 lokal (aman diulang, IF NOT EXISTS) lalu jalankan worker di 0.0.0.0
CMD ["sh", "-c", "npx wrangler d1 migrations apply asterion-run --local --yes >/dev/null 2>&1 || echo 'migrasi D1 lokal dilewati'; exec npx wrangler dev --ip 0.0.0.0 --port ${PORT:-3000} --show-interactive-dev-session=false"]
