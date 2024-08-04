// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILiquidOracle {
    function isSupportedAsset(address) external view returns (bool);
    function assetPriceToShare(address) external view returns (uint256);
    function sharePriceToAsset(address) external view returns (uint256);
    function assetToShare(address, uint256) external view returns (uint256);
    function shareToAsset(address, uint256) external view returns (uint256);
    function fetchShareStandardPrice() external view returns (uint256);
}

interface ILiquidVault {
    function depositToVault(
        address from, address to, address asset, uint256 assetAmount
    ) external returns (uint256 shareAmount);
    function withdrawFromVault(
        address from, address to, address asset, uint256 shareAmount
    ) external returns (uint256 assetAmount);
}
