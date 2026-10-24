import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';
import { verifyTetrakis } from '../../../scripts/verify-tetrakis.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');
const artifactPath = path.resolve(__dirname, '../build/TetrakisToken.json');
const secretPath = path.resolve(rootDir, '.secrets/tetrakis-treasury.json');

const RAW_RPC_URL = process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org';
const EXPECTED_CHAIN_ID = 84532n; // Base Sepolia Testnet
const OFFICIAL_TREASURY = '0x4d308452a96D7dAbFd2f33d92677A3a2724f387e';

function maskUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return 'https://sepolia.base.org';
  }
}

async function main() {
  const isBroadcast = process.argv.includes('--broadcast');
  const isDryRun = process.argv.includes('--dry-run') || !isBroadcast;

  console.log('====================================================');
  console.log('   TETRAKIS ($TTK) - BASE SEPOLIA TESTNET DEPLOYER   ');
  console.log('====================================================');
  console.log(`Execution Mode:    ${isBroadcast ? 'LIVE BROADCAST' : 'DRY-RUN / VERIFY ONLY'}`);
  console.log(`Network RPC:       ${maskUrl(RAW_RPC_URL)}`);
  console.log(`Expected ChainId:  ${EXPECTED_CHAIN_ID} (Base Sepolia Testnet)`);
  console.log(`Official Treasury: ${OFFICIAL_TREASURY}`);

  if (!fs.existsSync(artifactPath)) {
    console.error(`Artifact missing at ${artifactPath}. Run npm run compile first.`);
    process.exit(1);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  const provider = new ethers.JsonRpcProvider(RAW_RPC_URL);
  const network = await provider.getNetwork();
  console.log(`Connected ChainId: ${network.chainId} (Hex: 0x${network.chainId.toString(16)})`);

  if (network.chainId !== EXPECTED_CHAIN_ID) {
    console.error(`ChainId mismatch! Expected ${EXPECTED_CHAIN_ID}, got ${network.chainId}. Aborting deployment.`);
    process.exit(1);
  }

  // Check Treasury on-chain balance
  const treasuryBalance = await provider.getBalance(OFFICIAL_TREASURY);
  const treasuryNonce = await provider.getTransactionCount(OFFICIAL_TREASURY);
  console.log(`Treasury Balance:  ${ethers.formatEther(treasuryBalance)} ETH (${treasuryBalance.toString()} wei)`);
  console.log(`Treasury Nonce:    ${treasuryNonce}`);

  // Dynamic Gas Estimation with fallback
  let estimatedGasUnits = 1_500_000n;
  try {
    const dynamicEstimate = await provider.estimateGas({
      from: OFFICIAL_TREASURY,
      data: artifact.bytecode
    });
    // Add 20% safety margin for deployment buffer
    estimatedGasUnits = (dynamicEstimate * 120n) / 100n;
    console.log(`Gas Estimation:    Dynamic (${dynamicEstimate} + 20% buffer = ${estimatedGasUnits} units)`);
  } catch {
    console.log(`Gas Estimation:    Fallback nominal (${estimatedGasUnits} units)`);
  }

  const feeData = await provider.getFeeData();
  const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice || 1_000_000_000n;
  const estimatedCostWei = estimatedGasUnits * maxFeePerGas;
  console.log(`Max Fee Per Gas:   ${ethers.formatUnits(maxFeePerGas, 'gwei')} gwei`);
  console.log(`Estimated Cost:    ~${ethers.formatEther(estimatedCostWei)} testnet ETH`);

  // Check if treasury has enough funds for gas
  if (treasuryBalance < estimatedCostWei) {
    console.log('\n----------------------------------------------------');
    console.log('STATUS: [TESTNET DEPLOYMENT BLOCKED - INSUFFICIENT GAS]');
    console.log(`Treasury ${OFFICIAL_TREASURY} has ${ethers.formatEther(treasuryBalance)} ETH on Base Sepolia.`);
    console.log(`Minimum required for contract deployment is ~${ethers.formatEther(estimatedCostWei)} testnet ETH.`);
    console.log('Action: Request free Base Sepolia testnet ETH from:');
    console.log('  - https://faucets.chain.link/base-sepolia');
    console.log('  - https://www.alchemy.com/faucets/base-sepolia');
    console.log('----------------------------------------------------');

    const planReceipt = {
      timestamp: new Date().toISOString(),
      network: 'Base Sepolia Testnet',
      chainId: Number(EXPECTED_CHAIN_ID),
      contract: 'TetrakisToken',
      symbol: 'TTK',
      initialTreasury: OFFICIAL_TREASURY,
      totalSupply: '1,000,000,000 TTK (10^27 wei)',
      status: 'PLAN_GENERATED_AWAITING_TESTNET_GAS',
      treasuryBalanceWei: treasuryBalance.toString(),
      estimatedDeploymentCostWei: estimatedCostWei.toString(),
      bytecodeSha256: artifact.bytecodeSha256,
      runtimeKeccak256: artifact.runtimeKeccak256
    };

    const receiptPath = path.resolve(__dirname, '../build/deploy-plan-receipt.json');
    fs.writeFileSync(receiptPath, JSON.stringify(planReceipt, null, 2));
    console.log(`Saved deployment plan to ${receiptPath}`);
    return;
  }

  if (isDryRun) {
    console.log('\n[DRY-RUN COMPLETE] Pre-flight checks passed. Add --broadcast to execute live transaction.');
    return;
  }

  // ONLY read credentials if explicitly in live broadcast mode AND funded!
  if (!fs.existsSync(secretPath)) {
    console.error(`Keystore file not found at ${secretPath}. Aborting broadcast.`);
    process.exit(1);
  }

  let deployerWallet;
  try {
    const secretData = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
    const privKey = secretData.wallet?.private_key || secretData.privateKey;
    const addr = secretData.wallet?.address || secretData.address;
    if (!privKey || !addr || addr.toLowerCase() !== OFFICIAL_TREASURY.toLowerCase()) {
      console.error('Keystore address does not match official Treasury. Aborting broadcast.');
      process.exit(1);
    }
    deployerWallet = new ethers.Wallet(privKey, provider);
    if (deployerWallet.address.toLowerCase() !== OFFICIAL_TREASURY.toLowerCase()) {
      console.error('Derived deployer wallet address does not match official Treasury. Aborting broadcast.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Failed to parse keystore securely:', err.message);
    process.exit(1);
  }

  console.log('\nBroadcasting deployment transaction to Base Sepolia...');
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployerWallet);
  const contract = await factory.deploy();
  const txHash = contract.deploymentTransaction().hash;
  console.log(`Transaction Hash:  ${txHash}`);
  console.log('Waiting for block confirmation...');
  const txReceipt = await contract.deploymentTransaction().wait();

  if (!txReceipt || txReceipt.status !== 1) {
    console.error('Transaction failed or was reverted on-chain.');
    process.exit(1);
  }

  const contractAddress = await contract.getAddress();
  const confirmedBlock = txReceipt.blockNumber;
  console.log(`SUCCESS! Tetrakis ($TTK) deployed at: ${contractAddress}`);
  console.log(`Confirmed in Block: ${confirmedBlock}`);

  // Post-deployment chain verification using independent verifyTetrakis verifier
  console.log('Executing post-deployment read verification via verifyTetrakis...');
  const verification = await verifyTetrakis(provider, {
    address: contractAddress,
    transactionHash: txHash,
    expectedRuntimeHash: artifact.runtimeKeccak256,
    expectInitialAllocation: true
  });

  console.log(`[VERIFIED] Name: ${verification.name}, Symbol: ${verification.symbol}, Decimals: ${verification.decimals}`);
  console.log(`[VERIFIED] Total Supply: ${verification.totalSupply}`);
  console.log(`[VERIFIED] Treasury Allocation: ${verification.treasuryBalance}`);
  console.log(`[VERIFIED] Runtime Bytecode Keccak: ${verification.runtimeHash}`);

  const liveReceipt = {
    ...verification,
    deployer: deployerWallet.address,
    verified: true
  };

  const receiptPath = path.resolve(__dirname, '../build/deployed-receipt-base-sepolia.json');
  fs.writeFileSync(receiptPath, JSON.stringify(liveReceipt, null, 2));
  console.log(`Wrote verified deployment receipt to ${receiptPath}`);
}

main().catch(err => {
  console.error('Fatal error in deployer:', err);
  process.exit(1);
});
