// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

using SafeERC20 for IERC20;


contract LiquidVault is AccessControlUpgradeable, ERC20Upgradeable {
    
    // ============================= Constants =============================

    /**
     * @notice The `PRICE_UPDATER_ROLE` is used to update the prices of the supported assets.
     *      Value: keccak256("LiquidOracle: CASHIER_ROLE")
     */
    bytes32 public constant CASHIER_ROLE = 
        0x221521cde999556f90cf8fca8f8f7fed9d3f3b1780d7cbeb187478038f4213ac;


    // ============================= Parameters ============================

    address public oracle;
    address public cashier;


    // ======================= Modifier & Initializer ======================

    function initialize(string memory name, string memory symbol) public initializer {
        __AccessControl_init();
        __ERC20_init(name, symbol);

        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setRoleAdmin(CASHIER_ROLE, DEFAULT_ADMIN_ROLE);
        
        // oracle = ILiquidOracle(_oracle);
        // cashier = _cashier;
        // _grantRole(CASHIER_ROLE, cashier);
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
        address from, address to, address asset, uint256 assetAmount, uint256 shareAmount
    ) public onlyRole(CASHIER_ROLE) {
        if (assetAmount > 0) 
            IERC20(asset).safeTransferFrom(from, address(this), assetAmount);
        if (shareAmount > 0) 
            _mint(to, shareAmount);
        // emit Deposit(from, asset, assetAmount, to, shareAmount);
    }

    function withdrawFromVault(
        address from, address to, address asset, uint256 shareAmount, uint256 assetAmount
    ) public onlyRole(CASHIER_ROLE) {
        if (shareAmount > 0) 
            _burn(from, shareAmount);
        if (assetAmount > 0) 
            IERC20(asset).safeTransfer(to, assetAmount);
        // emit Withdraw(from, asset, assetAmount, to, shareAmount);
    }

}