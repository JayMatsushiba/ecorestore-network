#!/usr/bin/env bash
# Ecorestore Network — deploy one commit on the demonstration host.
#
# Runs on the host, as root, through SSM (.github/workflows/deploy.yml):
#
#   deploy.sh <git sha>
#
# The workflow has already advanced the checkout at APP_DIR to <sha>, so this is the
# script committed alongside the images it deploys. It reads /ecorestore/demo/* from
# Parameter Store (ECR_REGISTRY required; DOMAIN optional), logs in to ECR with the
# instance role, pulls the images tagged <sha>, and restarts the stack from scratch:
# the chain is Hardhat's in-memory network, so a deploy is a fresh chain, and the
# Graph Node index of the previous chain is discarded with it. The `bootstrap`
# service then re-runs the synthetic demo settlement and redeploys the subgraph;
# `up --wait` returns once the API is healthy, and this script waits until the API
# reports the deed indexed. Caddy's volumes (certificates) are kept.
#
# Nothing here is a secret: no deployer key, no RPC credential, no real token. The
# only parameter read is where to pull images from and which hostname to serve.
set -euo pipefail

SHA="${1:?usage: deploy.sh <git sha>}"
APP_DIR="${APP_DIR:-/opt/ecorestore/app}"
PARAM_PATH="${PARAM_PATH:-/ecorestore/demo}"
PROJECT=ecorestore   # docker-compose.yml `name:` — prefixes the volumes reset below

# One host operation at a time. The workflow takes this lock itself (and sets
# ECORESTORE_HOST_LOCK) so that the checkout and the deploy happen under one hold.
if [ -z "${ECORESTORE_HOST_LOCK:-}" ]; then
  exec 9>/var/lock/ecorestore-host.lock
  flock -w 900 9 || { echo "another deploy holds the host lock" >&2; exit 1; }
fi

cd "$APP_DIR"
if [ "$(git rev-parse HEAD)" != "$SHA" ]; then
  echo "checkout is $(git rev-parse --short HEAD), expected $SHA" >&2
  exit 1
fi

imds() {
  local token
  token="$(curl -fsS --max-time 2 -X PUT http://169.254.169.254/latest/api/token \
             -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')"
  curl -fsS --max-time 2 -H "X-aws-ec2-metadata-token: $token" "http://169.254.169.254/latest/meta-data/$1"
}
export AWS_DEFAULT_REGION="$(imds placement/region)"
public_ip="$(imds public-ipv4 || true)"

# Parameters become environment for the life of this process only; no .env is written.
while IFS=$'\t' read -r name value; do
  [ -n "$name" ] || continue
  export "${name##*/}=$value"
done < <(aws ssm get-parameters-by-path --path "$PARAM_PATH" --with-decryption \
          --query 'Parameters[].[Name,Value]' --output text)
: "${ECR_REGISTRY:?parameter $PARAM_PATH/ECR_REGISTRY is required}"
export IMAGE_TAG="$SHA"

echo "deploying $SHA"
echo "  registry:  $ECR_REGISTRY"
echo "  site:      ${DOMAIN:-http://${public_ip:-<unknown>} (plain HTTP on the public IP)}"
echo "  chain:     Hardhat in-memory demo network in the chain container — not Arc"
echo "  data:      synthetic fixtures, MockUSDC, MockGuardianAdapter"

aws ecr get-login-password | docker login --username AWS --password-stdin "$ECR_REGISTRY" >/dev/null

compose=(docker compose -f docker-compose.yml -f deploy/docker-compose.aws.yml)

"${compose[@]}" pull --quiet

# Fresh chain, fresh index, fresh deployment record. Caddy's volumes are not listed.
"${compose[@]}" down --remove-orphans --timeout 30
docker volume rm -f "${PROJECT}_demo-state" "${PROJECT}_postgres-data" "${PROJECT}_ipfs-data" >/dev/null 2>&1 || true

"${compose[@]}" up -d --remove-orphans --wait --wait-timeout 600

# Keep only this deploy's images (and the build cache tag).
docker images --format '{{.Repository}}:{{.Tag}}' \
  | grep -F "$ECR_REGISTRY/ecorestore/" | grep -v -e ":$SHA\$" -e ':buildcache$' \
  | xargs -r docker rmi >/dev/null 2>&1 || true
docker image prune -f >/dev/null

# The API is healthy as soon as it listens; the deed appears once Graph Node has
# indexed the settlement bootstrap just ran. Through Caddy, so the whole path is tested.
for _ in $(seq 1 36); do
  if deed="$(curl -fsS --max-time 10 http://127.0.0.1/api/deed)" \
     && echo "$deed" | python3 -c 'import json,sys; sys.exit(0 if json.load(sys.stdin).get("status") == "OK" else 1)'; then
    echo "$deed" | python3 -c 'import json,sys; d=json.load(sys.stdin)["deployment"]; print("  deed:      indexed; deedId", d["deedId"], "settledQuantity", d["settledQuantity"], "(synthetic fixture)")'
    "${compose[@]}" ps
    echo "deployed $SHA"
    exit 0
  fi
  sleep 5
done

echo "the API did not report the deed indexed after deploy" >&2
"${compose[@]}" ps >&2
"${compose[@]}" logs --tail 50 bootstrap api graph-node frontend caddy >&2
exit 1
