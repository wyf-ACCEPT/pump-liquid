// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

contract LiquidCashier is AccessControlUpgradeable {

    // ============================= Constants =============================


    // ============================= Parameters ============================

    address public vault;


    // ============================== Storage ==============================


    // =============================== Events ==============================


    // ======================= Modifier & Initializer ======================


    // =========================== View functions ==========================


    // ========================== Write functions ==========================


    // ====================== Write functions - admin ======================
    




    function initialize() public initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());

        // _setRoleAdmin(LIQUIDITY_MANAGER_ROLE, DEFAULT_ADMIN_ROLE);
    }

}