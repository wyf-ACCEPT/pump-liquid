// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/structs/Checkpoints.sol";

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

contract LiquidOracle is AccessControlUpgradeable {

    // ============================= Constants =============================

    // keccak256("LiquidOracle: PRICE_UPDATER_ROLE")
    bytes32 public constant PRICE_UPDATER_ROLE = 
        0x80a030ace745e3f9b21b30d8f6ac315b0db7a572dca17866ddb1edc31df8099f;

    /**
     * @notice The virtual address that represents the `standard price`, usually 
     *      the SHARE token's price in USD. It has a constant value, which is
     *      address(uint160(uint256(keccak256("LiquidOracle: STANDARD_PRICE_ADDRESS"))))
     */
    address public constant STANDARD_PRICE_ADDRESS = 0xFA0FFaA48dfB36b79A84C4d591cC91bC304fA13f;



    // ============================== Storage ==============================

    address public vault;


    address[] public supportedAssetList;
    mapping(address => bool) public isSuppportedAsset;

    /**
     * @notice `Price` is the defined as the asset price in SHARE token with 18 decimals.
     *       For example, if the price of token $X is 5_400000_000000_000000, it means
     *       1 $X is equal to 5.4 SHARE token.
     */
    mapping(address => uint256) public assetPrice;


    uint256 public minimumUpdateInterval;


    function initialize() public initializer {
        // TODO

        // minimumUpdateInterval
    }

    function addSupportedAsset(address asset) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!isSuppportedAsset[asset], "PUMP_LIQUID_ORACLE: asset already exists");
        isSuppportedAsset[asset] = true;
        supportedAssetList.push(asset);
    }

    function removeSupportedAsset(address asset) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isSuppportedAsset[asset], "PUMP_LIQUID_ORACLE: asset not found");
        isSuppportedAsset[asset] = false;
        for (uint256 i = 0; i < supportedAssetList.length; i++) {
            if (supportedAssetList[i] == asset) {
                supportedAssetList[i] = supportedAssetList[supportedAssetList.length - 1];
                supportedAssetList.pop();
                break;
            }
        }
    }


    function updatePrices(
        address[] memory assets, uint256[] memory prices
    ) public onlyRole(PRICE_UPDATER_ROLE) {
        require(assets.length == prices.length, "PUMP_LIQUID_ORACLE: invalid input length");
        require(
            assets.length == supportedAssetList.length + 1, "PUMP_LIQUID_ORACLE: invalid input length"
        );

        for (uint256 i = 0; i < assets.length; i++) {
            require(
                isSuppportedAsset[assets[i]] || assets[i] == STANDARD_PRICE_ADDRESS, 
                "PUMP_LIQUID_ORACLE: asset not found"
            );
            assetPrice[assets[i]] = prices[i];
        }
    }


}