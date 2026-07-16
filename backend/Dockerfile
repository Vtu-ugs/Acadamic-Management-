# Backend API image (Node + Express + Sequelize).
FROM node:20-alpine
WORKDIR /app

# Install production dependencies first (better layer caching).
COPY package*.json ./
RUN npm install --omit=dev

# App source.
COPY . .

ENV NODE_ENV=production
EXPOSE 4000

# Simple health probe used by docker-compose to gate the frontend on a ready API.
HEALTHCHECK --interval=10s --timeout=5s --retries=10 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "src/server.js"]
