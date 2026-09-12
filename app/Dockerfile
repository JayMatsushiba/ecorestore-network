# Ecorestore frontend — the React demo UI (app/), built with Vite and served
# by nginx, which also proxies /api/ to the demo API server (server/).
#
# Build context is app/ (see docker-compose.yml). VITE_API_BASE_URL is baked
# into the bundle at build time; the empty default means "same origin", i.e.
# nginx's /api/ proxy, so the browser never needs to know where the API runs
# and the same image serves behind any hostname.
FROM node:22-slim AS build
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
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
