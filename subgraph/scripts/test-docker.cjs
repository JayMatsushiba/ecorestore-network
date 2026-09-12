#!/usr/bin/env node
"use strict";

/**
 * Ecorestore Network — Matchstick test runner (Windows-safe)
 *
 * `graph test --docker` (graph-cli's own Docker runner for matchstick-as,
 * required on Windows since matchstick ships no native Windows binary —
 * see docs/GRAPH.md) hardcodes `docker run -it`. A `-t` (pseudo-TTY)
 * allocation fails with "the input device is not a TTY" in any
 * non-interactive shell (this includes automation and most agent/CI
 * environments on Windows, not just this one). Matchstick's own output is
 * non-interactive, so `-i` (stdin only, no pty) is sufficient and behaves
 * identically on a real interactive terminal. This script reproduces
 * graph-cli's own build+run sequence (test.js's runDocker) with that one
 * flag changed — same Dockerfile, same image tag, same bind mount.
 */

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const cwd = process.cwd();
const dockerfilePath = path.join("tests", ".docker", "Dockerfile");

function run(cmd, args, opts) {
  return spawnSync(cmd, args, { stdio: "inherit", ...opts });
}

const imageCheck = spawnSync("docker", ["images", "-q", "matchstick"], { encoding: "utf8" });
const imageExists = imageCheck.stdout.trim().length > 0;

if (!imageExists) {
  const build = run("docker", ["build", "-f", dockerfilePath, "-t", "matchstick", "."]);
  if (build.status !== 0) {
    process.exit(build.status === null ? 1 : build.status);
  }
}

const result = run("docker", [
  "run",
  "-i",
  "--rm",
  "--mount",
  `type=bind,source=${cwd},target=/matchstick`,
  "matchstick",
]);
process.exit(result.status === null ? 1 : result.status);
