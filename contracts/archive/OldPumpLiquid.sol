// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

contract PumpLiquid is ERC20Upgradeable, AccessControlUpgradeable {

    using SafeERC20 for IERC20;

    bytes32 public constant PRICE_ORACLE_ROLE = keccak256("PumpLiquid: PRICE_ORACLE_ROLE");
    bytes32 public constant LIQUIDITY_MANAGER_ROLE = keccak256("PumpLiquid: LIQUIDITY_MANAGER_ROLE");

    mapping(address => bool) public isSupportedToken;
    mapping(address => uint8) public assetDecimal;
    address[] public supportedTokenList;

    mapping(address => bool) public inPendingWithdraw;  // User lock?


    event AssetAdded(address indexed asset);
    event AssetRemoved(address indexed asset);
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

        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setRoleAdmin(PRICE_ORACLE_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(LIQUIDITY_MANAGER_ROLE, DEFAULT_ADMIN_ROLE);
    }

    // =========================== Manage Assets ===========================
    function addAsset(address asset) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!isSupportedToken[asset], "PUMP LIQUID: asset already exists");
        isSupportedToken[asset] = true;
        supportedTokenList.push(asset);
        emit AssetAdded(asset);
    }

    function removeAsset(address asset) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isSupportedToken[asset], "PUMP LIQUID: asset not found");
        isSupportedToken[asset] = false;
        for (uint256 i = 0; i < supportedTokenList.length; i++) {
            if (supportedTokenList[i] == asset) {
                supportedTokenList[i] = supportedTokenList[supportedTokenList.length - 1];
                supportedTokenList.pop();
                break;
            }
        }
        emit AssetRemoved(asset);
    }



    // ========================== User Operations ==========================

    // function deposit(
    //     address asset, uint256 assetAmount, address to
    // ) public {
    //     require(isSupportedToken[asset], "PUMP LIQUID: asset not supported");
    //     _deposit(msg.sender, IERC20(asset), assetAmount, to, shareAmount);
    // }





    // function requestWithdraw

    // function completeWithdraw



    // ========================= Internal Functions ========================
    // function _adjustAmount(uint256 amount) public view returns (uint256) {
    //     return assetDecimal == 8 ? amount : amount * 10 ** (assetDecimal - 8);
    // }

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
