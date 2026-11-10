// TetrakisToken — JavaScript/TypeScript interface for Worker integration
// Use this in the Trinity Worker to interact with the deployed TTK contract on Base

export const TETRAKIS_ABI = [
  // Read functions
  { "inputs": [{ "name": "account", "type": "address" }], "name": "balanceOf", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "totalSupply", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "totalMinted", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "HARD_CAP", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "remainingMintable", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "decimals", "outputs": [{ "type": "uint8" }], "stateMutability": "pure", "type": "function" },
  { "inputs": [], "name": "symbol", "outputs": [{ "type": "string" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "name", "outputs": [{ "type": "string" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "owner", "type": "address" }, { "name": "spender", "type": "address" }], "name": "allowance", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "owner", "type": "address" }], "name": "nonces", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },

  // Write functions
  { "inputs": [{ "name": "to", "type": "address" }, { "name": "amount", "type": "uint256" }], "name": "transfer", "outputs": [{ "type": "bool" }], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "from", "type": "address" }, { "name": "to", "type": "address" }, { "name": "amount", "type": "uint256" }], "name": "transferFrom", "outputs": [{ "type": "bool" }], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "spender", "type": "address" }, { "name": "amount", "type": "uint256" }], "name": "approve", "outputs": [{ "type": "bool" }], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "to", "type": "address" }, { "name": "amount", "type": "uint256" }], "name": "mint", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "recipients", "type": "address[]" }, { "name": "amounts", "type": "uint256[]" }], "name": "batchMint", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "amount", "type": "uint256" }], "name": "burn", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "account", "type": "address" }, { "name": "amount", "type": "uint256" }], "name": "burnFrom", "outputs": [], "stateMutability": "nonpayable", "type": "function" },

  // ERC-2612 Permit (gasless approvals)
  { "inputs": [{ "name": "owner", "type": "address" }, { "name": "spender", "type": "address" }, { "name": "value", "type": "uint256" }, { "name": "deadline", "type": "uint256" }, { "name": "v", "type": "uint8" }, { "name": "r", "type": "bytes32" }, { "name": "s", "type": "bytes32" }], "name": "permit", "outputs": [], "stateMutability": "nonpayable", "type": "function" },

  // Events
  { "anonymous": false, "inputs": [{ "indexed": true, "name": "from", "type": "address" }, { "indexed": true, "name": "to", "type": "address" }, { "indexed": false, "name": "value", "type": "uint256" }], "name": "Transfer", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "name": "owner", "type": "address" }, { "indexed": true, "name": "spender", "type": "address" }, { "indexed": false, "name": "value", "type": "uint256" }], "name": "Approval", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "name": "to", "type": "address" }, { "indexed": false, "name": "amount", "type": "uint256" }, { "indexed": false, "name": "totalMinted", "type": "uint256" }], "name": "Minted", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": false, "name": "remaining", "type": "uint256" }], "name": "CapApproaching", "type": "event" },
] as const;

// ── Contract constants ──────────────────────────────────────────
export const TETRAKIS_CONFIG = {
  name: "Tetrakis",
  symbol: "TTK",
  decimals: 18,
  hardCap: "10000000000000000000000000", // 10,000,000 * 10^18 as string (BigInt-safe)
  chainId: 8453,                          // Base mainnet
  rpcUrl: "https://mainnet.base.org",
  explorer: "https://basescan.org",
  // Set after deployment:
  contractAddress: null as string | null,
};

// ── RPC helpers for Worker (read-only, no wallet needed) ─────────
// These use raw JSON-RPC eth_call — works from any Worker without ethers.js

/**
 * Get TTK balance of an address via Base RPC.
 * Uses eth_call with balanceOf(address) selector.
 */
export async function getTTKBalance(
  contractAddress: string,
  walletAddress: string,
  rpcUrl = TETRAKIS_CONFIG.rpcUrl
): Promise<string> {
  // balanceOf(address) = 0x70a08231
  const paddedAddr = walletAddress.replace("0x", "").toLowerCase().padStart(64, "0");
  const data = "0x70a08231" + paddedAddr;

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: contractAddress, data }, "latest"],
    }),
  });

  const json = await response.json();
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return BigInt(json.result || "0x0").toString();
}

/**
 * Get total supply of TTK.
 * totalSupply() = 0x18160ddd
 */
export async function getTTKTotalSupply(
  contractAddress: string,
  rpcUrl = TETRAKIS_CONFIG.rpcUrl
): Promise<string> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: contractAddress, data: "0x18160ddd" }, "latest"],
    }),
  });

  const json = await response.json();
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return BigInt(json.result || "0x0").toString();
}

/**
 * Get remaining mintable supply.
 * remainingMintable() = 0xa3c7dc11 (computed from selector)
 */
export async function getRemainingMintable(
  contractAddress: string,
  rpcUrl = TETRAKIS_CONFIG.rpcUrl
): Promise<string> {
  // remainingMintable() selector: keccak256("remainingMintable()")[:4]
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: contractAddress, data: "0xa3c7dc11" }, "latest"],
    }),
  });

  const json = await response.json();
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return BigInt(json.result || "0x0").toString();
}

/**
 * Get Transfer events from the contract (for transaction history).
 * Transfer(address,address,uint256) topic0 = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
 */
export async function getTransferEvents(
  contractAddress: string,
  fromBlock: string = "0x0",
  toBlock: string = "latest",
  rpcUrl = TETRAKIS_CONFIG.rpcUrl
): Promise<unknown[]> {
  const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getLogs",
      params: [{
        address: contractAddress,
        topics: [transferTopic],
        fromBlock,
        toBlock,
      }],
    }),
  });

  const json = await response.json();
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return json.result || [];
}

/**
 * Format raw wei balance to human-readable TTK.
 */
export function formatTTK(weiString: string): string {
  const balance = BigInt(weiString);
  const divisor = BigInt(10) ** BigInt(TETRAKIS_CONFIG.decimals);
  const whole = balance / divisor;
  const fraction = balance % divisor;
  const fractionStr = fraction.toString().padStart(TETRAKIS_CONFIG.decimals, "0").slice(0, 4);
  return `${whole.toString()}.${fractionStr}`;
}
