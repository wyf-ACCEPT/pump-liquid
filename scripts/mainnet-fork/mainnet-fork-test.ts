import "dotenv/config"
import { ethers } from "hardhat"
import { formatEther, formatUnits, parseEther, parseUnits } from "ethers"

const GREEN = "\x1b[32m"
const RESET = "\x1b[0m"

async function main() {
  const USDT_ADDRESS = '0xdac17f958d2ee523a2206206994597c13d831ec7'
  const USDT_OWNER_ADDRESS = "0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828"

  const usdt = await ethers.getContractAt("ERC20", USDT_ADDRESS)
  const totalSupply = await usdt.totalSupply()
  console.log(`${GREEN}USDT total supply  :${RESET} ${formatUnits(totalSupply, 6)}`)

  const [user] = await ethers.getSigners()
  console.log(`${GREEN}User address       :${RESET} ${user.address}`)
  console.log(`${GREEN}User ETH  balance  :${RESET} ${formatEther(await ethers.provider.getBalance(user.address))}`)
  console.log(`${GREEN}User USDT balance  :${RESET} ${formatUnits(await usdt.balanceOf(user.address), 6)}`)

  const mockOwner = await ethers.getImpersonatedSigner(USDT_OWNER_ADDRESS)
  await user.sendTransaction({ to: mockOwner.address, value: parseEther("100") })
  await usdt.connect(mockOwner).transfer(user.address, parseUnits("3333", 6))
  console.log(`${GREEN}User USDT balance  :${RESET} ${formatUnits(await usdt.balanceOf(user.address), 6)}`)

  console.log(`${GREEN}Current block      :${RESET} ${await ethers.provider.getBlockNumber()}`)
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
