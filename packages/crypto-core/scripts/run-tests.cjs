const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { setActiveEnvironment, resolveDep } = require("./hardhat-runtime.cjs");
const { ethers } = resolveDep("ethers");

async function runTests() {
  const repoRoot = path.resolve(__dirname, "../../..");
  const localEvmUrl = pathToFileURL(path.join(repoRoot, "contracts/tetrakis/tests/local-evm.mjs")).href;
  const { startLocalEvm } = await import(localEvmUrl);

  const suites = [];
  let currentSuite = null;

  global.describe = function (title, fn) {
    const suite = { title, beforeEachHooks: [], tests: [] };
    suites.push(suite);
    const prev = currentSuite;
    currentSuite = suite;
    fn();
    currentSuite = prev;
  };

  global.beforeEach = function (fn) {
    currentSuite.beforeEachHooks.push(fn);
  };

  global.it = function (title, fn) {
    currentSuite.tests.push({ title, fn });
  };

  require("../test/TetrakisToken.test.cjs");

  const connection = await startLocalEvm();
  let passed = 0;
  let failed = 0;

  try {
    const provider = new ethers.JsonRpcProvider(connection.url, 31337, { staticNetwork: true });
    provider.pollingInterval = 20;

    const signers = await provider.listAccounts();
    setActiveEnvironment(provider, signers);

    for (const suite of suites) {
      console.log(`\n  ${suite.title}`);
      for (const testCase of suite.tests) {
        try {
          for (const hook of suite.beforeEachHooks) {
            await hook();
          }
          await testCase.fn();
          passed++;
          console.log(`    ✔ ${testCase.title}`);
        } catch (err) {
          failed++;
          console.error(`    ✖ ${testCase.title}`);
          console.error(`      ${err.stack || err.message || err}`);
        }
      }
    }

    // Verify deploy.cjs on local Anvil EVM
    process.env.HARDHAT_LOCAL_EVM = "1";
    process.env.TREASURY_WORKER_ADDRESS = signers[1].address;
    const { main: runDeploy } = require("./deploy.cjs");
    const deployReceipt = await runDeploy();
    if (!deployReceipt.contractAddress || !deployReceipt.contractAddress.startsWith("0x")) {
      throw new Error("Local EVM deploy receipt missing contractAddress");
    }
    passed++;
    console.log(`    ✔ deploy.cjs nasadí TetrakisToken na EVM (${deployReceipt.contractAddress})`);

    provider.destroy();
  } finally {
    await connection.close();
  }

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
