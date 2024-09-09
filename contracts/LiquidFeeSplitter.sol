// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./constants.sol";

using SafeERC20 for IERC20;

contract LiquidFeeSplitter is AccessControlUpgradeable, Constants {

    // ============================= Parameters ============================

    address public vanillaTo;
    address public thirdPartyTo;
    uint256 public thirdPartyRatio;
    
    function initialize() public initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setRoleAdmin(FEE_SPLIT_MANAGER, DEFAULT_ADMIN_ROLE);

        thirdPartyRatio = 4000;     // Default to 40%
    }


    // =============================== Events ==============================

    event FeeDistributedVanilla(
        address indexed asset, address vanillaTo, uint256 feeAmount
    );
    event FeeDistributedFixRatio(
        address indexed asset, address vanillaTo, address thirdPartyTo,
        uint256 feeAmount, uint256 vanillaFee, uint256 thirdPartyFee
    );
    event VanillaToSet(address vanillaTo);
    event ThirdPartyToSet(address thirdPartyTo);
    event ThirdPartyRatioSet(uint256 thirdPartyRatio);


    // ========================== Write functions ==========================

    function vanillaFeeDistribute(IERC20 asset, uint256 feeAmount) public {
        require(vanillaTo != address(0), "LIQUID_FEESPLITTER: vanillaTo not set");
        asset.safeTransferFrom(_msgSender(), vanillaTo, feeAmount);
        emit FeeDistributedVanilla(address(asset), vanillaTo, feeAmount);
    }

    function fixRatioFeeDistribute(IERC20 asset, uint256 feeAmount) public {
        require(vanillaTo != address(0), "LIQUID_FEESPLITTER: vanillaTo not set");
        require(thirdPartyTo != address(0), "LIQUID_FEESPLITTER: thirdPartyTo not set");

        uint256 thirdPartyFee = feeAmount * thirdPartyRatio / 10000;
        uint256 vanillaFee = feeAmount - thirdPartyFee;

        asset.safeTransferFrom(_msgSender(), thirdPartyTo, thirdPartyFee);
        asset.safeTransferFrom(_msgSender(), vanillaTo, vanillaFee);

        emit FeeDistributedFixRatio(
            address(asset), vanillaTo, thirdPartyTo, 
            feeAmount, vanillaFee, thirdPartyFee
        );
    }


    // =================== Write functions - fee manager ===================

    function setVanillaTo(address _vanillaTo) public onlyRole(FEE_SPLIT_MANAGER) {
        vanillaTo = _vanillaTo;
        emit VanillaToSet(_vanillaTo);
    }
    
    function setThirdPartyTo(address _thirdPartyTo) public onlyRole(FEE_SPLIT_MANAGER) {
        thirdPartyTo = _thirdPartyTo;
        emit ThirdPartyToSet(_thirdPartyTo);
    }

    function setThirdPartyRatio(uint256 _thirdPartyRatio) public onlyRole(FEE_SPLIT_MANAGER) {
        thirdPartyRatio = _thirdPartyRatio;
        emit ThirdPartyRatioSet(_thirdPartyRatio);
    }

    
    // ====================== Write functions - admin ======================

    function setFeeSplitManager(
        address account, bool status
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        if (status) {
            grantRole(FEE_SPLIT_MANAGER, account);
        } else {
            revokeRole(FEE_SPLIT_MANAGER, account);
        }
    }

}