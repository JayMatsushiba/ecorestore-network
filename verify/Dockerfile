# Ecorestore verify — canonicalisation, hashing, credential signing,
# Guardian submission, contract calldata; optional on-chain execution.
#
# Build context is the repository root (see docker-compose.yml). The
# contracts are compiled in a Foundry stage so the image can drive a local
# anvil when DEMO_RPC_URL is set; no scientific dependency is installed here.
FROM ghcr.io/foundry-rs/foundry:latest AS contracts
WORKDIR /src
COPY contracts/foundry.toml ./contracts/
COPY contracts/src ./contracts/src
COPY contracts/script ./contracts/script
COPY contracts/lib ./contracts/lib
RUN forge build --root contracts

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
# tsx is a devDependency; the service runs TypeScript directly, so keep dev deps.
RUN npm ci --no-audit --no-fund

COPY verification ./verification
COPY guardian/adapter.ts guardian/issuance.ts ./guardian/
COPY guardian/schema ./guardian/schema
COPY auditor/agent.ts ./auditor/
COPY contracts/client.ts ./contracts/
COPY --from=contracts /src/contracts/out ./contracts/out
COPY verify ./verify

RUN npx tsc --noEmit -p tsconfig.json \
 && mkdir -p guardian/outbox && chown -R node:node /app
USER node

EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npx", "tsx", "verify/server.ts"]
