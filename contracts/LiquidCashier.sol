// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/math/Math.sol";

import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import { ILiquidOracle, ILiquidVault } from "./interface.sol";

using Math for uint256;


contract LiquidCashier is AccessControlUpgradeable, PausableUpgradeable {

    // =============================== Struct ==============================
    /**
     * @notice The `UserInfo` struct is used to record the user's deposit information.
     *      If the user has deposited for multiple times, the `shares` should be the 
     *      sum of all the shares, and the `equivalentTimestamp` and `equivalentPrice` 
     *      should be the weighted average of all the deposits.
     */
    struct UserInfo {
        uint256 shares;
        uint256 equivalentTimestamp;
        uint256 equivalentPrice;
    }

    // ============================= Constants =============================


    // ============================= Parameters ============================

    ILiquidVault public vault;
    ILiquidOracle public oracle;


    // ============================== Storage ==============================

    mapping(address => UserInfo) public userInfo;


    // =============================== Events ==============================


    // ======================= Modifier & Initializer ======================

    function initialize() public initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());

        // _setRoleAdmin(LIQUIDITY_MANAGER_ROLE, DEFAULT_ADMIN_ROLE);
    }


    // =========================== View functions ==========================


    // ========================== Write functions ==========================

    function deposit(address asset, uint256 assetAmount) public whenNotPaused {
        // Check conditions and deposit to the vault
        require(assetAmount > 0, "LIQUID_CASHIER: invalid amount");
        uint256 currentShares = vault.depositToVault(
            _msgSender(), address(this), asset, assetAmount
        );

        // Retrieve the user's old deposit information
        UserInfo memory oldInfo = userInfo[_msgSender()];
        uint256 oldShares = oldInfo.shares;
        uint256 oldTs = oldInfo.equivalentTimestamp;
        uint256 oldPrice = oldInfo.equivalentPrice;

        // Calculate the equivalent timestamp (also available when `oldTs` is 0)
        uint256 newShares = oldShares + currentShares;
        uint256 newTs = oldTs + (block.timestamp - oldTs).mulDiv(currentShares, newShares);

        // Calculate the equivalent price (cost)
        uint256 currentPrice = oracle.fetchShareStandardPrice();
        uint256 newPrice = oldPrice.mulDiv(oldShares, newShares) + 
            currentPrice.mulDiv(currentShares, newShares);

        // Update the user's deposit information
        userInfo[_msgSender()] = UserInfo(newShares, newTs, newPrice);
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