# syntax=docker/dockerfile:1

# --- build the web app ------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci
COPY web web
RUN npm run build -w web

# --- production dependencies only (server) -----------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --omit=dev -w server

# --- runtime ------------------------------------------------------------------
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8080 \
    CONFIG_PATH=/config/config.yaml \
    DATA_DIR=/data \
    WEB_DIST=/app/web/dist
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY server/package.json server/package.json
COPY server/src server/src
COPY --from=build /app/web/dist web/dist
# /data holds all mutable state; make it writable for the unprivileged user.
RUN mkdir -p /data /config && chown node:node /data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/src/index.js"]
