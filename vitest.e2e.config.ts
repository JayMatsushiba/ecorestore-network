/**
 * Ecorestore Network — M5 Graph Node E2E vitest configuration
 *
 * Separate from vitest.config.ts (which excludes **\/*.e2e.test.ts so
 * ordinary `npm test` stays fast and infrastructure-independent). Run via
 * `npm run test:e2e:graph` — see graph/tests/e2e.test.ts's header comment
 * and docs/GRAPH.md for the required local Hardhat/Docker setup steps.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["graph/tests/e2e.test.ts"],
    exclude: ["**/node_modules/**", "subgraph/**"],
  },
});
