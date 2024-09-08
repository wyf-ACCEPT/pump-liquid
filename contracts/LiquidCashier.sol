// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { WeightedMath } from "./lib/WeightedMath.sol";

import "./interface.sol";

using Math for uint256;


contract LiquidCashier is AccessControlUpgradeable, PausableUpgradeable {

    // =============================== Struct ==============================
    /**
     * @notice The `DepositInfo` struct aims to record the user's deposit information.
     *      If the user has deposited for multiple times, the `shares` should be the 
     *      sum of all the shares, and the `equivalentTimestamp` and `equivalentPrice` 
     *      should be the weighted average of all the deposits.
     */
    struct DepositInfo {
        uint256 shares;
        uint256 equivalentTimestamp;
        uint256 equivalentPrice;
    }

    struct PendingInfo {
        uint256 shares;
        uint256 timestamp;
        address asset;
        uint256 assetAmount;
        uint256 fee;
    }


    // ============================= Parameters ============================

    ILiquidVault public vault;
    ILiquidOracle public oracle;

    uint256 public withdrawPeriod;      // Default to 7 days
    uint256 public feeRateManagement;   // Default to 2% per year
    uint256 public feeRatePerformance;  // Default to 20%
    uint256 public feeRateExit;         // Default to 1%
    uint256 public feeRateInstant;      // Default to 5%


    // ============================== Storage ==============================

    mapping(address => DepositInfo) public depositInfo;
    mapping(address => PendingInfo) public pendingInfo;


    // =============================== Events ==============================

    event Deposit(
        address indexed from, address indexed asset, uint256 assetAmount, uint256 shareAmount
    );
    event RequestWithdraw(
        address indexed from, address indexed asset, uint256 shareAmount, uint256 assetAmount,
        uint256 feeManagement, uint256 feePerformance, uint256 feeExit, uint256 feeAll
    );
    event CompleteWithdraw(address indexed to, uint256 requestTimestamp);
    event InstantWithdraw(
        address indexed from, address indexed asset, uint256 shareAmount, uint256 assetAmount,
        uint256 feeManagement, uint256 feePerformance, uint256 feeInstantExit, uint256 feeAll
    );
    event CancelWithdraw(address indexed to, uint256 requestTimestamp);
    event ParameterUpdate(string key, uint256 value);


    // ======================= Modifier & Initializer ======================

    function initialize(address _vault, address _oracle) public initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());

        vault = ILiquidVault(_vault);
        oracle = ILiquidOracle(_oracle);

        withdrawPeriod = 7 days;
        feeRateManagement = 200;
        feeRatePerformance = 2000;
        feeRateExit = 100;
        feeRateInstant = 500;
    }


    // ============================== Internal =============================

    /**
     * @notice Calculate the fee for the user's withdraw request. The fee has three parts:
     *       1. Management fee (%): (`timeElapsed` / 365 days) * (`feeRatemanagement` / 10000)
     *       2. Performance fee (%): `currentPrice` <= `cost` ? 0 :
     *          (`currentPrice` - `cost`) / `currentPrice` * (`feeRatePerformance` / 10000)
     *       3. Exit fee (%): `feeRateExit` / 10000
     *      All of these fees should be calculated with Math library, to both avoid overflow
     *       and truncation errors.
     */
    function calculateFees(uint256 baseAmount, address user, bool isInstant) 
        public view returns (uint256 , uint256, uint256, uint256) {
        // Management fee
        uint256 timeElapsed = block.timestamp - depositInfo[user].equivalentTimestamp;
        uint256 feeManagement = baseAmount
            .mulDiv(timeElapsed, 365 days)
            .mulDiv(feeRateManagement, 10000);
        
        // Performance fee
        uint256 currentPrice = oracle.fetchShareStandardPrice();
        uint256 cost = depositInfo[user].equivalentPrice;
        uint256 feePerformance = currentPrice <= cost ? 0 : baseAmount
            .mulDiv(currentPrice - cost, currentPrice)
            .mulDiv(feeRatePerformance, 10000);

        // Exit fee
        uint256 feeExit = baseAmount
            .mulDiv(isInstant ? feeRateInstant : feeRateExit, 10000);

        // All fees
        uint256 feeAll = feeManagement + feePerformance + feeExit;
        return (feeManagement, feePerformance, feeExit, feeAll);
    }


    // ========================== Write functions ==========================

    /**
     * @notice Deposit the asset to the vault and record the user's deposit information.
     *      The user's deposit information should be updated with the weighted average
     *      of the old price(or timestamp) and the new price(or timestamp). This is also
     *      available for the first time deposit.
     */
    function deposit(address asset, uint256 assetAmount) public whenNotPaused {
        // Check conditions
        require(assetAmount > 0, "LIQUID_CASHIER: invalid amount");

        // Deposit to the vault
        uint256 currentShares = oracle.assetToShare(asset, assetAmount);
        vault.depositToVault(_msgSender(), asset, assetAmount, currentShares);

        // Retrieve deposit info
        DepositInfo memory oldInfo = depositInfo[_msgSender()];

        // Update deposit info
        depositInfo[_msgSender()].shares += currentShares;
        depositInfo[_msgSender()].equivalentTimestamp = WeightedMath.weightedAverage(
            oldInfo.equivalentTimestamp, block.timestamp, 
            oldInfo.shares, currentShares
        );
        depositInfo[_msgSender()].equivalentPrice = WeightedMath.weightedAverage(
            oldInfo.equivalentPrice, oracle.fetchShareStandardPrice(), 
            oldInfo.shares, currentShares
        );

        // Event
        emit Deposit(_msgSender(), asset, assetAmount, currentShares);
    }

    /**
     * @notice Request to withdraw the asset from the vault and record the user's 
     *      pending information. When the pending withdraw is matured, the user can
     *      call `completeWithdraw` to get the asset.
     */
    function requestWithdraw(address asset, uint256 sharesAmount) public whenNotPaused {
        // Check conditions
        require(sharesAmount > 0, "LIQUID_CASHIER: invalid amount");
        require(pendingInfo[_msgSender()].shares == 0, "LIQUID_CASHIER: request exists");
        require(
            sharesAmount <= depositInfo[_msgSender()].shares, 
            "LIQUID_CASHIER: insufficient shares"
        );

        // Calculate fees
        uint256 assetAmount = oracle.shareToAsset(asset, sharesAmount);
        (uint256 feeManagement, uint256 feePerformance, uint256 feeExit, uint256 feeAll)
            = calculateFees(assetAmount, _msgSender(), false);
        require(assetAmount > feeAll, "LIQUID_CASHIER: asset value too low");

        // Update pending info
        pendingInfo[_msgSender()] = PendingInfo({
            shares: sharesAmount,
            timestamp: block.timestamp,
            asset: asset,
            assetAmount: assetAmount,
            fee: feeAll
        });
        depositInfo[_msgSender()].shares -= sharesAmount;

        // Event
        emit RequestWithdraw(
            _msgSender(), asset, sharesAmount, assetAmount,
            feeManagement, feePerformance, feeExit, feeAll
        );
    }

    /**
     * @notice Complete the withdraw request and get the asset from the vault.
     *      If the asset is removed from the vault during the withdraw period,
     *      the user won't be able to get the asset, and will still hold the shares.
     */
    function completeWithdraw() public whenNotPaused {
        // Check conditions
        require(pendingInfo[_msgSender()].shares > 0, "LIQUID_CASHIER: request not exists");
        require(
            block.timestamp - pendingInfo[_msgSender()].timestamp >= withdrawPeriod, 
            "LIQUID_CASHIER: still pending"
        );

        // Retrieve pending info
        PendingInfo memory info = pendingInfo[_msgSender()];

        // Withdraw from the vault
        if (oracle.isSupportedAssetExternal(info.asset)) {
            vault.withdrawFromVault(
                _msgSender(), info.asset, info.shares, info.assetAmount - info.fee
            );
            emit CompleteWithdraw(_msgSender(), info.timestamp);
        } else {
            depositInfo[_msgSender()].shares += info.shares;
            emit CancelWithdraw(_msgSender(), info.timestamp);
        }

        // Clear pending info
        delete pendingInfo[_msgSender()];
    }

    /**
     * @notice Instant withdraw the asset from the vault and get the asset instantly.
     *      It will charge a higher fee than the normal withdraw request, and it may
     *      be not success if the asset liquidity is not enough.
     */
    function instantWithdraw(address asset, uint256 sharesAmount) public whenNotPaused {
        // Check conditions
        require(sharesAmount > 0, "LIQUID_CASHIER: invalid amount");
        require(
            sharesAmount <= depositInfo[_msgSender()].shares, 
            "LIQUID_CASHIER: insufficient shares"
        );

        // Calculate fees
        uint256 assetAmount = oracle.shareToAsset(asset, sharesAmount);
        (uint256 feeManagement, uint256 feePerformance, uint256 feeInstantExit, uint256 feeAll)
            = calculateFees(assetAmount, _msgSender(), true);
        require(assetAmount > feeAll, "LIQUID_CASHIER: asset value too low");

        // Withdraw instantly
        vault.withdrawFromVault(
            _msgSender(), asset, sharesAmount, assetAmount - feeAll
        );
        depositInfo[_msgSender()].shares -= sharesAmount;

        // Event
        emit InstantWithdraw(
            _msgSender(), asset, sharesAmount, assetAmount,
            feeManagement, feePerformance, feeInstantExit, feeAll
        );
    }


    // ====================== Write functions - admin ======================

    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function setParameter(string memory key, uint256 value) public onlyRole(DEFAULT_ADMIN_ROLE) {
        bytes32 keyHash = keccak256(abi.encodePacked(key));
        if (keyHash == keccak256("withdrawPeriod")) {
            withdrawPeriod = value;
        } else {
            require(value <= 10000, "LIQUID_CASHIER: invalid fee rate");
            if (keyHash == keccak256("feeRateManagement")) {
                feeRateManagement = value;
            } else if (keyHash == keccak256("feeRatePerformance")) {
                feeRatePerformance = value;
            } else if (keyHash == keccak256("feeRateExit")) {
                feeRateExit = value;
            } else if (keyHash == keccak256("feeRateInstant")) {
                require(value >= feeRateExit, "LIQUID_CASHIER: instant fee rate too low");
                feeRateInstant = value;
            } else {
                revert("LIQUID_CASHIER: invalid key");
            }
        }
        emit ParameterUpdate(key, value);
    }
    
}