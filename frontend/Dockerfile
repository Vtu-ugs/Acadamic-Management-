# Frontend image — build the Vite app, then serve the static bundle with Nginx.
# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# Reproducible install from the committed lockfile. --legacy-peer-deps because
# some ESLint plugins declare narrow peer ranges; they're dev-only and don't
# affect the built bundle.
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

# --- serve stage ---
FROM nginx:alpine
# SPA routing + /api proxy to the backend service (see nginx.conf).
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
