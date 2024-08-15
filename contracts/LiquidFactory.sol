// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "./LiquidVault.sol";
import "./LiquidOracle.sol";
import "./LiquidCashier.sol";


contract LiquidFactory is Ownable2StepUpgradeable {

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

    event LiquidCreated(
        address indexed vault, address indexed oracle, address indexed cashier, 
        string name, string symbol, address creator
    );

    function initialize() public initializer {
        __Ownable2Step_init();

        // Deploy implementation contracts
        address vault = address(new LiquidVault());
        address oracle = address(new LiquidOracle());
        address cashier = address(new LiquidCashier());

        // Deploy beacons for implementation contracts
        beaconVault = new UpgradeableBeacon(vault, address(this));
        beaconOracle = new UpgradeableBeacon(oracle, address(this));
        beaconCashier = new UpgradeableBeacon(cashier, address(this));
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

    

    function deployLiquid(string memory name, string memory symbol) public {
        // ...
        // initialize..
    }

    function upgradeCashier(address newImpl) public onlyOwner {
        beaconCashier.upgradeTo(newImpl);
        // emit
    }

    function upgradeVault(address newImpl) public onlyOwner {
        beaconVault.upgradeTo(newImpl);
        // emit
    }

    function upgradeOracle(address newImpl) public onlyOwner {
        beaconOracle.upgradeTo(newImpl);
        // emit
    }

}