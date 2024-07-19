// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

contract UpgradeableUSDC is ERC20Upgradeable {
    function initialize() initializer public {
        __ERC20_init("USDC", "USD Circle");
        _mint(msg.sender, 1_000_000_000 * 10 ** decimals());
    }
}

