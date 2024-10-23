// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/interfaces/IERC20.sol";

interface ILiquidOracle {
    function isSupportedAssetExternal(address) external view returns (bool);
    function assetPriceToShareExternal(address) external view returns (uint256);
    function sharePriceToAssetExternal(address) external view returns (uint256);
    function assetToShare(address, uint256) external view returns (uint256);
    function shareToAsset(address, uint256) external view returns (uint256);
    function fetchShareStandardPrice() external view returns (uint256);
}

interface ILiquidVault is IERC20 {
    function depositAsset(address asset, uint256 amount) external;
    function withdrawAsset(address asset, uint256 amount) external;
    function mintShares(address to, uint256 amount) external;
    function burnShares(address from, uint256 amount) external;
}
