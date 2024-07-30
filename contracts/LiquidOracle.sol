// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// import "@openzeppelin/contracts/utils/structs/Checkpoints.sol";

import "@openzeppelin/contracts/interfaces/IERC20.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

contract LiquidOracle is AccessControlUpgradeable {

    using Math for uint256;


    // ============================= Constants =============================
    uint256 public constant PRICE_PRECISION = 1_000000_000000_000000;

    // keccak256("LiquidOracle: PRICE_UPDATER_ROLE")
    bytes32 public constant PRICE_UPDATER_ROLE = 
        0x80a030ace745e3f9b21b30d8f6ac315b0db7a572dca17866ddb1edc31df8099f;

    /**
     * @notice The virtual address that represents the `standard price`, usually 
     *      the SHARE token's price in USD. It has a constant value, which is
     *      address(uint160(uint256(keccak256("LiquidOracle: STANDARD_PRICE_ADDRESS"))))
     */
    address public constant STANDARD_PRICE_ADDRESS = 0xFA0FFaA48dfB36b79A84C4d591cC91bC304fA13f;


    // ============================= Parameters ============================
    address public vault;
    uint256 public minimumUpdateInterval;


    // ============================== Storage ==============================

    /**
     * @notice We both use a `list` and a `dict` to store the supported assets.
     */
    address[] public supportedAssetList;
    mapping(address => bool) public isSupportedAsset;

    /**
     * @notice `Price` is the defined as the asset price in SHARE token with 18 decimals.
     *       For example, if the price of token $X is 5_400000_000000_000000, it means
     *       1 $X is equal to 5.4 SHARE token.
     */
    mapping(address => uint256) public assetPrice;

    uint256 public lastUpdateTime;



    // ======================= Modifier & Initializer ======================

    function initialize() public initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());

        minimumUpdateInterval = 5 minutes;
    }

    modifier isSupported(address asset) {
        require(
            isSupportedAsset[asset] || asset == STANDARD_PRICE_ADDRESS, 
            "PUMP_LIQUID_ORACLE: asset not found"
        );
        _;
    }


    // ====================== View functions - prices ======================

    function getSupportedAssetLength() public view returns (uint256) {
        return supportedAssetList.length;
    }

    function fetchPrice(address asset) public view isSupported(asset) returns (uint256) {
        return assetPrice[asset];
    }

    function fetchPriceStandard() public view returns (uint256) {
        return assetPrice[STANDARD_PRICE_ADDRESS];
    }

    function fetchPricesAll() public view returns (uint256[] memory) {
        uint256[] memory prices = new uint256[](supportedAssetList.length + 1);
        for (uint256 i = 0; i < supportedAssetList.length; i++) {
            prices[i] = assetPrice[supportedAssetList[i]];
        }
        prices[supportedAssetList.length] = assetPrice[STANDARD_PRICE_ADDRESS];
        return prices;
    }

    function previewSwapForShare(
        address asset, uint256 assetAmount
    ) public view isSupported(asset) returns (uint256) {
        return assetAmount.mulDiv(assetPrice[asset], PRICE_PRECISION);
    }

    function previewSwapForAsset(
        address asset, uint256 shareAmount
    ) public view isSupported(asset) returns (uint256) {
        return shareAmount.mulDiv(PRICE_PRECISION, assetPrice[asset]);
    }


    // ====================== Write functions - assets =====================

    function addSupportedAsset(address asset) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!isSupportedAsset[asset], "PUMP_LIQUID_ORACLE: asset already exists");
        require(asset != STANDARD_PRICE_ADDRESS, "PUMP_LIQUID_ORACLE: cannot add virtual address");
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

    function updatePrices(
        address[] memory assets, uint256[] memory prices
    ) public onlyRole(PRICE_UPDATER_ROLE) {
        require(assets.length == prices.length, "PUMP_LIQUID_ORACLE: invalid input length");
        require(
            assets.length == supportedAssetList.length + 1, 
            "PUMP_LIQUID_ORACLE: invalid input length"
        );
        require(
            block.timestamp - lastUpdateTime >= minimumUpdateInterval, 
            "PUMP_LIQUID_ORACLE: update too frequently"
        );

        for (uint256 i = 0; i < assets.length; i++) {
            require(
                isSupportedAsset[assets[i]] || assets[i] == STANDARD_PRICE_ADDRESS, 
                "PUMP_LIQUID_ORACLE: asset not found"
            );
            assetPrice[assets[i]] = prices[i];
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