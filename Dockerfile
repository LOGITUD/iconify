################################################################################
# Global build arguments
ARG NODE_VERSION=22
ARG OS=bullseye-slim
ARG ICONIFY_API_VERSION=3.1.1
ARG SRC_PATH=.
ARG CACHEBUST=1

#### Stage BASE ################################################################
FROM node:${NODE_VERSION}-${OS} AS base

# Access to OS CAs
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

# Temporarily override APT sources if needed
RUN cp /etc/apt/sources.list /etc/apt/sources.list.original
COPY tmp/sources.list /tmp/sources.list.tmp
RUN ([ -s /tmp/sources.list.tmp ] \
      && mv -f /tmp/sources.list.tmp /etc/apt/sources.list \
      && cat /etc/apt/sources.list) \
    || cat /etc/apt/sources.list

# Add temporary build CA
COPY tmp/build-ca-cert.crt /usr/local/share/ca-certificates/build-ca-cert.crt

# Install base tools and clean up
RUN set -ex && \
    apt-get update && \
    apt-get install --no-install-recommends -y \
      ca-certificates \
      bash \
      curl \
      nano \
      git && \
    mkdir -p /data/iconify-api && \
    apt-get clean && \
    rm -rf /tmp/* && \
    ([ -s /etc/apt/sources.list.original ] \
      && mv /etc/apt/sources.list.original /etc/apt/sources.list) && \
    rm -f /usr/local/share/ca-certificates/build-ca-cert.crt

WORKDIR /data/iconify-api

#### Stage ICONIFY-API-INSTALL ################################################
FROM base AS iconify-api-install

# Redeclare args needed in this stage
ARG SRC_PATH
ARG CACHEBUST

# Enable verbose bash + fail on pipe errors
SHELL ["/bin/bash", "-o", "pipefail", "-x", "-c"]

# Debug: force cache bust and inspect context
RUN echo "Cachebust: $CACHEBUST" \
  && echo "---- Debug: Stage iconify-api-install ----" \
  && echo "Context root:" && ls -R .

# Copy package.json and install deps verbosely
COPY ${SRC_PATH}*.json ./
RUN npm ci --verbose

# Copy source code and icons
COPY ${SRC_PATH}src/   /data/iconify-api/src/
COPY ${SRC_PATH}icons/ /data/iconify-api/icons/

# Debug: verify files were copied
RUN echo "After copy, /data/iconify-api contains:" && ls -R /data/iconify-api

# Build with verbose logs
RUN npm run build -- --verbose

#### Stage RELEASE #############################################################
FROM iconify-api-install AS release

ARG BUILD_DATE
ARG BUILD_VERSION
ARG BUILD_REF
ARG ICONIFY_API_VERSION
ARG TAG_SUFFIX=default

LABEL org.label-schema.build-date=${BUILD_DATE} \
      org.label-schema.docker.dockerfile="Dockerfile" \
      org.label-schema.license="MIT" \
      org.label-schema.name="Iconify API" \
      org.label-schema.version=${BUILD_VERSION} \
      org.label-schema.description="Node.js version of api.iconify.design" \
      org.label-schema.url="https://github.com/iconify/api" \
      org.label-schema.vcs-ref=${BUILD_REF} \
      org.label-schema.vcs-type="Git" \
      org.label-schema.vcs-url="https://github.com/iconify/api" \
      authors="Vjacheslav Trushkin, Logitud"

# Clean up any leftover temp files
RUN rm -rf /tmp/*

# Expose port and healthcheck
ENV ICONIFY_API_VERSION=$ICONIFY_API_VERSION
EXPOSE 3000
HEALTHCHECK CMD curl http://localhost:3000/ || exit 1

CMD ["npm", "run", "start"]