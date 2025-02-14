import "dotenv/config"
import { ethers } from "hardhat";
import { deployContract } from "./utils";
import { ERC20 } from "../typechain-types";

async function main() {
  const mwbtc = <any>(await deployContract(
    "MockToken", ["Mock Wrapped BTC", "mWBTC", 18, 1_000_000n * (10n ** 18n)]
  )) as ERC20
  const btcfiArbDevOracle = await ethers.getContractAt(
    "LiquidOracle", process.env.ARB_DEV_BTCFI_LORACLE!
  )
  await btcfiArbDevOracle.addSupportedAsset(await mwbtc.getAddress())
  console.log(`Asset ${await mwbtc.symbol()} added to the vault!`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
