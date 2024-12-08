import "dotenv/config"
import { deployContract, upgradeContract } from "./utils"
import { ethers } from "hardhat";
import { LiquidCashier, LiquidOracle, LiquidVault } from "../typechain-types";

async function main() {
  // Upgrade factory
  const MAINNET_LIQUID_FACTORY_ADDRESS = "0xF30C701E4915b6B3855798252Ce9F46A918da565"
  await upgradeContract(MAINNET_LIQUID_FACTORY_ADDRESS, "LiquidFactory")

  console.log(`Waiting for block confirmations (30 seconds)...`)
  await new Promise(resolve => setTimeout(resolve, 30000))

  // Upgrade cashier, vault and oracle
  const newCashierImpl = await deployContract("LiquidCashier") as unknown as LiquidCashier
  const newVaultImpl = await deployContract("LiquidVault") as unknown as LiquidVault
  const newOracleImpl = await deployContract("LiquidOracle") as unknown as LiquidOracle

  console.log(`Waiting for block confirmations (30 seconds)...`)
  await new Promise(resolve => setTimeout(resolve, 30000))

  const factory = await ethers.getContractAt("LiquidFactory", MAINNET_LIQUID_FACTORY_ADDRESS)
  const tx1 = await factory.upgradeCashier(await newCashierImpl.getAddress())
  console.log(`Upgraded cashier to ${await newCashierImpl.getAddress()}: ${tx1.hash}`)
  const tx2 = await factory.upgradeVault(await newVaultImpl.getAddress())
  console.log(`Upgraded vault to ${await newVaultImpl.getAddress()}: ${tx2.hash}`)
  const tx3 = await factory.upgradeOracle(await newOracleImpl.getAddress())
  console.log(`Upgraded oracle to ${await newOracleImpl.getAddress()}: ${tx3.hash}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

