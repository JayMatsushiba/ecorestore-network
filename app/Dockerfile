# Ecorestore frontend — the React verification console, built with Vite and
# served by nginx, which also proxies /api/ to the verify service.
#
# Build context is app/ (see docker-compose.yml). The committed demo bundles
# in public/demo/ ship with the page as the offline fallback.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
