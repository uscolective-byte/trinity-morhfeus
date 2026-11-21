require("./hardhat-runtime.cjs");
const { run } = require("hardhat");

async function main() {
  const contractAddress = process.env.TTK_CONTRACT_ADDRESS;
  const treasuryWorkerAddress = process.env.TREASURY_WORKER_ADDRESS;
  const initialSupplyTokens = Number(process.env.INITIAL_SUPPLY_TOKENS || 2_000_000);

  if (!contractAddress || !treasuryWorkerAddress) {
    throw new Error("TTK_CONTRACT_ADDRESS and TREASURY_WORKER_ADDRESS must be set for BaseScan verification.");
  }

  await run("verify:verify", {
    address: contractAddress,
    constructorArguments: [treasuryWorkerAddress, initialSupplyTokens],
  });
  console.log(`[RING 0] Kontrakt ${contractAddress} úspešne verifikovaný na BaseScan.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { main };
