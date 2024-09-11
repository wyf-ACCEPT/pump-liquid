import "dotenv/config"
import { deployContract, deployUpgradeableContract } from "./utils"
import { LiquidCashier, LiquidFactory, LiquidFeeSplitter, LiquidOracle, LiquidVault } from "../typechain-types"
import { ethers } from "hardhat"
import { EventLog } from "ethers"

const GREEN = "\x1b[32m"
const RESET = "\x1b[0m"

async function main() {
  // ================== Deploy singletone contracts ==================
  // const liquidOracle = await deployUpgradeableContract("LiquidOracle") as unknown as LiquidOracle
  // const liquidVault = await deployUpgradeableContract(
  //   "LiquidVault", [name, symbol]
  // ) as unknown as LiquidVault
  // const liquidCashier = await deployUpgradeableContract(
  //   "LiquidCashier", [await liquidVault.getAddress(), await liquidOracle.getAddress()]
  // ) as unknown as LiquidCashier
  // const liquidFeeSplitter = await deployUpgradeableContract(
  //   "LiquidFeeSplitter", []
  // ) as unknown as LiquidFeeSplitter
  // await liquidVault.setCashier(await liquidCashier.getAddress())
  // await liquidVault.setFeeSplitter(await liquidFeeSplitter.getAddress())

  // ================== Deploy factory contract ==================
  const liquidVaultImpl = await deployContract("LiquidVault") as unknown as LiquidVault
  const liquidOracleImpl = await deployContract("LiquidOracle") as unknown as LiquidOracle
  const liquidCashierImpl = await deployContract("LiquidCashier") as unknown as LiquidCashier
  const liquidFeeSplitterImpl = await deployContract("LiquidFeeSplitter") as 
    unknown as LiquidFeeSplitter
  const liquidFactory = await deployUpgradeableContract("LiquidFactory", [
    await liquidVaultImpl.getAddress(), 
    await liquidOracleImpl.getAddress(), 
    await liquidCashierImpl.getAddress(),
    await liquidFeeSplitterImpl.getAddress(),
  ]) as unknown as LiquidFactory

  // ================== Deploy a liquid vault instance ==================
  const [name, symbol] = ["Pump BTC Liquid Vault Share", "pbSHARE"]

  const [_factoryOwner, vaultOwner] = await ethers.getSigners()
  const [
    vaultProxyAddress, oracleProxyAddress, cashierProxyAddress, feeSplitterProxyAddress
  ] = await liquidFactory
    .deployLiquid(name, symbol, vaultOwner.address)
    .then(response => response.wait())
    .then(receipt => (receipt?.logs[receipt?.logs.length - 1] as EventLog).args)
  
  console.log(`[${name}] Vault proxy deployed to: ${GREEN}${vaultProxyAddress}${RESET}`)
  console.log(`[${name}] Oracle proxy deployed to: ${GREEN}${oracleProxyAddress}${RESET}`)
  console.log(`[${name}] Cashier proxy deployed to: ${GREEN}${cashierProxyAddress}${RESET}`)
  console.log(`[${name}] Fee splitter proxy deployed to: ${GREEN}${feeSplitterProxyAddress}${RESET}`)
  console.log(`[${name}] Owner is: ${GREEN}${vaultOwner.address}${RESET}`)
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
