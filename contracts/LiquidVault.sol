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

    address public feeReceiverDefault;            // Address of liquid-vault fee receiver
    address public feeReceiverThirdParty;         // Address of third-party fee receiver
    uint256 public feeRatioManagement;            // Fee ratio of management fee for third-party receiver
    uint256 public feeRatioPerformance;           // Fee ratio of performance fee for third-party receiver
    uint256 public feeRatioExit;                  // Fee ratio of exit fee for third-party receiver


    // =============================== Events ==============================

    event FeeDistributedFixRatio(
        address indexed asset, address vanillaTo, address thirdPartyTo,
        uint256 feeAmount, uint256 vanillaFee, uint256 thirdPartyFee
    );
    event FeeRatioUpdate(string key, uint256 value);
    event FeeReceiverUpdate(string key, address value);


    // ======================= Modifier & Initializer ======================

    function initialize(string memory name, string memory symbol) public initializer {
        __AccessControl_init();
        __ERC20_init(name, symbol);

        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setRoleAdmin(CASHIER_ROLE, DEFAULT_ADMIN_ROLE);

        feeRatioManagement = 0;
        feeRatioPerformance = 0;
        feeRatioExit = 0;
    }


    // ============================== Internal =============================

    function _update(address from, address to, uint256 value) internal override {
        require(
            from == address(0) || to == address(0), 
            "LIQUID_VAULT: transfer not allowed"
        );
        super._update(from, to, value);
    }

    function _fixRatioDistributeFee(address asset, uint256 feeAmount, uint256 thirdPartyRatio) internal {
        uint256 thirdPartyFee = feeAmount * thirdPartyRatio / 10000;
        uint256 defaultFee = feeAmount - thirdPartyFee;

        IERC20(asset).safeTransfer(feeReceiverThirdParty, thirdPartyFee);
        IERC20(asset).safeTransfer(feeReceiverDefault, defaultFee);

        emit FeeDistributedFixRatio(
            asset, feeReceiverDefault, feeReceiverThirdParty, 
            feeAmount, defaultFee, thirdPartyFee
        );
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
        address asset, uint256 feeManagement, uint256 feePerformance, uint256 feeExit
    ) public onlyRole(CASHIER_ROLE) {
        require(feeReceiverDefault != address(0), "LIQUID_VAULT: default fee receiver not set");
        require(feeReceiverThirdParty != address(0), "LIQUID_VAULT: third-party fee receiver not set");

        if (feeManagement > 0)
            _fixRatioDistributeFee(asset, feeManagement, feeRatioManagement);
        if (feePerformance > 0)
            _fixRatioDistributeFee(asset, feePerformance, feeRatioPerformance);
        if (feeExit > 0)
            _fixRatioDistributeFee(asset, feeExit, feeRatioExit);
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

    function setLiquidityManager(
        address account, bool status
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        if (status) {
            _grantRole(LIQUIDITY_MANAGER_ROLE, account);
        } else {
            _revokeRole(LIQUIDITY_MANAGER_ROLE, account);
        }
    }

    function setFeeReceiverDefault(address account) public onlyRole(DEFAULT_ADMIN_ROLE) {
        feeReceiverDefault = account;
        emit FeeReceiverUpdate("feeReceiverDefault", account);
    }

    function setFeeReceiverThirdParty(address account) public onlyRole(DEFAULT_ADMIN_ROLE) {
        feeReceiverThirdParty = account;
        emit FeeReceiverUpdate("feeReceiverThirdParty", account);
    }

    function setFeeRatio(string memory key, uint256 value) public onlyRole(DEFAULT_ADMIN_ROLE) {
        bytes32 keyHash = keccak256(abi.encodePacked(key));
        require(value <= 10000, "LIQUID_VAULT: invalid fee ratio, should be less than 10000");
        if (keyHash == keccak256("feeRatioManagement")) {
            feeRatioManagement = value;
        } else if (keyHash == keccak256("feeRatioPerformance")) {
            feeRatioPerformance = value;
        } else if (keyHash == keccak256("feeRatioExit")) {
            feeRatioExit = value;
        } else {
            revert("LIQUID_VAULT: invalid key");
        }
        emit FeeRatioUpdate(key, value);
    }
}
