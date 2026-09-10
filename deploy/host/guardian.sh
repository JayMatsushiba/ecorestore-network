#!/usr/bin/env bash
# Operate the Hedera Guardian quickstart on the demonstration host.
#
#   deploy/host/guardian.sh status | up | down | logs
#
# Invoked by .github/workflows/guardian.yml through SSM Run Command, as root. Guardian
# runs from its own checkout (docs/DEPLOYMENT.md §6): /opt/ecorestore/guardian, cloned
# at the pinned tag by the CloudFormation user-data. Its compose project is
# `guardian-quickstart`, so its network is `guardian-quickstart_default` — the name
# docker-compose.override.yml attaches `verify` to.
#
# Credentials come from SSM Parameter Store under /ecorestore/guardian/:
#   OPERATOR_ID        Hedera testnet account id (0.0.x)
#   OPERATOR_KEY       SecureString — its ED25519 DER private key (testnet only)
#   GUARDIAN_VERSION   image tag; default 3.7.0 (the version this project is tested
#                      against, docs/GUARDIAN.md)
#   GUARDIAN_PUBLIC_PORT  host port for the Guardian UI; default 3000
# They are exported to compose for the lifetime of this process; no .env is written.
set -euo pipefail

ACTION="${1:?usage: guardian.sh status|up|down|logs}"
APP_DIR="${APP_DIR:-/opt/ecorestore/app}"
GUARDIAN_DIR="${GUARDIAN_DIR:-/opt/ecorestore/guardian}"
PARAM_PATH="${PARAM_PATH:-/ecorestore/guardian}"

region="$(curl -fsS --max-time 2 -H "X-aws-ec2-metadata-token: $(curl -fsS --max-time 2 -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')" http://169.254.169.254/latest/meta-data/placement/region)"
export AWS_DEFAULT_REGION="$region"

while IFS=$'\t' read -r name value; do
  [ -n "$name" ] || continue
  export "${name##*/}=$value"
done < <(aws ssm get-parameters-by-path --path "$PARAM_PATH" --with-decryption \
          --query 'Parameters[].[Name,Value]' --output text)

export GUARDIAN_VERSION="${GUARDIAN_VERSION:-3.7.0}"
export GUARDIAN_PUBLIC_PORT="${GUARDIAN_PUBLIC_PORT:-3000}"
# Leave GUARDIAN_ENV empty: the quickstart's env file is configs/.env.quickstart.guardian.system.
export GUARDIAN_ENV=""

cd "$GUARDIAN_DIR"
compose=(docker compose -f docker-compose-quickstart.yml -f "$APP_DIR/deploy/guardian/docker-compose.public.yml")

case "$ACTION" in
  status)
    echo "guardian checkout: $(git describe --tags --always) at $GUARDIAN_DIR"
    "${compose[@]}" ps
    if docker network inspect guardian-quickstart_default >/dev/null 2>&1; then
      echo "network guardian-quickstart_default: present"
    else
      echo "network guardian-quickstart_default: absent (verify runs standalone)"
    fi
    curl -fsS --max-time 5 -o /dev/null -w "web-proxy on :$GUARDIAN_PUBLIC_PORT → HTTP %{http_code}\n" \
      "http://127.0.0.1:$GUARDIAN_PUBLIC_PORT/" || echo "web-proxy on :$GUARDIAN_PUBLIC_PORT → not answering"
    ;;
  up)
    : "${OPERATOR_ID:?parameter $PARAM_PATH/OPERATOR_ID is required}"
    : "${OPERATOR_KEY:?parameter $PARAM_PATH/OPERATOR_KEY is required}"
    echo "starting Guardian $GUARDIAN_VERSION (operator $OPERATOR_ID, UI on :$GUARDIAN_PUBLIC_PORT)"
    "${compose[@]}" pull --quiet
    "${compose[@]}" up -d --remove-orphans
    # The gateway takes a while to come up behind auth/policy/worker; wait for the proxy.
    for _ in $(seq 1 60); do
      if curl -fsS --max-time 5 -o /dev/null "http://127.0.0.1:$GUARDIAN_PUBLIC_PORT/"; then
        echo "Guardian web proxy answering on :$GUARDIAN_PUBLIC_PORT"
        "${compose[@]}" ps
        echo "now run the Deploy workflow so verify attaches to guardian-quickstart_default"
        exit 0
      fi
      sleep 10
    done
    echo "Guardian did not answer within 10 minutes" >&2
    "${compose[@]}" ps >&2
    exit 1
    ;;
  down)
    # Volumes (MongoDB, IPFS) are kept so a later `up` resumes the same Guardian state.
    "${compose[@]}" down --remove-orphans
    echo "Guardian stopped; run the Deploy workflow so verify falls back to the outbox"
    ;;
  logs)
    "${compose[@]}" logs --tail 100 api-gateway guardian-service policy-service worker-service
    ;;
  *)
    echo "unknown action: $ACTION" >&2
    exit 2
    ;;
esac
