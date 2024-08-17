// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "@openzeppelin/contracts/access/IAccessControl.sol";

import "./LiquidVault.sol";
import "./LiquidOracle.sol";
import "./LiquidCashier.sol";


contract LiquidFactory is Ownable2StepUpgradeable {

    // ============================== Storage ==============================

    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    struct LiquidInfo {
        string name;
        string symbol;
        address vault;
        address oracle;
        address cashier;
    }

    UpgradeableBeacon public beaconVault;
    UpgradeableBeacon public beaconOracle;
    UpgradeableBeacon public beaconCashier;

    LiquidInfo[] public liquids;


    // =============================== Events ==============================

    event LiquidCreated(
        address indexed vault, address indexed oracle, address indexed cashier, 
        string name, string symbol, address creator
    );
    event UpgradeContract(
        string indexed contractName, address oldImpl, address newImpl
    );


    // ============================ Initializer ============================

    /**
     * @notice Notice that the three implementation contracts should be deployed
     *      first, and their addresses should be passed to this initializer.
     *      If deploying the implementation contracts in this initializer, the 
     *      contract code size would be too large.
     */
    function initialize(
        address _vaultImpl, address _oracleImpl, address _cashierImpl
    ) public initializer {
        // Initialize parents
        __Ownable_init(_msgSender());
        __Ownable2Step_init();

        // Deploy implementation contracts
        address vault = _vaultImpl;
        address oracle = _oracleImpl;
        address cashier = _cashierImpl;

        // Deploy beacons for implementation contracts
        beaconVault = new UpgradeableBeacon(vault, address(this));
        beaconOracle = new UpgradeableBeacon(oracle, address(this));
        beaconCashier = new UpgradeableBeacon(cashier, address(this));
    }


    // =========================== View functions ==========================

    function getLiquidsNum() public view returns (uint256) {
        return liquids.length;
    }

    function getImplementationVault() public view returns (address) {
        return beaconVault.implementation();
    }

    function getImplementationOracle() public view returns (address) {
        return beaconOracle.implementation();
    }

    function getImplementationCashier() public view returns (address) {
        return beaconCashier.implementation();
    }

    
    // ========================== Write functions ==========================

    function deployLiquid(
        string memory name, string memory symbol, address liquidOwner
    ) public onlyOwner {
        // Deploy beacon proxies
        address vaultProxy = address(new BeaconProxy(address(beaconVault), ""));
        address oracleProxy = address(new BeaconProxy(address(beaconOracle), ""));
        address cashierProxy = address(new BeaconProxy(address(beaconCashier), ""));

        // Initialize proxies
        LiquidVault(vaultProxy).initialize(name, symbol);
        LiquidOracle(oracleProxy).initialize();
        LiquidCashier(cashierProxy).initialize(vaultProxy, oracleProxy);
        LiquidVault(vaultProxy).setCashier(cashierProxy);

        // Grant ownership
        IAccessControl(vaultProxy).grantRole(DEFAULT_ADMIN_ROLE, liquidOwner);
        IAccessControl(oracleProxy).grantRole(DEFAULT_ADMIN_ROLE, liquidOwner);
        IAccessControl(cashierProxy).grantRole(DEFAULT_ADMIN_ROLE, liquidOwner);

        // Save liquid info
        liquids.push(LiquidInfo({
            name: name,
            symbol: symbol,
            vault: vaultProxy,
            oracle: oracleProxy,
            cashier: cashierProxy
        }));

        // Event
        emit LiquidCreated(vaultProxy, oracleProxy, cashierProxy, name, symbol, _msgSender());
    }

    function upgradeCashier(address newImpl) public onlyOwner {
        address oldImpl = beaconCashier.implementation();
        beaconCashier.upgradeTo(newImpl);
        emit UpgradeContract("LiquidCashier", oldImpl, newImpl);
    }

    function upgradeVault(address newImpl) public onlyOwner {
        address oldImpl = beaconCashier.implementation();
        beaconVault.upgradeTo(newImpl);
        emit UpgradeContract("LiquidVault", oldImpl, newImpl);
    }

    function upgradeOracle(address newImpl) public onlyOwner {
        address oldImpl = beaconCashier.implementation();
        beaconOracle.upgradeTo(newImpl);
        emit UpgradeContract("LiquidOracle", oldImpl, newImpl);
    }

}