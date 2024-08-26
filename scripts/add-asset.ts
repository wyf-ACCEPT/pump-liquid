import "dotenv/config"
import { ethers } from "hardhat";

async function main() {
  const [_, pbtcOwner] = await ethers.getSigners()
  const pbtcLiquidOracle = await ethers.getContractAt(
    "LiquidOracle", process.env.SEPOLIA_PBTC_LORACLE!
  )
  await pbtcLiquidOracle.connect(pbtcOwner).addSupportedAsset(process.env.SEPOLIA_BTCB!)
  const token = await ethers.getContractAt("ERC20", process.env.SEPOLIA_BTCB!)
  console.log(`Asset ${await token.symbol()} added to the vault!`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
