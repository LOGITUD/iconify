FROM node:22-bullseye-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    bash \
    curl \
    nano \
    git \
    cpulimit \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    && rm -rf /tmp/*

WORKDIR /data/iconify-api

# Copie les fichiers package.json et package-lock.json (ou autre gestionnaire)
COPY *.json ./

RUN npm ci

# Copy source code and icons
COPY src/ ./src/
COPY icons/ ./icons/

RUN npm run build

RUN ln -s ../icons lib/icons

RUN npm run init

EXPOSE 3000

CMD ["npm", "run", "start"]
