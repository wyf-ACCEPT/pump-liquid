// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interface.sol";
import "./constants.sol";

using Math for uint256;
using SafeERC20 for IERC20;
using SafeERC20 for ILiquidVault;


contract LiquidCashier is AccessControlUpgradeable, PausableUpgradeable, Constants {

    // =============================== Struct ==============================

    struct PendingInfo {
        uint256 shares;
        uint256 timestamp;
        address asset;
        uint256 assetAmount;
        uint256 feeExit;
    }


    // ============================= Parameters ============================

    ILiquidVault public vault;
    ILiquidOracle public oracle;

    uint256 public withdrawPeriod;      // Default to 7 days
    uint256 public feeRateManagement;   // Default to 2% per year
    uint256 public feeRatePerformance;  // Default to 20%
    uint256 public feeRateExit;         // Default to 1%
    uint256 public feeRateInstant;      // Default to 5%

    address public feeReceiverDefault;          // Address of liquid-vault fee receiver
    address public feeReceiverThirdParty;       // Address of third-party fee receiver
    uint256 public thirdPartyRatioManagement;   // Fee ratio of management fee for third-party receiver
    uint256 public thirdPartyRatioPerformance;  // Fee ratio of performance fee for third-party receiver
    uint256 public thirdPartyRatioExit;         // Fee ratio of exit fee for third-party receiver


    // ============================== Storage ==============================

    uint256 lastMintShareTimestamp;
    uint256 highestSharePrice;

    mapping(address => PendingInfo) public pendingInfo;


    // =============================== Events ==============================

    event Deposit(
        address indexed from, address indexed asset, 
        uint256 assetAmount, uint256 shareAmount
    );
    event RequestWithdraw(
        address indexed from, address indexed asset, 
        uint256 assetAmount, uint256 shareAmount, uint256 feeExit
    );
    event CompleteWithdraw(address indexed to, uint256 requestTimestamp);
    event InstantWithdraw(
        address indexed from, address indexed asset, 
        uint256 assetAmount, uint256 shareAmount, uint256 feeInstant
    );
    event CancelWithdraw(address indexed to, uint256 requestTimestamp);
    event FeeDistributedFixRatio(
        address receiver1, uint256 amount1, 
        address receiver2, uint256 amount2, string feeType
    );
    event FeesCollected(
        uint256 feeManagement, uint256 feePerformance, 
        uint256 thirdPartyRatioManagement, uint256 thirdPartyRatioPerformance
    );
    event ParameterUpdated(string key, uint256 value);
    event FeeReceiverUpdated(string key, address value);

    // ======================= Modifier & Initializer ======================

    function initialize(address _vault, address _oracle) public initializer {
        __AccessControl_init();
        __Pausable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());

        require(_vault != address(0) && _oracle != address(0), "LIQUID_CASHIER: invalid address");

        vault = ILiquidVault(_vault);
        oracle = ILiquidOracle(_oracle);

        withdrawPeriod = 7 days;
        feeRateManagement = 200;
        feeRatePerformance = 2000;
        feeRateExit = 100;
        feeRateInstant = 500;

        feeReceiverDefault = address(0);
        feeReceiverThirdParty = address(0);
        thirdPartyRatioManagement = 0;
        thirdPartyRatioPerformance = 0;
        thirdPartyRatioExit = 0;

        lastMintShareTimestamp = 0;
        highestSharePrice = 0;
    }


    // ============================== Internal =============================

    /**
     * @notice Check if the share amount is valid when calling `withdraw`.
     */
    function _shareAmountIsValid(uint256 sharesAmount) internal view {
        require(sharesAmount > 0, "LIQUID_CASHIER: invalid amount");
        require(
            sharesAmount <= vault.balanceOf(_msgSender()), 
            "LIQUID_CASHIER: insufficient shares"
        );
    }

    /**
     * @notice Distributes fees between the default fee receiver and 
     *      the third-party fee receiver.
     */
    function _fixRatioDistributeFee(
        uint256 feeAmount, uint256 thirdPartyRatio, string memory feeType
    ) internal {
        uint256 feeThirdParty = feeAmount.mulDiv(thirdPartyRatio, 10000);
        uint256 feeDefault = feeAmount - feeThirdParty;

        if (feeDefault > 0) {
            vault.safeTransfer(feeReceiverDefault, feeDefault);
        }
        if (feeThirdParty > 0) {
            vault.safeTransfer(feeReceiverThirdParty, feeThirdParty);
        }

        emit FeeDistributedFixRatio(
            feeReceiverDefault, feeDefault, 
            feeReceiverThirdParty, feeThirdParty, feeType
        );
    }


    // =========================== View functions ==========================

    /**
     * @notice This is an simulation function for `deposit`. Should be used in
     *      the front-end for better user experience.
     * @return sharesAmount The estimated share amount obtained.
     */
    function simulateDeposit(
        address asset, uint256 assetAmount
    ) public view whenNotPaused returns (uint256) {
        require(assetAmount > 0, "LIQUID_CASHIER: invalid amount");
        require(
            IERC20(asset).allowance(_msgSender(), address(this)) >= assetAmount, 
            "LIQUID_CASHIER: insufficient allowance"
        );
        return oracle.assetToShare(asset, assetAmount);
    }

    /**
     * @notice This is an simulation function for `requestWithdraw`. Should be used in
     *      the front-end for better user experience.
     * @return assetAmountNet The estimated asset amount, after deducting all fees.
     */
    function simulateRequestWithdraw(
        address asset, uint256 sharesAmount
    ) public view whenNotPaused returns (uint256) {
        _shareAmountIsValid(sharesAmount);
        require(pendingInfo[_msgSender()].shares == 0, "LIQUID_CASHIER: request exists");
        uint256 feeExit = sharesAmount.mulDiv(feeRateExit, 10000);
        return oracle.shareToAsset(asset, sharesAmount - feeExit);
    }

    /**
     * @notice This is an simulation function for `completeWithdraw`. Should be used in
     *      the front-end for better user experience.
     * @return isSuccess `true` if the withdraw will be successful, `false` if the 
     *      withdraw will be cancelled due to the asset is no longer supported.
     */
    function simulateCompleteWithdraw() public view whenNotPaused returns (bool) {
        require(pendingInfo[_msgSender()].shares > 0, "LIQUID_CASHIER: request not exists");
        require(
            block.timestamp - pendingInfo[_msgSender()].timestamp >= withdrawPeriod, 
            "LIQUID_CASHIER: still pending"
        );
        PendingInfo memory info = pendingInfo[_msgSender()];
        if (oracle.isSupportedAssetExternal(info.asset)) {
            require(
                IERC20(info.asset).balanceOf(address(vault)) >= info.assetAmount,
                "LIQUID_CASHIER: insufficient balance in vault"
            );
            return true;        // The withdraw will be successful
        } else {
            return false;       // The withdraw will be cancelled due to the asset is not supported
        }
    }
    
    /**
     * @notice This is an simulation function for `instantWithdraw`. Should be used in
     *      the front-end for better user experience.
     * @return assetAmountNet The estimated asset amount, after deducting all fees.
     */
    function simulateInstantWithdraw(
        address asset, uint256 sharesAmount
    ) public view whenNotPaused returns (uint256) {
        _shareAmountIsValid(sharesAmount);
        uint256 feeInstant = sharesAmount.mulDiv(feeRateInstant, 10000);
        uint256 assetAmount = oracle.shareToAsset(asset, sharesAmount - feeInstant);
        require(
            IERC20(asset).balanceOf(address(vault)) >= assetAmount,
            "LIQUID_CASHIER: insufficient balance in vault"
        );
        return assetAmount;
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
        IERC20(asset).safeTransferFrom(_msgSender(), address(this), assetAmount);
        IERC20(asset).approve(address(vault), assetAmount);     // 2-step transfer for proper approval process
        vault.depositAsset(asset, assetAmount);
        vault.mintShares(_msgSender(), currentShares);

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
        _shareAmountIsValid(sharesAmount);
        require(pendingInfo[_msgSender()].shares == 0, "LIQUID_CASHIER: request exists");

        // Burn user shares
        vault.burnShares(_msgSender(), sharesAmount);
        
        // Update pending info
        uint256 feeExit = sharesAmount.mulDiv(feeRateExit, 10000, Math.Rounding.Ceil);
        uint256 assetAmount = oracle.shareToAsset(asset, sharesAmount - feeExit);
        pendingInfo[_msgSender()] = PendingInfo({
            shares: sharesAmount,
            timestamp: block.timestamp,
            asset: asset,
            assetAmount: assetAmount,
            feeExit: feeExit
        });

        // Event
        emit RequestWithdraw(_msgSender(), asset, assetAmount, sharesAmount, feeExit);
    }

    /**
     * @notice Complete the withdraw request and get the asset from the vault.
     *      If the asset is removed from the vault during the withdraw period,
     *      the user won't be able to get the asset, and will get the shares refunded.
     */
    function completeWithdraw() public whenNotPaused {
        // Check conditions
        require(pendingInfo[_msgSender()].shares > 0, "LIQUID_CASHIER: request not exists");
        require(
            block.timestamp - pendingInfo[_msgSender()].timestamp >= withdrawPeriod, 
            "LIQUID_CASHIER: still pending"
        );

        // Retrieve & Clear pending info
        PendingInfo memory info = pendingInfo[_msgSender()];
        delete pendingInfo[_msgSender()];

        // Withdraw from the vault
        if (oracle.isSupportedAssetExternal(info.asset)) {
            // User get the asset
            vault.withdrawAsset(info.asset, info.assetAmount);
            IERC20(info.asset).safeTransfer(_msgSender(), info.assetAmount);

            // Distribute exit fee
            vault.mintShares(address(this), info.feeExit);
            _fixRatioDistributeFee(info.feeExit, thirdPartyRatioExit, "exit fee");

            emit CompleteWithdraw(_msgSender(), info.timestamp);
        } else {
            // The asset is no longer supported, refund shares
            vault.mintShares(_msgSender(), info.shares);
            
            emit CancelWithdraw(_msgSender(), info.timestamp);
        }
    }

    /**
     * @notice Instant withdraw the asset from the vault and get the asset instantly.
     *      It will charge a higher fee than the normal withdraw request, and it may
     *      be not success if the asset liquidity is not enough.
     */
    function instantWithdraw(address asset, uint256 sharesAmount) public whenNotPaused {
        // Check conditions
        _shareAmountIsValid(sharesAmount);

        // Burn user shares
        vault.burnShares(_msgSender(), sharesAmount);

        // Withdraw instantly
        uint256 feeInstant = sharesAmount.mulDiv(feeRateInstant, 10000);
        uint256 assetAmount = oracle.shareToAsset(asset, sharesAmount - feeInstant);

        // Distribute instant exit fee
        vault.withdrawAsset(asset, assetAmount);
        IERC20(asset).safeTransfer(_msgSender(), assetAmount);
        vault.mintShares(address(this), feeInstant);
        _fixRatioDistributeFee(feeInstant, thirdPartyRatioExit, "instant exit fee");

        // Event
        emit InstantWithdraw(_msgSender(), asset, assetAmount, sharesAmount, feeInstant);
    }


    // ====================== Write functions - admin ======================

    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function setParameter(string memory key, uint256 value) public onlyRole(DEFAULT_ADMIN_ROLE) {
        collectFees();
        bytes32 keyHash = keccak256(abi.encodePacked(key));
        if (keyHash == keccak256("withdrawPeriod")) {
            withdrawPeriod = value;
        } else {
            require(value <= 10000, "LIQUID_CASHIER: invalid fee rate or third-party ratio");
            if (keyHash == keccak256("feeRateManagement")) {
                feeRateManagement = value;
            } else if (keyHash == keccak256("feeRatePerformance")) {
                feeRatePerformance = value;
            } else if (keyHash == keccak256("feeRateExit")) {
                require(value <= feeRateInstant, "LIQUID_CASHIER: exit fee rate too high");
                feeRateExit = value;
            } else if (keyHash == keccak256("feeRateInstant")) {
                require(value >= feeRateExit, "LIQUID_CASHIER: instant fee rate too low");
                feeRateInstant = value;
            } else {
                revert("LIQUID_CASHIER: invalid key");
            }
        }
        emit ParameterUpdated(key, value);
    }

    function setParameterCoSign(string memory key, uint256 value) public onlyRole(CO_SIGNER) {
        collectFees();
        bytes32 keyHash = keccak256(abi.encodePacked(key));
        require(value <= 10000, "LIQUID_CASHIER: invalid third-party ratio");
        if (keyHash == keccak256("thirdPartyRatioManagement")) {
            thirdPartyRatioManagement = value;
        } else if (keyHash == keccak256("thirdPartyRatioPerformance")) {
            thirdPartyRatioPerformance = value;
        } else if (keyHash == keccak256("thirdPartyRatioExit")) {
            thirdPartyRatioExit = value;
        } else {
            revert("LIQUID_CASHIER: invalid key");
        }
        emit ParameterUpdated(key, value);
    }

    function setFeeReceiverDefault(address account) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "LIQUID_CASHIER: invalid address");
        feeReceiverDefault = account;
        emit FeeReceiverUpdated("feeReceiverDefault", account);
    }

    function setFeeReceiverThirdParty(address account) public onlyRole(CO_SIGNER) {
        require(account != address(0), "LIQUID_CASHIER: invalid address");
        feeReceiverThirdParty = account;
        emit FeeReceiverUpdated("feeReceiverThirdParty", account);
    }

    function setCoSigner(address account, bool status) public onlyRole(DEFAULT_ADMIN_ROLE) {
        if (status) {
            _grantRole(CO_SIGNER, account);
        } else {
            _revokeRole(CO_SIGNER, account);
        }
    }


    // =================== Write functions - fee manager ===================

    /**
     * @notice Indirectly collect fees by issuing extra share tokens.
     *      This function should be executed as frequently as possible, ideally
     *      executed once per day, otherwise the bias of the management fee and 
     *      performance fee will accumulate. Fee calculation rules:
     *       1. Management fee (%): (`timeElapsed` / 365 days) * (`feeRatemanagement` / 10000)
     *       2. Performance fee (%): (`priceIncreased` / `highestSharePrice`) 
     *              * (`feeRatePerformance` / 10000)
     *      Both of them should be calculated with Math library, to both avoid overflow
     *       and truncation errors.
     */
    function collectFees() public {
        // Check conditions
        require(feeReceiverDefault != address(0), "LIQUID_CASHIER: default fee receiver not set");
        require(feeReceiverThirdParty != address(0), "LIQUID_CASHIER: third-party fee receiver not set");

        // Dilution shares for management fee
        uint256 sharesTotalSupply = vault.totalSupply();
        uint256 feeManagement = 0;
        if (lastMintShareTimestamp == 0 && sharesTotalSupply != 0) {
            lastMintShareTimestamp = block.timestamp; // Skip the first time
        } else {
            uint256 timeElapsed = block.timestamp - lastMintShareTimestamp;
            feeManagement = sharesTotalSupply
                .mulDiv(feeRateManagement, 10000)
                .mulDiv(timeElapsed, 365 days);
            lastMintShareTimestamp = block.timestamp;
        }

        // Dilution shares for performance fee
        uint256 currentPrice = oracle.fetchShareStandardPrice();
        uint256 feePerformance = 0;
        if (highestSharePrice == 0) {
            highestSharePrice = currentPrice;   // Skip the first time
        } else if (currentPrice > highestSharePrice) {
            uint256 priceIncreased = currentPrice - highestSharePrice;
            feePerformance = sharesTotalSupply
                .mulDiv(feeRatePerformance, 10000)
                .mulDiv(priceIncreased, highestSharePrice);
            highestSharePrice = currentPrice;
        }

        // Mint the dilution shares
        vault.mintShares(address(this), feeManagement + feePerformance);
        _fixRatioDistributeFee(feeManagement, thirdPartyRatioManagement, "management fee");
        if (feePerformance > 0) {
            _fixRatioDistributeFee(feePerformance, thirdPartyRatioPerformance, "performance fee");
        }
        emit FeesCollected(
            feeManagement, feePerformance, 
            thirdPartyRatioManagement, thirdPartyRatioPerformance
        );
    }

}