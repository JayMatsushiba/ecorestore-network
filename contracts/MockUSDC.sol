// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice A LOCAL/TEST-ONLY ERC-20 token standing in for USDC in the M3
 * prototype. This is NOT USDC, NOT deployed by Circle, and NOT redeemable
 * for anything. It exists solely so `contracts/tests/` can fund and settle
 * RestorationDeed instances against a real ERC-20 interface (per the M3
 * prompt §8: "Do NOT implement a fake balance ledger... use an ERC-20
 * compatible interface... use a mock ERC-20 token").
 *
 * `decimals()` is fixed at 6 to match real USDC's token decimals, since
 * RestorationDeed's settlement-amount arithmetic assumes a 6-decimal
 * settlement asset (see RestorationDeed.sol's NatSpec on `unitPriceUSDC`).
 *
 * `mint` is unrestricted (anyone can mint any amount to any address). This
 * is intentional and would be a critical vulnerability in a real token —
 * it exists only so tests can set up sponsor/beneficiary balances
 * deterministically. Production deployments use the real, access-controlled
 * USDC contract on Arc, not this contract.
 */
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USD Coin (LOCAL TEST ONLY)", "mUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Test-only faucet. NEVER expose an unrestricted mint on a real token.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
