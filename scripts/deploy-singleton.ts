import "dotenv/config"
import { deployUpgradeableContract } from "./utils"
import { LiquidCashier, LiquidOracle, LiquidVault } from "../typechain-types"

async function main() {

  const [name, symbol] = ["Liquid BTC Vault Share", "lbSHARE"]

  // ================== Deploy singletone contracts ==================
  const liquidOracle = await deployUpgradeableContract("LiquidOracle") as unknown as LiquidOracle
  const liquidVault = await deployUpgradeableContract(
    "LiquidVault", [name, symbol]
  ) as unknown as LiquidVault
  const liquidCashier = await deployUpgradeableContract(
    "LiquidCashier", [await liquidVault.getAddress(), await liquidOracle.getAddress()]
  ) as unknown as LiquidCashier
  await liquidVault.setCashier(await liquidCashier.getAddress())

  // [Oracle] setPriceUpdater -> [Vault] setLiquidityManager -> [Cashier] setFeeManager, setCoSigner
  // -> [Cashier] (owner) setFeeReceiverDefault, (co-signer) setFeeReceiverThirdParty, 
  //              (co-signer) setParameterCoSign
  // -> [Oracle] addSupportedAsset, updatePrices -> [Vault] addStrategy -> [Cashier] collectFees

}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
