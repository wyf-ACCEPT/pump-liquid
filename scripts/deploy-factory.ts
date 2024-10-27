import "dotenv/config"
import { deployContract, deployUpgradeableContract } from "./utils"
import { LiquidCashier, LiquidFactory, LiquidOracle, LiquidVault } from "../typechain-types"
import { ethers } from "hardhat"

const GREEN = "\x1b[32m"
const RESET = "\x1b[0m"

async function main() {

  const [name, symbol] = ["Liquid BTC Vault Share", "lbSHARE"]

  // ================== Deploy factory contract ==================
  const liquidVaultImpl = await deployContract("LiquidVault") as unknown as LiquidVault
  const liquidOracleImpl = await deployContract("LiquidOracle") as unknown as LiquidOracle
  const liquidCashierImpl = await deployContract("LiquidCashier") as unknown as LiquidCashier
  const liquidFactory = await deployUpgradeableContract("LiquidFactory", [
    await liquidVaultImpl.getAddress(), 
    await liquidOracleImpl.getAddress(), 
    await liquidCashierImpl.getAddress(),
  ]) as unknown as LiquidFactory

  // ================== Deploy a liquid vault instance ==================
  const [_factoryOwner, vaultOwner] = await ethers.getSigners()
  await (await liquidFactory.deployLiquid(name, symbol, vaultOwner.address)).wait()
  const liquidsNum = await liquidFactory.getLiquidsNum()

  const [
    _name, _symbol, vaultProxyAddress, oracleProxyAddress, cashierProxyAddress,
  ] = await liquidFactory.liquids(liquidsNum - 1n)
  
  console.log(`[${name}] Vault proxy deployed to: ${GREEN}${vaultProxyAddress}${RESET}`)
  console.log(`[${name}] Oracle proxy deployed to: ${GREEN}${oracleProxyAddress}${RESET}`)
  console.log(`[${name}] Cashier proxy deployed to: ${GREEN}${cashierProxyAddress}${RESET}`)
  console.log(`[${name}] Owner is: ${GREEN}${vaultOwner.address}${RESET}`)
  
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
