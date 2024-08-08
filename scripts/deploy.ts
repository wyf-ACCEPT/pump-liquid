import "dotenv/config"
import { deployContract, deployUpgradeableContract } from "./utils"
import { LiquidCashier, LiquidOracle, LiquidVault } from "../typechain-types"

async function main() {
  const [name, symbol] = ["BTC Liquid Vault Share", "bSHARE"]
  
  const liquidOracle = await deployUpgradeableContract("LiquidOracle") as unknown as LiquidOracle
  const liquidVault = await deployUpgradeableContract(
    "LiquidVault", [name, symbol]
  ) as unknown as LiquidVault
  const liquidCashier = await deployUpgradeableContract(
    "LiquidCashier", [await liquidVault.getAddress(), await liquidOracle.getAddress()]
  ) as unknown as LiquidCashier

  await liquidVault.setCashier(await liquidCashier.getAddress())

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

