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
    address public feeSplitter;


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
            IERC20(asset).safeTransferFrom(_msgSender(), address(this), assetAmount);
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

    function distributeFee(
        address asset, uint256 feeManagement, uint256 feePerformance, 
        uint256 feeExit, uint256 feeAll
    ) public onlyRole(CASHIER_ROLE) {
        IERC20(asset).approve(feeSplitter, feeAll);
        if (feeManagement > 0)
            ILiquidFeeSplitter(feeSplitter).vanillaFeeDistribute(asset, feeManagement);
        if (feePerformance > 0)
            ILiquidFeeSplitter(feeSplitter).fixRatioFeeDistribute(asset, feePerformance);
        if (feeExit > 0)
            ILiquidFeeSplitter(feeSplitter).vanillaFeeDistribute(asset, feeExit);
    }


    // ==================== Write functions - liquidity ====================

    function depositLiquidityDirectly(
        address asset, uint256 amount
    ) public onlyRole(LIQUIDITY_MANAGER_ROLE) {
        IERC20(asset).safeTransferFrom(_msgSender(), address(this), amount);
    }

    function withdrawLiquidityDirectly(
        address asset, uint256 amount
    ) public onlyRole(LIQUIDITY_MANAGER_ROLE) {
        IERC20(asset).safeTransfer(_msgSender(), amount);
    }


    // ====================== Write functions - admin ======================

    /**
     * @notice We use `reinitializer` to ensure that the `cashier` role is only set once.
     */
    function setCashier(
        address _cashier
    ) public onlyRole(DEFAULT_ADMIN_ROLE) reinitializer(2) {
        cashier = _cashier;
        _grantRole(CASHIER_ROLE, cashier);
    }

    /**
     * @notice We use `reinitializer` to ensure that the `feeSplitter` role is only set once.
     */
    function setFeeSplitter(
        address _feeSplitter
    ) public onlyRole(DEFAULT_ADMIN_ROLE) reinitializer(3) {
        feeSplitter = _feeSplitter;
    }

    function setLiquidityManager(
        address account, bool status
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        if (status) {
            _grantRole(LIQUIDITY_MANAGER_ROLE, account);
        } else {
            _revokeRole(LIQUIDITY_MANAGER_ROLE, account);
        }
    }
}