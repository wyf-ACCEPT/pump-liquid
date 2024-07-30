// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

contract LiquidVault is AccessControlUpgradeable, ERC20Upgradeable {
    
    using SafeERC20 for IERC20;

    address public oracle;
    address public cashier;

    // function depositInternal(
    //     address from, address to, address asset, uint256 assetAmount
    // ) internal {
    //     if (assetAmount > 0) IERC20(asset).safeTransferFrom(from, address(this), assetAmount);
    //     // _mint(to, shareAmount);
    //     // emit Deposit(from, address(asset), assetAmount, to, shareAmount);
    // }

    // function enter(address from, ERC20 asset, uint256 assetAmount, address to, uint256 shareAmount)
    //     external
    //     requiresAuth
    // {
    //     // Transfer assets in
    //     if (assetAmount > 0) asset.safeTransferFrom(from, address(this), assetAmount);

    //     // Mint shares.
    //     _mint(to, shareAmount);

    //     emit Enter(from, address(asset), assetAmount, to, shareAmount);
    // }

}