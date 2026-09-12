#!/usr/bin/env bash
# Ecorestore Network — one-shot stack bootstrap (docker-compose.yml `bootstrap`).
#
# Does, in order, what README.md "Running the Demo" steps 2 and 4 do by hand:
#   1. the real M1 -> M2 -> Arc settlement of the synthetic demo fixture against
#      the persistent chain (scripts/deployAndRunLocalDemo.cjs), which writes the
#      deployment record to DEMO_DEPLOYMENT_FILE;
#   2. configure / codegen / build / create / deploy of the subgraph against the
#      Graph Node named by GRAPH_NODE_ADMIN_URL.
# It computes nothing scientific or financial itself. Idempotent: if the record
# already names a contract that exists on the current chain, step 1 is skipped
# and only the subgraph is (re)deployed — a container restart on a live chain
# must not settle a second deed.
set -euo pipefail

: "${HARDHAT_RPC_URL:?}" "${GRAPH_NODE_ADMIN_URL:?}" "${IPFS_URL:?}" "${DEMO_DEPLOYMENT_FILE:?}"
SUBGRAPH_NAME=ecorestore/restoration-deed
PROBE="node scripts/http-probe.cjs"

wait_for() { # <label> <probe args...>
  local label=$1; shift
  for _ in $(seq 1 60); do
    if $PROBE "$@" 2>/dev/null; then echo "bootstrap: $label is up"; return 0; fi
    sleep 2
  done
  echo "bootstrap: $label did not answer ($*)" >&2
  exit 1
}

wait_for "chain ($HARDHAT_RPC_URL)" "$HARDHAT_RPC_URL" eth_chainId
wait_for "graph-node admin ($GRAPH_NODE_ADMIN_URL)" "$GRAPH_NODE_ADMIN_URL" --any

settle=1
if [ -f "$DEMO_DEPLOYMENT_FILE" ]; then
  address=$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).address' "$DEMO_DEPLOYMENT_FILE")
  code=$(node -e '
    const [url, address] = process.argv.slice(1);
    fetch(url, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getCode", params: [address, "latest"] }) })
      .then((r) => r.json()).then((j) => process.stdout.write(j.result ?? "0x"))
      .catch(() => process.stdout.write("0x"));
  ' "$HARDHAT_RPC_URL" "$address")
  if [ "$code" != "0x" ]; then
    echo "bootstrap: $DEMO_DEPLOYMENT_FILE names $address and it exists on this chain — settlement already done"
    settle=0
  else
    echo "bootstrap: $DEMO_DEPLOYMENT_FILE is stale (no code at $address on this chain) — settling again"
  fi
fi

if [ "$settle" = 1 ]; then
  echo "bootstrap: running the demo settlement (synthetic fixture, MockUSDC, local chain)"
  npm run demo:local
fi

cd subgraph
node scripts/configure.cjs
npx graph codegen
npx graph build
# `create` fails if the name already exists on this Graph Node (a restart with a
# persistent store); `deploy` is what matters and is safe to repeat.
npx graph create --node "$GRAPH_NODE_ADMIN_URL" "$SUBGRAPH_NAME" \
  || echo "bootstrap: $SUBGRAPH_NAME already exists on this Graph Node — continuing"
npx graph deploy --node "$GRAPH_NODE_ADMIN_URL" --ipfs "$IPFS_URL" "$SUBGRAPH_NAME" --version-label v0.0.1
echo "bootstrap: done — $SUBGRAPH_NAME deployed; the API reports the deed once Graph Node has indexed it"
