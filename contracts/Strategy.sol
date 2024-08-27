// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Strategy {

    /**
     * "Swap token $X for token $Y directly"
     * to [fixed]
     * data [
     *  [fixed] swapExactTokensForTokens.sig
     *  [dynamic] amountIn
     *  [dynamic] amountOutMin
     *  [fixed] path
     *  [fixed] to
     *  [dynamic] deadline
     *  [fixed] path.length
     *  [fixed] path.0
     *  [fixed] path.1
     * ]
     */

    /**
     * SwapExactTokensForTokens
     * 1 mBTCB -> min 45000 mUSDT
     * 
     * to: 
     *  uniswapV2Router.sepolia.eth
     * data: 
     *  swapExactTokensForTokens.sig
     * 0000000000000000000000000000000000000000000000000de0b6b3a7640000 amountIn
     * 00000000000000000000000000000000000000000000098774738bc822200000 amountOutMin
     * 00000000000000000000000000000000000000000000000000000000000000a0 path
     * 0000000000000000000000007b7c993c3c283aaca86913e1c27db054ce5fa143 to
     * 0000000000000000000000000000000000000000000000000000000066cda5b4 deadline
     * 0000000000000000000000000000000000000000000000000000000000000002 path.length
     * 0000000000000000000000002d83726eadb68bba0f8c27ea80b5cde8b9f6f516 path.0
     * 0000000000000000000000002d83726eadb68bba0f8c27ea80b5cde8b9f6f516 path.1
     */


}