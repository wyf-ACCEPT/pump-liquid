import "dotenv/config"
import { ethers } from "hardhat"
import { formatEther, formatUnits, parseEther, parseUnits, Interface, ZeroAddress } from "ethers"

const CIAN_TOKEN_ABI = require("./ylstETH.json")

const GREEN = "\x1b[32m"
const BLUEE = "\x1b[34m"
const RESET = "\x1b[0m"

async function main() {
  const YLST_ETH_ADDRESS = "0xB13aa2d0345b0439b064f26B82D8dCf3f508775d"

  const [user] = await ethers.getSigners()
  const provider = ethers.provider

  const ylstEthInterace = new Interface(CIAN_TOKEN_ABI)
  const ylstEthErc20 = await ethers.getContractAt("ERC20", YLST_ETH_ADDRESS)

  /**
   * Example data for deposit in CIAN:
    * 0x32507a5f   // optionalDeposit
    * 000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee   // Native ETH
    * 0000000000000000000000000000000000000000000000000000000000000000   // Amount of ETH
    * 0000000000000000000000001111111111111111111111111111111111111111   // Receiver address
    * 0000000000000000000000000000000000000000000000000000000000000000   // Address of Referral
   */

  console.log(`${GREEN}User ETH  balance  :${RESET} ${formatEther(await provider.getBalance(user.address))}`)

  const tx1 = await user.sendTransaction({
    to: YLST_ETH_ADDRESS,
    value: parseEther("15"),
    data: ylstEthInterace.encodeFunctionData("optionalDeposit", [
      "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", 0, user.address, ZeroAddress,
    ])
  })

  const shareBalance = await ylstEthErc20.balanceOf(user.address)
  console.log(`${BLUEE}User deposit ETH   :${RESET} ${tx1.hash}`)
  console.log(`${GREEN}User ETH   balance :${RESET} ${formatEther(await provider.getBalance(user.address))}`)
  console.log(`${GREEN}User Share balance :${RESET} ${formatUnits(shareBalance, 18)}`)

  /**
   * Example data for redeem in CIAN:
    * 0x107703ab   // requestRedeem
    * 000000000000000000000000000000000000000000000000015f30d2cc572fcc   // Share balance
    * 000000000000000000000000ae7ab96520de3a18e5e111b5eaab095312d7fe84   // Token address (stETH)
   */

  const tx2 = await user.sendTransaction({
    to: YLST_ETH_ADDRESS,
    data: ylstEthInterace.encodeFunctionData("requestRedeem", [
      shareBalance, "0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
    ])
  })

  const shareBalanceAfter = await ylstEthErc20.balanceOf(user.address)
  console.log(`${BLUEE}User redeem stETH  :${RESET} ${tx2.hash}`)
  console.log(`${GREEN}User ETH   balance :${RESET} ${formatEther(await provider.getBalance(user.address))}`)
  console.log(`${GREEN}User Share balance :${RESET} ${formatUnits(shareBalanceAfter, 18)}`)

}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
