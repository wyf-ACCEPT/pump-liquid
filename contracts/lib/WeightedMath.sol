// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/math/Math.sol";

library WeightedMath {
    using Math for uint256;

    /**
     * @notice Calculate the weighted average of two numbers, which is
     *      `(a * aWeight + b * bWeight) / (aWeight + bWeight)`.
     * @param a The first number.
     * @param b The second number.
     * @param aWeight The weight of the first number.
     * @param bWeight The weight of the second number.
     * @return The weighted average of the two numbers.
     */
    function weightedAverage(
        uint256 a, uint256 b, uint256 aWeight, uint256 bWeight
    ) internal pure returns (uint256) {
        // `a * aWeight` or `b * bWeight` can overflow.
        return a.mulDiv(aWeight, aWeight + bWeight) + b.mulDiv(bWeight, aWeight + bWeight);
    }
}