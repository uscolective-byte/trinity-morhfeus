// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title TetrakisToken ($TTK)
 * @dev Official ERC-20 Token for the Trinity Sovereign Autonomous Architecture.
 * Inherits standard, production-grade OpenZeppelin ERC20 implementation.
 *
 * Invariants & Tokenomics:
 * - Standard: OpenZeppelin ERC20 v5.1.0
 * - Fixed Supply: Exactly 1,000,000,000 TTK (1 Billion TTK with 18 decimals).
 * - Founder Custody: Exactly 1,000,000 TTK minted directly into Basterix's Sovereign Personal Wallet.
 * - Treasury & World Liquidity: 999,000,000 TTK minted into the Official Trinity Treasury for DEX pools.
 * - Single Mint: 100% of supply minted upon creation.
 * - No Minting: No subsequent mint functions or roles exist.
 * - Zero Taxes: No transaction fees, reflection, or token burns.
 * - Zero Censorship: No blacklist, pausable, or honeypot mechanics.
 * - Immutability: Not upgradable, no proxy layer.
 */
contract TetrakisToken is ERC20 {
    address public constant BASTERIX_WALLET = 0x7e17f9072cfCbc7fE45973De0F11eC8db99281e4;
    address public constant INITIAL_TREASURY = 0x4d308452a96D7dAbFd2f33d92677A3a2724f387e;

    uint256 public constant BASTERIX_ALLOCATION = 1_000_000 * 10 ** 18;
    uint256 public constant TREASURY_ALLOCATION = 999_000_000 * 10 ** 18;
    uint256 public constant TOTAL_SUPPLY_CAP = 1_000_000_000 * 10 ** 18;

    constructor() ERC20("Tetrakis", "TTK") {
        require(BASTERIX_WALLET != address(0), "Tetrakis: basterix wallet is zero");
        require(INITIAL_TREASURY != address(0), "Tetrakis: treasury is zero");
        _mint(BASTERIX_WALLET, BASTERIX_ALLOCATION);
        _mint(INITIAL_TREASURY, TREASURY_ALLOCATION);
    }
}
