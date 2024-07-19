// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";

contract PumpLiquid is ERC20Upgradeable {

    using SafeERC20 for IERC20;

    event Deposit(
        address indexed from, address indexed asset,
        uint256 assetAmount, address indexed to, uint256 shareAmount
    );
    event Withdraw(
        address indexed to, address indexed asset,
        uint256 assetAmount, address indexed from, uint256 shareAmount
    );

    function initialize() public initializer {
        // __ERC20_init("USDC", "USD Circle");
        // _mint(msg.sender, 1_000_000_000 * 10 ** decimals());
    }


    // ========================= Internal Functions ========================
    function _update(address from, address to, uint256 value) internal override {
        require(
            from == address(0) || to == address(0), 
            "PUMP LIQUID: transfer is not allowed"
        );
        super._update(from, to, value);
    }

    function _deposit(
        address from, IERC20 asset, uint256 assetAmount, address to, uint256 shareAmount
    ) internal {
        if (assetAmount > 0) asset.safeTransferFrom(from, address(this), assetAmount);
        _mint(to, shareAmount);
        emit Deposit(from, address(asset), assetAmount, to, shareAmount);
    }
    
    function _withdraw(
        address to, IERC20 asset, uint256 assetAmount, address from, uint256 shareAmount
    ) internal {
        _burn(from, shareAmount);
        if (assetAmount > 0) asset.safeTransfer(to, assetAmount);
        emit Withdraw(to, address(asset), assetAmount, from, shareAmount);
    }

}
