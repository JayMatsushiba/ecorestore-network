/**
 * Ecorestore Network — vitest configuration (M3, extended M5)
 *
 * Excludes contracts/** — those tests run under Hardhat's own Mocha-based
 * test runner (`npx hardhat test`), against a CommonJS config
 * (hardhat.config.cjs), and are not vitest/ESM-compatible. Without this
 * exclude, vitest's default include glob would also try to import them and
 * fail, since they use Mocha's global describe/it conventions and require()
 * hardhat/chai directly rather than vitest's API.
 *
 * Excludes subgraph/** — that is a separate AssemblyScript/WASM project
 * with its own toolchain (`graph test`, via matchstick-as) and its own
 * package.json; its .ts files are not valid TypeScript/ESM under this
 * project's config (docs/GRAPH.md).
 *
 * Excludes **\/*.e2e.test.ts — the M5 Graph Node integration test
 * (graph/tests/e2e.test.ts) requires Docker/Graph Node/Postgres/IPFS and a
 * persistent Hardhat node to be running; it must not make ordinary
 * `npm test` slow or environment-dependent. Run it explicitly via
 * `npm run test:e2e:graph` (docs/GRAPH.md has the startup steps).
 *
 * Excludes app/** — the M6 React UI is its own Vite project with its own
 * vitest config (jsdom environment, @vitejs/plugin-react, testing-library
 * setup). Run its tests via `cd app && npm test`.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "contracts/**",
      "subgraph/**",
      "app/**",
      "**/e2e.test.ts",
      "**/*.e2e.test.ts",
    ],
  },
});
