# ASTERION — Worker dijalankan di Node 24 (Alpine) lewat adapter server.js.
# Binding Cloudflare (D1/KV/R2) digantikan shim SQLite di server.js sehingga
# image tidak memerlukan workerd maupun pustaka glibc Debian.
FROM node:24-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data

WORKDIR /app

# perbaiki paket OS Alpine sebelum menjatuhkan hak akses
RUN echo "os-refresh 2026-11-13" && apk upgrade --no-cache

# tidak ada dependensi runtime (worker murni Web API), jadi tanpa npm install
COPY package.json ./
COPY server.js wrangler.jsonc ./
COPY src ./src
COPY public ./public
COPY migrations ./migrations

RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "server.js"]
