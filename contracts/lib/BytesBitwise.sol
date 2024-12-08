// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

library BytesBitwise {
    /**
     * @notice Since Solidity does not support bitwise operations on bytes,
     *      this function is used to perform bitwise AND on two bytes.
     * @param a The first bytes.
     * @param b The second bytes, must have the same length as `a`.
     * @return The result of `a & b`.
     */
    function and(bytes memory a, bytes memory b) internal pure returns (bytes memory) {
        require(a.length == b.length, "BYTES_BITWISE: length mismatch");
        bytes memory result = new bytes(a.length);
        for (uint256 i = 0; i < a.length; i++) {
            result[i] = a[i] & b[i];
        }
        return result;
    }
}