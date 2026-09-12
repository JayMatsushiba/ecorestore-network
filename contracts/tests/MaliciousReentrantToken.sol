// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface ISettleOnly {
    function settleDeed(uint256 deedId) external;
}

/**
 * @title MaliciousReentrantToken
 * @notice TEST-ONLY (contracts/tests/). Deliberately lives outside
 * contracts/RestorationDeed.sol's own directory as a test fixture, not a
 * deployable part of the Ecorestore Network application — it exists solely
 * to prove `RestorationDeed.settleDeed`'s `nonReentrant` guard actually
 * blocks a reentrant call attempted from within an ERC-20 `transfer` hook.
 * `transfer` calls back into a configured RestorationDeed's `settleDeed`
 * before completing, simulating a malicious/compromised settlement token.
 */
contract MaliciousReentrantToken is ERC20 {
    ISettleOnly public target;
    uint256 public targetDeedId;
    bool public attackArmed;

    constructor() ERC20("Malicious Reentrant Token (TEST ONLY)", "EVIL") {
        _mint(msg.sender, 1_000_000_000_000);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function configureAttack(address target_, uint256 deedId_) external {
        target = ISettleOnly(target_);
        targetDeedId = deedId_;
        attackArmed = true;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (attackArmed) {
            attackArmed = false; // fire once, avoid an unbounded call loop
            target.settleDeed(targetDeedId);
        }
        return super.transfer(to, amount);
    }
}
