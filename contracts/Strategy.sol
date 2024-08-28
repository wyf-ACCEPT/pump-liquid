// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library BytesLogic {
    function and(bytes memory a, bytes memory b) internal pure returns (bytes memory) {
        require(a.length == b.length, "BytesLogic: length mismatch");
        bytes memory result = new bytes(a.length);
        for (uint256 i = 0; i < a.length; i++) {
            result[i] = a[i] & b[i];
        }
        return result;
    }
}

contract Strategy {

    /**
     * target bytes : 0x3718__05__12
     * mask         : 0xffff00ff00ff
     * restrict     : 0x371800050012
     * data         : 0x371828052812
     * data & mask ?= restrict
     */

    struct StrategyInfo {
        address to;
        bytes mask;
        bytes restrict;
        bytes32 restrictHash;
        string description;
    }

    StrategyInfo[] public strategies;

    function addStrategy(
        address to, bytes memory mask, bytes memory restrict, string memory description
    ) public {
        require(mask.length == restrict.length, "Strategy: length mismatch");
        bytes32 restrictHash = keccak256(restrict);
        strategies.push(StrategyInfo(to, mask, restrict, restrictHash, description));
    }

    function matchStrategy(uint256 strategyIdx, bytes memory data) public view returns (bool) {
        StrategyInfo memory strategy = strategies[strategyIdx];
        return keccak256(BytesLogic.and(data, strategy.mask)) == strategy.restrictHash;
    }
    
    /**
     * "Swap token $X for token $Y directly"
     * length
     * description []
     * 
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
     *  uniswapV2Router.sepolia.eth (0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008)
     * data: 
     *  swapExactTokensForTokens.sig (0x38ed1739)
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