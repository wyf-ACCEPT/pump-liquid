// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "../LiquidCashier.sol";

contract TestLiquidCashier is LiquidCashier {
    function setWithdrawPeriod(uint256 _withdrawPeriod) external {
        withdrawPeriod = _withdrawPeriod;
    }
}
