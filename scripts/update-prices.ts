import "dotenv/config"
import { ethers } from "hardhat";
import { parseUnits } from "ethers";

async function main() {

  const prices = [
    parseUnits("1.00", 36),    // Asset-1 price to share
    parseUnits("1.00", 36),    // Asset-2 price to share
                            // ......
    parseUnits("1.00", 36),    // Standard asset price to share
  ]

  const [_, owner] = await ethers.getSigners()
  const liquidOracle = await ethers.getContractAt(
    "LiquidOracle", process.env.SEPOLIA_BTCFI_LORACLE!
  )

  if (!(await liquidOracle.hasRole(
    await liquidOracle.PRICE_UPDATER_ROLE(), owner.getAddress()
  ))) {
    console.log(`Address ${owner.address} does not have the price updater role!`)
  } else {
    console.log(`Address ${owner.address} has the price updater role! Updating prices...`)
    const tx = await liquidOracle.connect(owner).updatePrices(prices)
    const receipt = await tx.wait()
    console.log(`Prices updated! Tx hash: ${receipt!.hash}`)
  }
   
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
