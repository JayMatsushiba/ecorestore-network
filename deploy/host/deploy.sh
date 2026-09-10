#!/usr/bin/env bash
# Deploy one commit of the application stack on the demonstration host.
#
#   deploy/host/deploy.sh <git sha>
#
# Invoked by .github/workflows/deploy.yml through SSM Run Command, as root, from
# /opt/ecorestore/app with that commit already checked out. It can also be run by hand
# from an SSM session. Steps:
#
#   1. read the deployment configuration from SSM Parameter Store (/ecorestore/demo/*);
#      secrets are decrypted in memory and exported to compose — no .env is written;
#   2. log in to ECR with the instance role and pull the images tagged <sha>;
#   3. attach to Guardian's network if the quickstart is running, otherwise run
#      standalone (Guardian requests are staged to the outbox and reported as such);
#   4. docker compose up, wait for health, and check /health through the edge proxy.
#
# The script is idempotent; re-running it for the same sha is a no-op restart.
set -euo pipefail

SHA="${1:?usage: deploy.sh <git sha>}"
APP_DIR="${APP_DIR:-/opt/ecorestore/app}"
PARAM_PATH="${PARAM_PATH:-/ecorestore/demo}"
GUARDIAN_NETWORK="${GUARDIAN_NETWORK:-guardian-quickstart_default}"

cd "$APP_DIR"
if [ "$(git rev-parse HEAD)" != "$SHA" ]; then
  echo "checkout is $(git rev-parse --short HEAD), expected $SHA" >&2
  exit 1
fi

# --- 1. configuration from Parameter Store ---------------------------------------
# Every parameter under $PARAM_PATH becomes an environment variable of the same name
# (the last path segment). Expected names, all optional except ECR_REGISTRY:
#   ECR_REGISTRY        <account>.dkr.ecr.<region>.amazonaws.com   (stack output)
#   VERIFIER_SEED       SecureString — the verifier DID's root; keep it out of logs
#   DOMAIN              a hostname pointing at this host → Caddy serves HTTPS
#   GUARDIAN_PUBLIC_URL host-visible Guardian URL shown in the interface
#   GUARDIAN_POLICY_ID / GUARDIAN_BLOCK_TAG / GUARDIAN_POLICY_TAG
#   DEMO_RPC_URL / DEMO_MNEMONIC   normally UNSET on AWS: calldata is prepared, not
#                                  broadcast (docs/DEPLOYMENT.md §4)
region="$(curl -fsS --max-time 2 -H "X-aws-ec2-metadata-token: $(curl -fsS --max-time 2 -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')" http://169.254.169.254/latest/meta-data/placement/region)"
export AWS_DEFAULT_REGION="$region"
public_ip="$(curl -fsS --max-time 2 -H "X-aws-ec2-metadata-token: $(curl -fsS --max-time 2 -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')" http://169.254.169.254/latest/meta-data/public-ipv4 || true)"

while IFS=$'\t' read -r name value; do
  [ -n "$name" ] || continue
  export "${name##*/}=$value"
done < <(aws ssm get-parameters-by-path --path "$PARAM_PATH" --with-decryption \
          --query 'Parameters[].[Name,Value]' --output text)

: "${ECR_REGISTRY:?parameter $PARAM_PATH/ECR_REGISTRY is required}"
export IMAGE_TAG="$SHA"
# The Guardian address shown in the interface: the parameter if set, else this host.
export GUARDIAN_PUBLIC_URL="${GUARDIAN_PUBLIC_URL:-http://${DOMAIN:-$public_ip}:${GUARDIAN_PUBLIC_PORT:-3000}}"

echo "deploying $SHA"
echo "  registry:  $ECR_REGISTRY"
echo "  domain:    ${DOMAIN:-<none — plain HTTP on the public IP>}"
echo "  chain:     ${DEMO_RPC_URL:-<unset — calldata prepared, not broadcast>}"

# --- 2. images --------------------------------------------------------------------
aws ecr get-login-password | docker login --username AWS --password-stdin "$ECR_REGISTRY" >/dev/null

# --- 3. Guardian attachment -------------------------------------------------------
compose=(docker compose -f docker-compose.yml -f deploy/docker-compose.aws.yml)
if docker network inspect "$GUARDIAN_NETWORK" >/dev/null 2>&1; then
  echo "  guardian:  attached ($GUARDIAN_NETWORK)"
  compose+=(-f docker-compose.override.yml)
  export GUARDIAN_NETWORK
else
  echo "  guardian:  not running — standalone; requests staged to guardian/outbox, NOT submitted"
  # Explicitly clear anything inherited so verify does not try a stale address.
  unset GUARDIAN_URL
fi

mkdir -p guardian/outbox

# --- 4. up ------------------------------------------------------------------------
"${compose[@]}" pull --quiet
"${compose[@]}" up -d --remove-orphans --wait --wait-timeout 300
docker image prune -f >/dev/null

# The edge proxy forwards /health to verify through the frontend's nginx.
for _ in $(seq 1 30); do
  if health="$(curl -fsS --max-time 10 http://127.0.0.1/health)"; then
    echo "$health" | python3 -c 'import json,sys; h=json.load(sys.stdin); print("  health:    ok; analysis", "reachable" if h["analysis"]["reachable"] else "UNREACHABLE", "; guardian mode", h["guardian"]["mode"])'
    "${compose[@]}" ps
    echo "deployed $SHA"
    exit 0
  fi
  sleep 5
done
echo "health check failed after deploy" >&2
"${compose[@]}" ps >&2
"${compose[@]}" logs --tail 50 verify frontend caddy >&2
exit 1
