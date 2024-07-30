// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

contract LiquidCashier is AccessControlUpgradeable {
    
    address public vault;

    function initialize() public initializer {
        // TODO

        // __AccessControl_init();
        // _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        // _setRoleAdmin(PRICE_ORACLE_ROLE, DEFAULT_ADMIN_ROLE);
        // _setRoleAdmin(LIQUIDITY_MANAGER_ROLE, DEFAULT_ADMIN_ROLE);
    }

}