#!/usr/bin/env node
"use strict";

/**
 * Ecorestore Network — M5 Subgraph Configuration Script
 *
 * Patches subgraph.yaml's dataSource address/startBlock from
 * ../deployment.local.json (written by
 * scripts/deployAndRunLocalDemo.cjs after deploying RestorationDeed to
 * the persistent local Hardhat node). Run this before `graph codegen`/
 * `graph build`/`graph deploy` — see docs/GRAPH.md's startup instructions.
 */

const fs = require("node:fs");
const path = require("node:path");

const deploymentPath = path.join(__dirname, "..", "deployment.local.json");
const manifestPath = path.join(__dirname, "..", "subgraph.yaml");

if (!fs.existsSync(deploymentPath)) {
  console.error(
    `Missing ${deploymentPath}. Run this first:\n` +
      "  npx hardhat node --hostname 0.0.0.0\n" +
      "  NODE_OPTIONS=--import=tsx npx hardhat run scripts/deployAndRunLocalDemo.cjs --network localhost\n" +
      "(from the repository root, in a second terminal, with the Hardhat node still running)",
  );
  process.exit(1);
}

const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
let manifest = fs.readFileSync(manifestPath, "utf8");

manifest = manifest.replace(/address: "0x[0-9a-fA-F]*"/, `address: "${deployment.address}"`);
manifest = manifest.replace(/startBlock: \d+/, `startBlock: ${deployment.startBlock}`);

fs.writeFileSync(manifestPath, manifest);
console.log(`Configured subgraph.yaml: address=${deployment.address} startBlock=${deployment.startBlock}`);
