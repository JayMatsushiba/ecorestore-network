#!/usr/bin/env node
"use strict";
/**
 * Ecorestore Network — tiny HTTP probe for container health checks and
 * start-up waits (docker-compose.yml, scripts/bootstrap-stack.sh). The
 * runtime image has no curl; Node's fetch is enough.
 *
 *   node scripts/http-probe.cjs <url>              exit 0 on any 2xx GET
 *   node scripts/http-probe.cjs <url> <rpcMethod>  exit 0 if a JSON-RPC call
 *                                                  to <url> returns a result
 *   node scripts/http-probe.cjs <url> --any        exit 0 on any HTTP response
 */
const [url, mode] = process.argv.slice(2);
if (!url) {
  console.error("usage: http-probe.cjs <url> [<jsonrpc method> | --any]");
  process.exit(2);
}

const timeout = AbortSignal.timeout(4000);
const request =
  mode && mode !== "--any"
    ? fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: mode, params: [] }),
        signal: timeout,
      }).then(async (res) => {
        const body = await res.json();
        if (body.result === undefined) throw new Error(`no result: ${JSON.stringify(body)}`);
      })
    : fetch(url, { signal: timeout }).then((res) => {
        if (mode !== "--any" && !res.ok) throw new Error(`HTTP ${res.status}`);
      });

request.then(
  () => process.exit(0),
  (err) => {
    console.error(`${url}: ${err.message}`);
    process.exit(1);
  },
);
