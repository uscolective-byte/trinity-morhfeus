import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

// Tests the canonical Tetrakis ($TTK) contract. Deployment credentials do not belong here.
export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    version: "0.8.24",
    settings: { evmVersion: "shanghai", optimizer: { enabled: true, runs: 200 } },
  },
});
