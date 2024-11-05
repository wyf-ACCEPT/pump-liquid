// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

abstract contract Constants {
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
     * @notice The virtual address that represents the `standard price`, usually for 
     *      recording SHARE's price in USD. Value:
     *      address(uint160(uint256(keccak256("LiquidOracle: STANDARD_ASSET"))))
     */
    address public constant STANDARD_ASSET = 0x00f57FF25aD6A37f742bF4eC977A54C1ff5b3822;

    /**
     * @notice The `PRICE_UPDATER_ROLE` is used to update the prices of the supported assets.
     *      Value: keccak256("LiquidOracle: PRICE_UPDATER_ROLE")
     */
    bytes32 public constant PRICE_UPDATER_ROLE = 
        0x80a030ace745e3f9b21b30d8f6ac315b0db7a572dca17866ddb1edc31df8099f;

    /**
     * @notice The `LIQUIDITY_MANAGER_ROLE` is used to manage the liquidity of the supported 
     *      assets. Value: keccak256("LiquidOracle: LIQUIDITY_MANAGER_ROLE")
     */
    bytes32 public constant LIQUIDITY_MANAGER_ROLE = 
        0xcbb8e99d7d1dedee5e6fbbbc9227e55b29665cbba779af85c8f83b8c3cdf01f0;
        
    /**
     * @notice The `PRICE_UPDATER_ROLE` is used to update the prices of the supported assets.
     *      Value: keccak256("LiquidOracle: CASHIER_ROLE")
     */
    bytes32 public constant CASHIER_ROLE = 
        0x221521cde999556f90cf8fca8f8f7fed9d3f3b1780d7cbeb187478038f4213ac;
    
    /**
     * @notice The `CO_SIGNER` is used to co-sign the transaction about changing the fee ratio 
     *      for third-party address, and changing the third-party address itself.
     *      Value: keccak256("LiquidFeeSplitter: CO_SIGNER")
     */
    bytes32 public constant CO_SIGNER = 
        0x158d29a78b8952a25b417162f01d9bda9b9a05a1d75904fc45e949106ca8377e;

}