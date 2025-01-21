import "dotenv/config"
import { ethers } from "hardhat";
import { parseUnits } from "ethers";

async function main() {

  const vault = await ethers.getContractAt("LiquidVault", "0xe790C9D5C68EfAfCdc4f9c3E5BA153F89d837660")

  // for (let i = 0; i < await vault.strategiesLength(); i++) {
  //   console.log(`\nStrategy ${i}:`)
  //   console.log(await vault.strategies(i))
  // }

  /**
   * 0x32507a5f - optionalDeposit
   * 0xaa2f892d - requestRedeem
   * 0xa9059cbb - transfer (withdraw from vault)
   */

  // const events = await vault.queryFilter(
  //   vault.filters.RoleGranted("0xcbb8e99d7d1dedee5e6fbbbc9227e55b29665cbba779af85c8f83b8c3cdf01f0"), 
  //   "0x143deed", "0x14aaffb"
  // )
  // console.log(events)

  // console.log(vault.interface.encodeFunctionData(
  //   "executeStrategy", [1, erc20.interface.encodeFunctionData(
  //     "transfer", ["0x4D077B30C6318D564c347382751bC284D4E844e9", 100000n]
  //   )]
  // ))

  const erc20 = await ethers.getContractAt("ERC20", "0x0000000000000000000000000000000000000000")
  console.log(erc20.interface.encodeFunctionData(
    "transfer", ["0x4D077B30C6318D564c347382751bC284D4E844e9", 100000n]
  ))


}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
