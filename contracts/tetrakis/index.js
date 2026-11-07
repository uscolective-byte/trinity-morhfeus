/**
 * Tetrakis ($TTK) Official ERC-20 Smart Contract SDK
 * Trinity Sovereign Autonomous Architecture
 * Author: Basterix (Root Architect)
 */

import { Contract, ContractFactory } from 'ethers';
import artifact from './build/TetrakisToken.json' with { type: 'json' };

export const TETRAKIS_NAME = 'Tetrakis';
export const TETRAKIS_SYMBOL = 'TTK';
export const TETRAKIS_DECIMALS = 18;
export const TETRAKIS_TOTAL_SUPPLY = 1_000_000_000n * 10n ** 18n;
export const BASTERIX_WALLET = '0x7e17f9072cfCbc7fE45973De0F11eC8db99281e4';
export const BASTERIX_ALLOCATION = 1_000_000n * 10n ** 18n;
export const OFFICIAL_TREASURY = '0x4d308452a96D7dAbFd2f33d92677A3a2724f387e';
export const TREASURY_ALLOCATION = 999_000_000n * 10n ** 18n;

export const ABI = artifact.abi;
export const BYTECODE = artifact.bytecode;
export const DEPLOYED_BYTECODE = artifact.deployedBytecode;
export const RUNTIME_KECCAK256 = artifact.runtimeKeccak256 || '0x3d8a3c7a764f1b12aa17052d6d8772e1924a3395c1ffd52024891f5e794bb705';

export function getTetrakisContract(address, signerOrProvider) {
  return new Contract(address, ABI, signerOrProvider);
}

export function getTetrakisFactory(signer) {
  return new ContractFactory(ABI, BYTECODE, signer);
}

export default {
  name: TETRAKIS_NAME,
  symbol: TETRAKIS_SYMBOL,
  decimals: TETRAKIS_DECIMALS,
  totalSupply: TETRAKIS_TOTAL_SUPPLY,
  basterixWallet: BASTERIX_WALLET,
  basterixAllocation: BASTERIX_ALLOCATION,
  treasury: OFFICIAL_TREASURY,
  treasuryAllocation: TREASURY_ALLOCATION,
  abi: ABI,
  bytecode: BYTECODE,
  runtimeKeccak256: RUNTIME_KECCAK256,
  getContract: getTetrakisContract,
  getFactory: getTetrakisFactory
};
