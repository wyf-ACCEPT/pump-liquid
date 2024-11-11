import "dotenv/config"
import { ethers } from "hardhat";
import { parseUnits } from "ethers";

async function main() {

  // const prices = [
  //   parseUnits("1.00", 36),    // Asset-1 price to share
  //   parseUnits("1.00", 36),    // Asset-2 price to share
  //                           // ......
  //   parseUnits("1.00", 36),    // Standard asset price to share
  // ]

  const strategyIdx = 1   // 0: Withdraw WBTC, 1: Withdraw BTCB
  const withdrawAsset = process.env.SEPOLIA_BTCB!
  const amount = parseUnits("0.1", 18)

  const [_, owner] = await ethers.getSigners()
  const liquidVault = await ethers.getContractAt(
    "LiquidVault", process.env.SEPOLIA_BTCFI_LVAULT!
  )

  if (!(await liquidVault.hasRole(
    await liquidVault.LIQUIDITY_MANAGER_ROLE(), owner.getAddress()
  ))) {
    console.log(`Address ${owner.address} does not have the liquidity manager role!`)
  } else {
    console.log(`Address ${owner.address} has the liquidity manager role! Withdrawing asset...`)
    const BTCB = await ethers.getContractAt("ERC20", withdrawAsset)
    const data = BTCB.interface.encodeFunctionData("transfer", [owner.address, amount])
    const tx = await liquidVault.connect(owner).executeStrategy(strategyIdx, data)
    const receipt = await tx.wait()
    console.log(`Asset withdrawn! Tx hash: ${receipt!.hash}`)
  }
   
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
