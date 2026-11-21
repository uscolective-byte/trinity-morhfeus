require("./hardhat-runtime.cjs");
const { ethers, run } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`[RING 0] Spúšťam deploy z peňaženky: ${deployer.address}`);

  const treasuryWorkerAddress = process.env.TREASURY_WORKER_ADDRESS || deployer.address;
  const initialSupplyTokens = 2_000_000; // 2 000 000 TTK do Ring 0 trezoru

  const Tetrakis = await ethers.getContractFactory("TetrakisToken");
  const ttk = await Tetrakis.deploy(treasuryWorkerAddress, initialSupplyTokens);

  await ttk.waitForDeployment();
  const contractAddress = await ttk.getAddress();

  console.log(`--------------------------------------------------`);
  console.log(`TETRAKIS ($TTK) ÚSPEŠNE NASADENÝ`);
  console.log(`Adresa kontraktu: ${contractAddress}`);
  console.log(`Treasury Worker:  ${treasuryWorkerAddress}`);
  console.log(`Initial Supply:   ${initialSupplyTokens} TTK`);
  console.log(`--------------------------------------------------`);

  // Počkáme 5 blokov na indexáciu siete pred spustením verifikácie
  console.log("Čakám na potvrdenie v block exploreri (5 blokov)...");
  const confirmBlocks = process.env.HARDHAT_LOCAL_EVM === "1" ? 1 : 5;
  await ttk.deploymentTransaction().wait(confirmBlocks);

  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: [treasuryWorkerAddress, initialSupplyTokens],
    });
    console.log("Zdrojový kód úspešne verifikovaný na BaseScan!");
  } catch (err) {
    console.log("Verifikáciu je možné spustiť manuálne neskôr:", err.message);
  }

  return { contractAddress, treasuryWorkerAddress, initialSupplyTokens };
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { main };
