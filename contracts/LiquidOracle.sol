// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// import "@openzeppelin/contracts/utils/structs/Checkpoints.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

using Math for uint256;

interface ILiquidOracle {
    function isSupportedAsset(address) external view returns (bool);

    function assetPriceToShare(address) external view returns (uint256);

    function sharePriceToAsset(address) external view returns (uint256);

    function assetToShare(address, uint256) external view returns (uint256);

    function shareToAsset(address, uint256) external view returns (uint256);
}


contract LiquidOracle is AccessControlUpgradeable {

    // ============================= Constants =============================
    /**
     * @notice Set `PRICE_PRECISION` to 1e36, which is equivalent to that we use a float 
     *      number with 36 decimals to represent the price. It's necessary to use such a
     *      high precision to avoid the precision loss during the calculation.
     * 
     *      For example, assume that the current $WBTC price is $56,236.78 (in USD), and 
     *      the current $SHARE price is $0.064 (in USD). If we omit the decimals, the price 
     *      of WBTC-SHARE pair would be WBTC/SHARE = 56,236.78 / 0.064 = 878699.6875, and 
     *      SHARE/WBTC = 1.138e-6.
     * 
     *      However, WBTC has 8 decimals and SHARE has 18 decimals, which means 1e8 unit WBTC
     *      is equals to (1e18 * 878699.6875) unit SHARE, that is: WBTC/SHARE = 8.7869969e15,
     *      and SHARE/WBTC = 1.13804524e-16. So when we use 36 decimals as price precision,
     *      we can represent the price as 8.7869969e51 and 1.13804524e20, which keeps enough
     *      precision for the calculation.
     */
    uint256 public constant PRICE_PRECISION = 1_000000_000000_000000_000000_000000_000000;

    /**
     * @notice The `PRICE_UPDATER_ROLE` is used to update the prices of the supported assets.
     *      Value: keccak256("LiquidOracle: PRICE_UPDATER_ROLE")
     */
    bytes32 public constant PRICE_UPDATER_ROLE = 
        0x80a030ace745e3f9b21b30d8f6ac315b0db7a572dca17866ddb1edc31df8099f;

    /**
     * @notice The virtual address that represents the `standard price`, usually for 
     *      recording SHARE's price in USD. Value:
     *      address(uint160(uint256(keccak256("LiquidOracle: STANDARD_ASSET"))))
     */
    address public constant STANDARD_ASSET = 0xFA0FFaA48dfB36b79A84C4d591cC91bC304fA13f;


    // ============================= Parameters ============================
    
    uint256 public minimumUpdateInterval;


    // ============================== Storage ==============================

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
    

    // ======================= Modifier & Initializer ======================

    function initialize() public initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());

        minimumUpdateInterval = 5 minutes;
    }

    modifier isSupported(address asset) {
        require(
            isSupportedAsset[asset] || asset == STANDARD_ASSET, 
            "PUMP_LIQUID_ORACLE: asset not found"
        );
        _;
    }


    // ====================== View functions - prices ======================

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
        require(isSupportedAsset[asset], "PUMP_LIQUID_ORACLE: asset not found");
        return assetAmount.mulDiv(assetPriceToShare[asset], PRICE_PRECISION);
    }

    function shareToAsset(
        address asset, uint256 shareAmount
    ) public view isSupported(asset) returns (uint256) {
        require(isSupportedAsset[asset], "PUMP_LIQUID_ORACLE: asset not found");
        return shareAmount.mulDiv(sharePriceToAsset[asset], PRICE_PRECISION);
    }


    // ====================== Write functions - assets =====================

    function addSupportedAsset(address asset) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!isSupportedAsset[asset], "PUMP_LIQUID_ORACLE: asset already exists");
        require(asset != STANDARD_ASSET, "PUMP_LIQUID_ORACLE: cannot add virtual address");
        require(
            IERC20(asset).totalSupply() != 0, 
            "PUMP_LIQUID_ORACLE: invalid asset" // Ensure the asset is a valid ERC20 token
        );
        isSupportedAsset[asset] = true;
        supportedAssetList.push(asset);
    }

    function removeSupportedAsset(address asset) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isSupportedAsset[asset], "PUMP_LIQUID_ORACLE: asset not found");
        isSupportedAsset[asset] = false;
        for (uint256 i = 0; i < supportedAssetList.length; i++) {
            if (supportedAssetList[i] == asset) {
                supportedAssetList[i] = supportedAssetList[supportedAssetList.length - 1];
                supportedAssetList.pop();
                break;
            }
        }
    }


    // ====================== Write functions - oracle =====================

    /**
     * @param assets the list of supported assets (in any order), and includes the 
     *      STANDARD_ASSET at the end.
     * @param _assetsPricesToShare each asset's unit price in unit SHARE 
     *      (with 36 decimals). We assume that STANDARD_ASSET has 18 decimals.
     */
    function updatePrices(
        address[] memory assets, uint256[] memory _assetsPricesToShare
    ) public onlyRole(PRICE_UPDATER_ROLE) {
        require(
            assets.length == _assetsPricesToShare.length && 
                assets.length == supportedAssetList.length + 1,
            "PUMP_LIQUID_ORACLE: invalid input length"
        );
        require(
            block.timestamp - lastUpdateTime >= minimumUpdateInterval, 
            "PUMP_LIQUID_ORACLE: update too frequently"
        );

        for (uint256 i = 0; i < assets.length; i++) {
            require(
                isSupportedAsset[assets[i]] || assets[i] == STANDARD_ASSET, 
                "PUMP_LIQUID_ORACLE: asset not found"
            );
            assetPriceToShare[assets[i]] = _assetsPricesToShare[i];
            sharePriceToAsset[assets[i]] = PRICE_PRECISION.mulDiv(
                PRICE_PRECISION, _assetsPricesToShare[i]
            );
        }
        lastUpdateTime = block.timestamp;
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