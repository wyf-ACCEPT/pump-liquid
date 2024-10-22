// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "./interface.sol";
import "./constants.sol";

using Math for uint256;


contract LiquidOracle is AccessControlUpgradeable, ILiquidOracle, Constants {

    // ============================= Parameters ============================
    
    uint256 public minimumUpdateInterval;


    // ============================== Storage ==============================

    /**
     * @notice `lastUpdateTime` records the timestamp of the last price update.
     *      The price updater has to wait for at least `minimumUpdateInterval` time.
     */
    uint256 public lastUpdateTime;

    /**
     * @notice We both use a `list` and a `dict` to store the supported assets.
     */
    address[] public supportedAssetList;
    mapping(address => bool) public isSupportedAsset;

    /**
     * @notice `assetPriceToShare` keeps the ASSET/SHARE price with 36 decimals, which
     *      means 1e36 unit of ASSET is equals to `assetPriceToShare[ASSET]` unit of SHARE.
     */
    mapping(address => uint256) public assetPriceToShare;

    /**
     * @notice `sharePriceToAsset` keeps the SHARE/ASSET price with 36 decimals, which
     *      means 1e36 unit of SHARE is equals to `sharePriceToAsset[ASSET]` unit of ASSET.
     */
    mapping(address => uint256) public sharePriceToAsset;


    // =============================== Events ==============================

    event AssetAdded(address indexed asset);
    event AssetRemoved(address indexed asset);
    event PricesUpdated(uint256[] prices);
    

    // ======================= Modifier & Initializer ======================

    function initialize() public initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());

        minimumUpdateInterval = 5 minutes;
    }

    modifier isSupported(address asset) {
        require(
            isSupportedAsset[asset] || asset == STANDARD_ASSET, 
            "LIQUID_ORACLE: asset not found"
        );
        _;
    }


    // =========================== View functions ==========================

    function isSupportedAssetExternal(address asset) public view returns (bool) {
        return isSupportedAsset[asset];
    }

    function assetPriceToShareExternal(address asset) public view returns (uint256) {
        return assetPriceToShare[asset];
    }

    function sharePriceToAssetExternal(address asset) public view returns (uint256) {
        return sharePriceToAsset[asset];
    }

    function getSupportedAssetsNum() public view returns (uint256) {
        return supportedAssetList.length;
    }

    function fetchShareStandardPrice() public view returns (uint256) {
        return sharePriceToAsset[STANDARD_ASSET];
    }

    function fetchAssetsPricesAll() public view returns (uint256[] memory) {
        uint256[] memory prices = new uint256[](supportedAssetList.length + 1);
        for (uint256 i = 0; i < supportedAssetList.length; i++) {
            prices[i] = assetPriceToShare[supportedAssetList[i]];
        }
        prices[supportedAssetList.length] = assetPriceToShare[STANDARD_ASSET];
        return prices;
    }

    function fetchSharePricesAll() public view returns (uint256[] memory) {
        uint256[] memory prices = new uint256[](supportedAssetList.length + 1);
        for (uint256 i = 0; i < supportedAssetList.length; i++) {
            prices[i] = sharePriceToAsset[supportedAssetList[i]];
        }
        prices[supportedAssetList.length] = sharePriceToAsset[STANDARD_ASSET];
        return prices;
    }

    function assetToShare(
        address asset, uint256 assetAmount
    ) public view isSupported(asset) returns (uint256) {
        require(isSupportedAsset[asset], "LIQUID_ORACLE: asset not found");
        return assetAmount.mulDiv(assetPriceToShare[asset], PRICE_PRECISION);
    }

    function shareToAsset(
        address asset, uint256 shareAmount
    ) public view isSupported(asset) returns (uint256) {
        require(isSupportedAsset[asset], "LIQUID_ORACLE: asset not found");
        return shareAmount.mulDiv(sharePriceToAsset[asset], PRICE_PRECISION);
    }


    // ====================== Write functions - assets =====================

    function addSupportedAsset(address asset) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!isSupportedAsset[asset], "LIQUID_ORACLE: asset already exists");
        require(asset != STANDARD_ASSET, "LIQUID_ORACLE: cannot add virtual address");
        require(
            IERC20(asset).totalSupply() != 0, 
            "LIQUID_ORACLE: invalid asset" // Ensure the asset is a valid ERC20 token
        );
        isSupportedAsset[asset] = true;
        supportedAssetList.push(asset);
        emit AssetAdded(asset);
    }

    function removeSupportedAsset(address asset) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isSupportedAsset[asset], "LIQUID_ORACLE: asset not found");
        isSupportedAsset[asset] = false;
        for (uint256 i = 0; i < supportedAssetList.length; i++) {
            if (supportedAssetList[i] == asset) {
                supportedAssetList[i] = supportedAssetList[supportedAssetList.length - 1];
                supportedAssetList.pop();
                break;
            }
        }
        emit AssetRemoved(asset);
    }


    // ====================== Write functions - oracle =====================

    /**
     * @param _assetsPricesToShare each asset's unit price in unit SHARE (with 
     *      36 decimals) order by the `supportedAssetList`, and with an extra
     *      element for the STANDARD_ASSET's unit price (e.g. USD's price to 
     *      SHARE). We assume that STANDARD_ASSET has 18 decimals.
     */
    function updatePrices(
        uint256[] memory _assetsPricesToShare
    ) public onlyRole(PRICE_UPDATER_ROLE) {
        uint256 length = supportedAssetList.length;
        require(
            _assetsPricesToShare.length == length + 1,
            "LIQUID_ORACLE: invalid input length"
        );
        require(
            block.timestamp - lastUpdateTime >= minimumUpdateInterval, 
            "LIQUID_ORACLE: update too frequently"
        );

        for (uint256 i = 0; i < length; i++) {
            assetPriceToShare[supportedAssetList[i]] = _assetsPricesToShare[i];
            sharePriceToAsset[supportedAssetList[i]] = PRICE_PRECISION.mulDiv(
                PRICE_PRECISION, _assetsPricesToShare[i]
            );
        }
        assetPriceToShare[STANDARD_ASSET] = _assetsPricesToShare[length];
        sharePriceToAsset[STANDARD_ASSET] = PRICE_PRECISION.mulDiv(
            PRICE_PRECISION, _assetsPricesToShare[length]
        );

        lastUpdateTime = block.timestamp;
        emit PricesUpdated(_assetsPricesToShare);
    }


    // ====================== Write functions - admin ======================

    function setPriceUpdater(address account, bool status) public onlyRole(DEFAULT_ADMIN_ROLE) {
        if (status) {
            _grantRole(PRICE_UPDATER_ROLE, account);
        } else {
            _revokeRole(PRICE_UPDATER_ROLE, account);
        }
    }

}