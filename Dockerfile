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

# Copie le code buildé et les icônes
COPY lib/ ./lib/
COPY cache/ ./cache/
COPY icons/ ./icons/

RUN ls -al

RUN chmod 777 -R /data/iconify-api/cache

EXPOSE 3000

CMD ["npm", "run", "start"]
