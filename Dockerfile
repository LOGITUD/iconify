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

# Copy all files
COPY . .

RUN npm run build

RUN npm run init

EXPOSE 3000

CMD ["npm", "run", "start"]
