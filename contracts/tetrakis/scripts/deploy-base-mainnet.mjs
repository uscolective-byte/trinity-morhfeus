#!/usr/bin/env node
/**
 * Tetrakis ($TTK) - Official Base Mainnet Production Deployer
 * Targets: Base Mainnet (Coinbase L2, ChainId: 8453)
 * Implements strict Truth Policy 2.1: NO FABRICATED TRANSACTIONS.
 */

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

const RAW_RPC_URL = process.env.BASE_MAINNET_RPC || 'https://mainnet.base.org';
const EXPECTED_CHAIN_ID = 8453n; // Base Mainnet
const BASTERIX_WALLET = '0x7e17f9072cfCbc7fE45973De0F11eC8db99281e4';
const OFFICIAL_TREASURY = '0x4d308452a96D7dAbFd2f33d92677A3a2724f387e';

function maskUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return 'https://mainnet.base.org';
  }
}

async function main() {
  const isBroadcast = process.argv.includes('--broadcast');
  const isDryRun = process.argv.includes('--dry-run') || !isBroadcast;

  console.log('====================================================');
  console.log('   TETRAKIS ($TTK) - BASE MAINNET (PROD) DEPLOYER    ');
  console.log('====================================================');
  console.log(`Execution Mode:    ${isBroadcast ? 'LIVE BROADCAST (REAL ON-CHAIN)' : 'DRY-RUN / VERIFY ONLY'}`);
  console.log(`Network RPC:       ${maskUrl(RAW_RPC_URL)}`);
  console.log(`Expected ChainId:  ${EXPECTED_CHAIN_ID} (Base Mainnet)`);
  console.log(`Basterix Custody:  ${BASTERIX_WALLET} (1,000,000 TTK)`);
  console.log(`Official Treasury: ${OFFICIAL_TREASURY} (999,000,000 TTK)`);
  console.log(`Total Supply:      1,000,000,000 TTK (10^27 wei)`);

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

  // Check Treasury on-chain balance on Base Mainnet
  const treasuryBalance = await provider.getBalance(OFFICIAL_TREASURY);
  const treasuryNonce = await provider.getTransactionCount(OFFICIAL_TREASURY);
  console.log(`Treasury Balance:  ${ethers.formatEther(treasuryBalance)} ETH (${treasuryBalance.toString()} wei)`);
  console.log(`Treasury Nonce:    ${treasuryNonce}`);

  // Dynamic Gas Estimation
  let estimatedGasUnits = 600_000n;
  try {
    const dynamicEstimate = await provider.estimateGas({
      from: OFFICIAL_TREASURY,
      data: artifact.bytecode
    });
    estimatedGasUnits = (dynamicEstimate * 120n) / 100n;
    console.log(`Gas Estimation:    Dynamic (${dynamicEstimate} + 20% buffer = ${estimatedGasUnits} units)`);
  } catch {
    console.log(`Gas Estimation:    Nominal (${estimatedGasUnits} units)`);
  }

  const feeData = await provider.getFeeData();
  const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice || 100_000_000n;
  const estimatedCostWei = estimatedGasUnits * maxFeePerGas;
  console.log(`Max Fee Per Gas:   ${ethers.formatUnits(maxFeePerGas, 'gwei')} gwei`);
  console.log(`Estimated Cost:    ~${ethers.formatEther(estimatedCostWei)} ETH on Base`);

  const planReceipt = {
    timestamp: new Date().toISOString(),
    network: 'Base Mainnet (Production)',
    chainId: Number(EXPECTED_CHAIN_ID),
    contract: 'TetrakisToken',
    symbol: 'TTK',
    initialTreasury: OFFICIAL_TREASURY,
    totalSupply: '1,000,000,000 TTK (10^27 wei)',
    status: treasuryBalance >= estimatedCostWei ? 'READY_FOR_BROADCAST' : 'AWAITING_GAS_FUNDING',
    treasuryBalanceWei: treasuryBalance.toString(),
    treasuryBalanceEth: ethers.formatEther(treasuryBalance),
    estimatedDeploymentCostWei: estimatedCostWei.toString(),
    estimatedDeploymentCostEth: ethers.formatEther(estimatedCostWei),
    bytecodeSha256: artifact.bytecodeSha256,
    runtimeKeccak256: artifact.runtimeKeccak256,
    explorer: `https://basescan.org/address/${OFFICIAL_TREASURY}`
  };

  const receiptPath = path.resolve(__dirname, '../build/deploy-plan-base-mainnet.json');
  fs.writeFileSync(receiptPath, JSON.stringify(planReceipt, null, 2));
  console.log(`Saved Base Mainnet plan to: ${receiptPath}`);

  if (treasuryBalance < estimatedCostWei) {
    console.log('\n----------------------------------------------------');
    console.log('STATUS: [BASE MAINNET DEPLOYMENT - AWAITING GAS FUNDING]');
    console.log(`Treasury ${OFFICIAL_TREASURY} has ${ethers.formatEther(treasuryBalance)} ETH on Base Mainnet.`);
    console.log(`Required gas for deployment is only ~${ethers.formatEther(estimatedCostWei)} ETH (~$0.02 - $0.05).`);
    console.log(`Fund the Treasury address: ${OFFICIAL_TREASURY} with a few cents of Base ETH to broadcast.`);
    console.log('----------------------------------------------------');
    return;
  }

  if (isDryRun) {
    console.log('\n[DRY-RUN COMPLETE] Treasury has sufficient funds. Run with --broadcast to deploy live on Base Mainnet.');
    return;
  }

  // Live Broadcast execution
  let privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey && fs.existsSync(secretPath)) {
    const secretData = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
    privateKey = secretData.wallet?.private_key || secretData.privateKey;
  }

  if (!privateKey) {
    console.error('No private key available (set DEPLOYER_PRIVATE_KEY or fund .secrets/tetrakis-treasury.json).');
    process.exit(1);
  }

  const deployerWallet = new ethers.Wallet(privateKey, provider);
  if (deployerWallet.address.toLowerCase() !== OFFICIAL_TREASURY.toLowerCase()) {
    console.error(`Deployer wallet ${deployerWallet.address} does not match official Treasury ${OFFICIAL_TREASURY}.`);
    process.exit(1);
  }

  console.log('\n[REAL TRANSACTION] Broadcasting deployment transaction to Base Mainnet...');
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployerWallet);
  const contract = await factory.deploy();
  const txHash = contract.deploymentTransaction().hash;
  console.log(`Transaction Hash:  ${txHash}`);
  console.log(`Track on Basescan: https://basescan.org/tx/${txHash}`);
  console.log('Waiting for block confirmation...');
  const txReceipt = await contract.deploymentTransaction().wait(2);

  if (!txReceipt || txReceipt.status !== 1) {
    console.error('Transaction failed or was reverted on-chain.');
    process.exit(1);
  }

  const contractAddress = await contract.getAddress();
  const confirmedBlock = txReceipt.blockNumber;
  console.log(`\n🎉 SUCCESS! Tetrakis ($TTK) is LIVE on Base Mainnet at: ${contractAddress}`);
  console.log(`Confirmed in Block: ${confirmedBlock}`);
  console.log(`Basescan Link: https://basescan.org/token/${contractAddress}`);

  // Post-deployment chain verification
  console.log('Executing post-deployment read verification via verifyTetrakis...');
  const verification = await verifyTetrakis(provider, {
    address: contractAddress,
    chainId: 8453,
    transactionHash: txHash,
    expectedRuntimeHash: artifact.runtimeKeccak256,
    expectInitialAllocation: true
  });

  const liveReceipt = {
    ...verification,
    network: 'Base Mainnet',
    chainId: 8453,
    contractAddress,
    deployer: deployerWallet.address,
    transactionHash: txHash,
    basescan: `https://basescan.org/token/${contractAddress}`,
    verified: true
  };

  const deployedReceiptPath = path.resolve(__dirname, '../build/deployed-receipt-base-mainnet.json');
  fs.writeFileSync(deployedReceiptPath, JSON.stringify(liveReceipt, null, 2));
  console.log(`Wrote verified deployment receipt to ${deployedReceiptPath}`);
}

main().catch(err => {
  console.error('Fatal error in Base Mainnet deployer:', err);
  process.exit(1);
});
