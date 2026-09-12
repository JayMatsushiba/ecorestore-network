/**
 * Ecorestore Network — Hardhat configuration (M3)
 *
 * NETWORK NOTE: this build environment's network egress allowlist does not
 * include binaries.soliditylang.org, which is where Hardhat's built-in
 * compiler downloader fetches solc from by default. The subtask override
 * below redirects Hardhat's solc resolution to the solc compiler already
 * bundled in the local `solc` npm package (installed from the standard npm
 * registry, which IS allowed) instead of attempting a network download.
 * This is a documented, standard Hardhat pattern for offline/air-gapped
 * compilation — see https://hardhat.org (compiler resolution subtasks) —
 * not a modification to Solidity compilation behavior itself: the same
 * solc version (0.8.24) and inputs are compiled either way.
 */
const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");

require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-network-helpers");

const LOCAL_SOLC_VERSION = "0.8.24";

subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD).setAction(async (args, _hre, runSuper) => {
  if (args.solcVersion === LOCAL_SOLC_VERSION) {
    return {
      compilerPath: require.resolve("solc/soljson.js"),
      isSolcJs: true,
      version: args.solcVersion,
      longVersion: require("solc").version(),
    };
  }
  return runSuper(args);
});

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: LOCAL_SOLC_VERSION,
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./contracts/tests",
    cache: "./contracts/.cache",
    artifacts: "./contracts/.artifacts",
  },
  networks: {
    hardhat: {},
    // The persistent local demo node (`npx hardhat node`) that
    // scripts/deployAndRunLocalDemo.cjs targets with --network localhost.
    // HARDHAT_RPC_URL lets docker-compose.yml point that at the `chain`
    // container; unset, this is Hardhat's own default for "localhost".
    localhost: {
      url: process.env.HARDHAT_RPC_URL ?? "http://127.0.0.1:8545",
    },
  },
};
