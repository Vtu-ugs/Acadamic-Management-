# Backend API image (Node + Express + Sequelize).
FROM node:20-alpine

# tini = a tiny init that reaps zombies and forwards SIGTERM, so the
# graceful-shutdown handler in server.js actually fires on `docker stop`.
RUN apk add --no-cache tini

WORKDIR /app

# Reproducible installs from the committed lockfile (better layer caching too).
COPY package*.json ./
RUN npm ci --omit=dev

# App source.
COPY . .

ENV NODE_ENV=production
EXPOSE 4000

# Drop root: run as the unprivileged `node` user the base image ships. The app
# only reads /app at runtime, so root-owned files are fine.
USER node

# Simple health probe used by docker-compose to gate the frontend on a ready API.
HEALTHCHECK --interval=10s --timeout=5s --retries=10 \
  CMD wget -qO- http://localhost:4000/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
