import "dotenv/config"
import { ethers } from "hardhat"

const GREEN = "\x1b[32m"
const RESET = "\x1b[0m"

async function main() {

  const [name, symbol] = ["BTC-Fi L2 Vault LP", "BTC-Fi L2"]

  // ================== Deploy singleton contracts by factory ==================
  const [_factoryOwner, vaultOwner] = await ethers.getSigners()
  const liquidFactory = await ethers.getContractAt("LiquidFactory", process.env.SEPOLIA_LFACTORY!)
  await (await liquidFactory.deployLiquid(name, symbol, vaultOwner.address)).wait()
  const liquidsNum = await liquidFactory.getLiquidsNum()

  const [
    _name, _symbol, vaultProxyAddress, oracleProxyAddress, cashierProxyAddress,
  ] = await liquidFactory.liquids(liquidsNum - 1n)
  
  console.log(`[${name}] Vault proxy deployed to: ${GREEN}${vaultProxyAddress}${RESET}`)
  console.log(`[${name}] Oracle proxy deployed to: ${GREEN}${oracleProxyAddress}${RESET}`)
  console.log(`[${name}] Cashier proxy deployed to: ${GREEN}${cashierProxyAddress}${RESET}`)
  console.log(`[${name}] Owner is: ${GREEN}${vaultOwner.address}${RESET}`)

  // [Oracle] setPriceUpdater -> [Vault] setLiquidityManager -> [Cashier] setCoSigner
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
