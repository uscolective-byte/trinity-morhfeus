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
 * - Single Mint: 100% of supply minted upon creation directly into the official Trinity Treasury.
 * - No Minting: No subsequent mint functions or roles exist.
 * - Zero Taxes: No transaction fees, reflection, or token burns.
 * - Zero Censorship: No blacklist, pausable, or honeypot mechanics.
 * - Immutability: Not upgradable, no proxy layer.
 */
contract TetrakisToken is ERC20 {
    address public constant INITIAL_TREASURY = 0x4d308452a96D7dAbFd2f33d92677A3a2724f387e;
    uint256 public constant TOTAL_SUPPLY_CAP = 1_000_000_000 * 10 ** 18;

    constructor() ERC20("Tetrakis", "TTK") {
        require(INITIAL_TREASURY != address(0), "Tetrakis: treasury is zero address");
        _mint(INITIAL_TREASURY, TOTAL_SUPPLY_CAP);
    }
}
