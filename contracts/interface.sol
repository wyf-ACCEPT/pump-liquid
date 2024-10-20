// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILiquidOracle {
    function isSupportedAssetExternal(address) external view returns (bool);
    function assetPriceToShareExternal(address) external view returns (uint256);
    function sharePriceToAssetExternal(address) external view returns (uint256);
    function assetToShare(address, uint256) external view returns (uint256);
    function shareToAsset(address, uint256) external view returns (uint256);
    function fetchShareStandardPrice() external view returns (uint256);
}

interface ILiquidVault {
    function depositToVault(
        address from, address asset, uint256 assetAmount, uint256 shareAmount
    ) external;
    function withdrawFromVault(
        address to, address asset, uint256 shareAmount, uint256 assetAmount
    ) external;
    function distributeFee(
        address asset, uint256 feeManagement, uint256 feePerformance, uint256 feeExit
    ) external;
}
