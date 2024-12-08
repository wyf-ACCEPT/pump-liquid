// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./lib/BytesBitwise.sol";
import "./interface.sol";
import "./constants.sol";

using Address for address;
using Strings for address;
using SafeERC20 for IERC20;


contract LiquidVault is AccessControlUpgradeable, ERC20Upgradeable, ILiquidVault, Constants {
    
    // =============================== Struct ==============================

    /**
     * @notice The `StrategyInfo` struct aims to record the strategy information that
     *       the liquidity manager is allowed to use. A strategy is a restrict call on
     *       a specific contract, and the `to` field records the target contract address.
     *       The `restrict` field aims to restrict the fixed parts of the calldata, while
     *       the `mask` field mask the dynamic parts of the calldata.
     * 
     *      For example, if the strategy bytes is `0x371805__2a__`, it means the calldata
     *       can be `0x371805fd2a01` or `0x371805cb2a02` or any other calldata that has
     *       the same fixed parts. In this case, the `restrict` field is `0x371805002a00`,
     *       and the `mask` field is `0xffffff00ff00`. If the `calldata` satisfies the
     *       equation: `calldata` & `mask` == `restrict`, the strategy is matched.
     * 
     *      The `restrictHash` field is the keccak256 hash of the `restrict` field. Since
     *       there is no bitwise comparison for bytes in Solidity, we use the hash to 
     *       compare `calldata` & `mask` with `restrict`, and the `keccak256(restrict)`
     *       should only be calculated once.
     */
    struct StrategyInfo {
        address to;
        bytes mask;
        bytes restrict;
        bytes32 restrictHash;
        string description;
    }


    // ============================= Parameters ============================

    address public cashier;
    StrategyInfo[] public strategies;             // Array of strategy information


    // =============================== Events ==============================

    event StrategyAdded(uint256 strategyIdx, address to, uint256 length, string description);
    event StrategyRemoved(uint256 strategyIdx);
    event StrategyExecuted(uint256 strategyIdx, bytes data, bytes result);


    // ======================= Modifier & Initializer ======================

    function initialize(string memory name, string memory symbol) public initializer {
        __AccessControl_init();
        __ERC20_init(name, symbol);

        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }


    // =========================== View functions ==========================

    function strategiesLength() public view returns (uint256) {
        return strategies.length;
    }


    // ===================== Write functions - cashier =====================

    function depositAsset(address asset, uint256 amount) public onlyRole(CASHIER_ROLE) {
        if (amount > 0) 
            IERC20(asset).safeTransferFrom(_msgSender(), address(this), amount);
    }

    function withdrawAsset(address asset, uint256 amount) public onlyRole(CASHIER_ROLE) {
        if (amount > 0)
            IERC20(asset).safeTransfer(_msgSender(), amount);
    }

    function mintShares(address to, uint256 amount) public onlyRole(CASHIER_ROLE) {
        if (amount > 0)
            _mint(to, amount);
    }

    function burnShares(address from, uint256 amount) public onlyRole(CASHIER_ROLE) {
        if (amount > 0)
            _burn(from, amount);
    }


    // ==================== Write functions - liquidity ====================
    
    /**
     * @notice The liquidity manager should clearly know which strategy index to use,
     *      and this function is used to check whether the calldata matches the strategy.
     */
    function executeStrategy(
        uint256 strategyIdx, bytes memory data
    ) public onlyRole(LIQUIDITY_MANAGER_ROLE) returns (bytes memory) {
        StrategyInfo memory strategy = strategies[strategyIdx];
        require(
            keccak256(BytesBitwise.and(data, strategy.mask)) == strategy.restrictHash,
            "LIQUID_VAULT: strategy not matched"
        );
        bytes memory result = strategy.to.functionCall(data);
        emit StrategyExecuted(strategyIdx, data, result);
        return result;
    }


    // ================== Write functions - admin strategy =================

    /**
     * @notice When adding a new strategy, check the length of the `mask` and 
     *      `restrict` field, and then save the strategy information.
     */
    function addStrategy(
        address to, bytes memory mask, bytes memory restrict, string memory description
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(mask.length == restrict.length, "LIQUID_VAULT: length mismatch");
        bytes32 restrictHash = keccak256(restrict);
        strategies.push(StrategyInfo(to, mask, restrict, restrictHash, description));
        emit StrategyAdded(strategies.length - 1, to, mask.length, description);
    }

    /**
     * @notice When removing a strategy, check the strategy index and then remove it.
     */
    function removeStrategy(
        uint256 strategyIdx
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(strategyIdx < strategies.length, "LIQUID_VAULT: invalid index");
        strategies[strategyIdx] = strategies[strategies.length - 1];
        strategies.pop();
        emit StrategyRemoved(strategyIdx);
    }

    /**
     * @notice Add a strategy to withdraw liquidity directly. This is just a helper
     *      function, since that the functionality is covered by the `addStrategy`
     *      function.
     */
    function addStrategyWithdrawLiquidityDirectly(
        address asset
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        bytes memory restrict = bytes.concat(
            hex"a9059cbb",          // Selector of `transfer(address,uint256)`
            hex"0000000000000000000000000000000000000000000000000000000000000000",  // Can be any address
            hex"0000000000000000000000000000000000000000000000000000000000000000"   // Can be any amount
        );
        bytes memory mask = bytes.concat(
            hex"ffffffff",
            hex"0000000000000000000000000000000000000000000000000000000000000000",
            hex"0000000000000000000000000000000000000000000000000000000000000000"
        );
        addStrategy(
            asset, mask, restrict, 
            string.concat("Withdraw liquidity directly for token ", asset.toHexString())
        );
    }


    // =============== Write functions - admin set parameter ===============

    /**
     * @notice We use `reinitializer` to ensure that the `cashier` role is only set once.
     */
    function setCashier(
        address _cashier
    ) public onlyRole(DEFAULT_ADMIN_ROLE) reinitializer(2) {
        cashier = _cashier;
        _grantRole(CASHIER_ROLE, cashier);
    }

    function setLiquidityManager(
        address account, bool status
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        if (status) {
            _grantRole(LIQUIDITY_MANAGER_ROLE, account);
        } else {
            _revokeRole(LIQUIDITY_MANAGER_ROLE, account);
        }
    }

    function grantRole(bytes32 role, address account) public override {
        require(role == DEFAULT_ADMIN_ROLE, "LIQUID_VAULT: only DEFAULT_ADMIN_ROLE can be granted");
        super.grantRole(role, account);
    }

    function revokeRole(bytes32 role, address account) public override {
        require(role == DEFAULT_ADMIN_ROLE, "LIQUID_VAULT: only DEFAULT_ADMIN_ROLE can be revoked");
        super.revokeRole(role, account);
    }

}
