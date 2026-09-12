# Ecorestore Network — application runtime image.
#
# One image, three roles in docker-compose.yml: the persistent Hardhat chain
# (`chain`), the one-shot demo settlement + subgraph deployment (`bootstrap`)
# and the read-only demo API (`api`). All three need the same root
# node_modules (hardhat, tsx, ethers) and the compiled contracts; bootstrap
# also needs subgraph/'s graph-cli toolchain, installed here too.
#
# Nothing in this image is a secret or a credential: the chain is Hardhat's
# in-memory network with its well-known, public test accounts, the token is
# MockUSDC, the Guardian is MockGuardianAdapter. Build context is the
# repository root; .dockerignore keeps app/, docs and build output out.
FROM node:22-slim

ENV HARDHAT_DISABLE_TELEMETRY_PROMPT=true
RUN mkdir -p /app /state && chown node:node /app /state
USER node
WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY --chown=node:node subgraph/package.json subgraph/package-lock.json ./subgraph/
RUN cd subgraph && npm ci --no-audit --no-fund

COPY --chown=node:node . .
# solc 0.8.24 is resolved from the local `solc` package (hardhat.config.cjs),
# so compiling needs no network.
RUN npx hardhat compile

# Where bootstrap writes, and the API reads, the demo deployment record.
# docker-compose.yml mounts a shared volume here.
ENV DEMO_DEPLOYMENT_FILE=/state/deployment.local.json
EXPOSE 4000 8545
CMD ["npx", "tsx", "server/index.ts"]
