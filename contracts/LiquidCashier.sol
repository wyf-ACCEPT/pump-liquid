// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import { WeightedMath } from "./lib/WeightedMath.sol";

import "./LiquidOracle.sol";
import "./LiquidVault.sol";


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
        address asset;
        uint256 assetAmount;
    }


    // ============================= Constants =============================


    // ============================= Parameters ============================

    ILiquidVault public vault;
    ILiquidOracle public oracle;

    uint256 public withdrawPeriod;


    // ============================== Storage ==============================

    mapping(address => DepositInfo) public depositInfo;
    mapping(address => PendingInfo) public pendingInfo;


    // =============================== Events ==============================


    // ======================= Modifier & Initializer ======================

    function initialize() public initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());

        withdrawPeriod = 7 days;

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
        uint256 currentShares = oracle.assetToShare(asset, assetAmount);
        vault.depositToVault(
            _msgSender(), address(this), asset, assetAmount, currentShares
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

    /**
     * @notice Request to withdraw the asset from the vault and record the user's 
     *      pending information. When the pending withdraw is matured, the user can
     *      call `completeWithdraw` to get the asset.
     */
    function requestWithdraw(address asset, uint256 sharesAmount) public whenNotPaused {
        // Check conditions
        require(sharesAmount > 0, "LIQUID_CASHIER: invalid amount");
        require(pendingInfo[_msgSender()].shares == 0, "LIQUID_CASHIER: request exists");
        require(
            sharesAmount <= depositInfo[_msgSender()].shares, 
            "LIQUID_CASHIER: insufficient shares"
        );

        // Update the user's pending information
        uint256 assetAmount = oracle.shareToAsset(asset, sharesAmount);
        pendingInfo[_msgSender()] = PendingInfo({
            shares: sharesAmount,
            timestamp: block.timestamp,
            asset: asset,
            assetAmount: assetAmount
        });
    }

    /**
     * @notice Complete the withdraw request and get the asset from the vault.
     *      If the asset is removed from the vault during the withdraw period,
     *      the user won't be able to get the asset, and will still hold the shares.
     */
    function completeWithdraw() public whenNotPaused {
        // Check conditions
        require(pendingInfo[_msgSender()].shares > 0, "LIQUID_CASHIER: request not exists");
        require(
            block.timestamp - pendingInfo[_msgSender()].timestamp >= withdrawPeriod, 
            "LIQUID_CASHIER: still pending"
        );

        // Retrieve the user's pending information
        PendingInfo memory info = pendingInfo[_msgSender()];

        // Withdraw from the vault
        if (oracle.isSupportedAssetExternal(info.asset)) {
            // Release the asset to the user
            vault.withdrawFromVault(
                address(this), _msgSender(), info.asset, info.shares, info.assetAmount
            );
            depositInfo[_msgSender()].shares -= info.shares;
            // emit
        } else {
            // emit
        }

        // Clear the user's pending information
        delete pendingInfo[_msgSender()];
    }


    // ====================== Write functions - admin ======================

    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
}