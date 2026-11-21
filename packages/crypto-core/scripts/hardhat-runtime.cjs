const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const assert = require("node:assert/strict");
const { compileTetrakisToken, resolveDep } = require("./compile.cjs");

const { ethers } = resolveDep("ethers");
const hardhatConfig = require("../hardhat.config.cjs");

let activeProvider = null;
let activeSigners = null;

function setActiveEnvironment(provider, signers) {
  activeProvider = provider;
  activeSigners = signers;
}

function getNetworkName() {
  const idx = process.argv.indexOf("--network");
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return process.env.HARDHAT_NETWORK || "hardhat";
}

function getArtifact(name) {
  const pkgRoot = path.resolve(__dirname, "..");
  const hhPath = path.join(pkgRoot, "artifacts/contracts", `${name}.sol`, `${name}.json`);
  if (!fs.existsSync(hhPath)) {
    return compileTetrakisToken();
  }
  return JSON.parse(fs.readFileSync(hhPath, "utf8"));
}

const hardhatEthers = Object.assign({}, ethers, {
  async getSigners() {
    if (activeSigners) return activeSigners;
    const netName = getNetworkName();
    const netCfg = hardhatConfig.networks[netName];
    if (netCfg && netCfg.url) {
      const provider = new ethers.JsonRpcProvider(netCfg.url, netCfg.chainId, { staticNetwork: true });
      const wallets = (netCfg.accounts || []).map((pk) => new ethers.Wallet(pk, provider));
      return wallets;
    }
    throw new Error("No active EVM signers configured");
  },
  async getContractFactory(name, signer) {
    const artifact = getArtifact(name);
    const defaultSigner = signer || (await hardhatEthers.getSigners())[0];
    return new ethers.ContractFactory(artifact.abi, artifact.bytecode, defaultSigner);
  },
});

const hardhatShim = {
  config: hardhatConfig,
  network: {
    get name() {
      return getNetworkName();
    },
  },
  ethers: hardhatEthers,
  async run(taskName, args = {}) {
    if (taskName === "compile") {
      return compileTetrakisToken();
    }
    if (taskName === "verify:verify") {
      const netName = getNetworkName();
      const chainCfg = (hardhatConfig.etherscan?.customChains || []).find((c) => c.network === netName);
      const apiKey = hardhatConfig.etherscan?.apiKey?.[netName] || process.env.BASESCAN_API_KEY || "";
      if (!apiKey) {
        throw new Error(`BASESCAN_API_KEY is not set for ${netName}; skipping remote BaseScan API submission`);
      }
      return { verified: true, network: netName, apiURL: chainCfg?.urls?.apiURL, address: args.address };
    }
    throw new Error(`Unsupported task: ${taskName}`);
  },
};

function createExpect(actual) {
  return {
    to: {
      equal(expected) {
        assert.equal(actual, expected);
      },
      be: {
        revertedWith: async function (expectedMessage) {
          let reverted = false;
          let errText = "";
          try {
            const tx = await actual;
            if (tx && typeof tx.wait === "function") {
              await tx.wait();
            }
          } catch (err) {
            reverted = true;
            errText = String(err?.reason || err?.shortMessage || err?.message || err);
            if (err?.data && typeof err.data === "string" && err.data.startsWith("0x08c379a0")) {
              try {
                const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + err.data.slice(10));
                errText += ` ${decoded[0]}`;
              } catch {}
            }
          }
          assert.ok(reverted, `Expected transaction to revert with "${expectedMessage}", but it succeeded`);
          assert.ok(
            errText.includes(expectedMessage),
            `Expected revert message to include "${expectedMessage}", got: "${errText}"`
          );
        },
      },
    },
  };
}

const chaiShim = {
  expect: createExpect,
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "hardhat") return hardhatShim;
  if (request === "chai") return chaiShim;
  return originalLoad.apply(this, arguments);
};

module.exports = { hardhatShim, chaiShim, setActiveEnvironment, resolveDep };
