// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interface.sol";
import "./constants.sol";

using SafeERC20 for IERC20;


contract LiquidVault is AccessControlUpgradeable, ERC20Upgradeable, ILiquidVault, Constants {
    
    // ============================= Parameters ============================

    address public cashier;


    // ======================= Modifier & Initializer ======================

    function initialize(string memory name, string memory symbol) public initializer {
        __AccessControl_init();
        __ERC20_init(name, symbol);

        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setRoleAdmin(CASHIER_ROLE, DEFAULT_ADMIN_ROLE);
    }


    // ============================== Internal =============================

    function _update(address from, address to, uint256 value) internal override {
        require(
            from == address(0) || to == address(0), 
            "LIQUID_VAULT: transfer not allowed"
        );
        super._update(from, to, value);
    }


    // ========================== Write functions ==========================

    function depositToVault(
        address from, address asset, uint256 assetAmount, uint256 shareAmount
    ) public onlyRole(CASHIER_ROLE) {
        if (assetAmount > 0) 
            IERC20(asset).safeTransferFrom(from, address(this), assetAmount);
        if (shareAmount > 0) 
            _mint(from, shareAmount);
    }

    function withdrawFromVault(
        address to, address asset, uint256 shareAmount, uint256 assetAmount
    ) public onlyRole(CASHIER_ROLE) {
        if (shareAmount > 0) 
            _burn(to, shareAmount);
        if (assetAmount > 0) 
            IERC20(asset).safeTransfer(to, assetAmount);
    }


    // ====================== Write functions - admin ======================

    /**
     * @notice We use `reinitializer` to ensure that the `cashier` role is only set once.
     */
    function setCashier(address _cashier) public onlyRole(DEFAULT_ADMIN_ROLE) reinitializer(2) {
        cashier = _cashier;
        _grantRole(CASHIER_ROLE, cashier);
    }
}