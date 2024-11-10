import "dotenv/config"
import { deployContract, upgradeContract } from "./utils"
import { ethers } from "hardhat";
import { LiquidCashier } from "../typechain-types";

async function main() {
  const newCashierImpl = await deployContract("LiquidCashier") as unknown as LiquidCashier
  const factory = await ethers.getContractAt("LiquidFactory", process.env.SEPOLIA_LFACTORY!)
  await (await factory.upgradeCashier(await newCashierImpl.getAddress())).wait()
  console.log(`Upgraded cashier to ${await newCashierImpl.getAddress()}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

