// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/math/Math.sol";

import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import { WeightedMath } from "./lib/WeightedMath.sol";
import { ILiquidOracle, ILiquidVault } from "./interface.sol";


contract LiquidCashier is AccessControlUpgradeable, PausableUpgradeable {

    // =============================== Struct ==============================
    /**
     * @notice The `DepositInfo` struct aims to record the user's deposit information.
     *      If the user has deposited for multiple times, the `shares` should be the 
     *      sum of all the shares, and the `equivalentTimestamp` and `equivalentPrice` 
     *      should be the weighted average of all the deposits.
     */
    struct DepositInfo {
        uint256 shares;
        uint256 equivalentTimestamp;
        uint256 equivalentPrice;
    }

    struct PendingInfo {
        uint256 shares;
        uint256 timestamp;
    }


    // ============================= Constants =============================


    // ============================= Parameters ============================

    ILiquidVault public vault;
    ILiquidOracle public oracle;


    // ============================== Storage ==============================

    mapping(address => DepositInfo) public depositInfo;
    mapping(address => PendingInfo) public pendingInfo;


    // =============================== Events ==============================


    // ======================= Modifier & Initializer ======================

    function initialize() public initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());

        // _setRoleAdmin(LIQUIDITY_MANAGER_ROLE, DEFAULT_ADMIN_ROLE);
    }


    // =========================== View functions ==========================


    // ========================== Write functions ==========================

    /**
     * @notice Deposit the asset to the vault and record the user's deposit information.
     *      The user's deposit information should be updated with the weighted average
     *      of the old price(or timestamp) and the new price(or timestamp). This is also
     *      available for the first time deposit.
     */
    function deposit(address asset, uint256 assetAmount) public whenNotPaused {
        // Check conditions and deposit to the vault
        require(assetAmount > 0, "LIQUID_CASHIER: invalid amount");
        uint256 currentShares = vault.depositToVault(
            _msgSender(), address(this), asset, assetAmount
        );

        // Retrieve the user's old deposit information
        DepositInfo memory oldInfo = depositInfo[_msgSender()];

        // Update the user's deposit information
        depositInfo[_msgSender()].shares += currentShares;
        depositInfo[_msgSender()].equivalentTimestamp = WeightedMath.weightedAverage(
            oldInfo.equivalentTimestamp, block.timestamp, 
            oldInfo.shares, currentShares
        );
        depositInfo[_msgSender()].equivalentPrice = WeightedMath.weightedAverage(
            oldInfo.equivalentPrice, oracle.fetchShareStandardPrice(), 
            oldInfo.shares, currentShares
        );
    }

    // function requestWithdraw

    // function completeWithdraw


    // ====================== Write functions - admin ======================

    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
}