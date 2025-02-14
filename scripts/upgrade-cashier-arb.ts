import "dotenv/config"
import { ethers } from "hardhat";
import { deployContract } from "./utils";

async function main() {
  const liquidFactory = await ethers.getContractAt("LiquidFactory", process.env.ARB_DEV_LFACTORY!)
  const newLiquidCashierImpl = await deployContract("TestLiquidCashier")
  await liquidFactory.upgradeCashier(await newLiquidCashierImpl.getAddress())
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
