FROM node:22-bullseye-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    bash \
    curl \
    nano \
    git \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    && rm -rf /tmp/*

WORKDIR /data/iconify-api

# Copie les fichiers package.json et package-lock.json (ou autre gestionnaire)
COPY *.json ./

RUN npm ci

# Copie le code source et les icônes
COPY src/ ./src/
COPY icons/ ./icons/

RUN npm run build

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["npm", "run", "start"]
