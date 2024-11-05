import "dotenv/config"
import { ethers } from "hardhat"
import { formatEther, formatUnits, parseEther, parseUnits, Interface, ZeroAddress } from "ethers"
import { deployUpgradeableContract } from "../utils"
import { LiquidOracle, LiquidVault, LiquidCashier } from "../../typechain-types"

const CIAN_TOKEN_ABI = require("./ylstETH.json")

const GREEN = "\x1b[32m"
const BLUEE = "\x1b[34m"
const RESET = "\x1b[0m"

async function main() {

  const [name, symbol] = ["Liquid BTC Vault Share", "lbSHARE"]
  const [owner, liquidityManager] = await ethers.getSigners()
  const CIAN_YLST_ETH_ADDRESS = "0xB13aa2d0345b0439b064f26B82D8dCf3f508775d"
  const STETH_ADDRESS = "0xae7ab96520de3a18e5e111b5eaab095312d7fe84"
  const WETH_ADDRESS = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"

  // ================== Deploy singletone contracts ==================
  const liquidOracle = await deployUpgradeableContract("LiquidOracle") as unknown as LiquidOracle
  const liquidVault = await deployUpgradeableContract(
    "LiquidVault", [name, symbol]
  ) as unknown as LiquidVault
  const liquidCashier = await deployUpgradeableContract(
    "LiquidCashier", [await liquidVault.getAddress(), await liquidOracle.getAddress()]
  ) as unknown as LiquidCashier
  await liquidVault.setCashier(await liquidCashier.getAddress())

  const liquidVaultAddress = await liquidVault.getAddress()

  // [Oracle] setPriceUpdater -> [Vault] setLiquidityManager -> [Cashier] setCoSigner
  // -> [Cashier] (owner) setFeeReceiverDefault, (co-signer) setFeeReceiverThirdParty, 
  //              (co-signer) setParameterCoSign
  // -> [Oracle] addSupportedAsset, updatePrices -> [Vault] addStrategy -> [Cashier] collectFees


  // ===================== Add strategy for CIAN =====================

  /**
   * Example data for deposit in CIAN:
    * 0x32507a5f   // optionalDeposit
    * 000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee   // Native ETH
    * 0000000000000000000000000000000000000000000000000000000000000000   // Amount of ETH
    * 0000000000000000000000001111111111111111111111111111111111111111   // Receiver address
    * 0000000000000000000000000000000000000000000000000000000000000000   // Address of Referral
   */

  const depositStrategy = {
    restrict: '0x32507a5f'
      + '000000000000000000000000' + WETH_ADDRESS.slice(2)                  // Must be WETH
      + '0000000000000000000000000000000000000000000000000000000000000000'  // Can be any amount
      + '000000000000000000000000' + liquidVaultAddress.slice(2)            // Must be vault address
      + '0000000000000000000000000000000000000000000000000000000000000000', // Must be zero address
    mask: '0xffffffff'
      + 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      + '0000000000000000000000000000000000000000000000000000000000000000'
      + 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      + 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    description: "Deposit any amount of native ETH to CIAN's ylstETH vault, "
      + "and the receiver must be the liquid vault itself.",
  }

  await liquidVault.addStrategy(
    CIAN_YLST_ETH_ADDRESS, depositStrategy.mask,
    depositStrategy.restrict, depositStrategy.description,
  )
  console.log(`\nAdded strategy for LiquidVault: ${BLUEE}${depositStrategy.description}${RESET}`)

  /**
   * Example data for redeem in CIAN:
    * 0x107703ab   // requestRedeem
    * 000000000000000000000000000000000000000000000000015f30d2cc572fcc   // Share balance
    * 000000000000000000000000ae7ab96520de3a18e5e111b5eaab095312d7fe84   // Token address (stETH)
   */

  const requestRedeemStrategy = {
    restrict: '0x107703ab'
      + '0000000000000000000000000000000000000000000000000000000000000000'  // Can be any share balance
      + '000000000000000000000000' + STETH_ADDRESS.slice(2),                // Must be stETH
    mask: '0xffffffff'
      + '0000000000000000000000000000000000000000000000000000000000000000'
      + 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    description: "Request-redeem any amount of shares from CIAN's ylstETH vault, "
      + "to $stETH.",
  }

  await liquidVault.addStrategy(
    CIAN_YLST_ETH_ADDRESS, requestRedeemStrategy.mask,
    requestRedeemStrategy.restrict, requestRedeemStrategy.description,
  )
  console.log(`Added strategy for LiquidVault: ${BLUEE}${requestRedeemStrategy.description}${RESET}`)


  const approveForCIANStrategy = {
    restrict: '0x095ea7b3'
      + '000000000000000000000000' + CIAN_YLST_ETH_ADDRESS.slice(2)
      + '0000000000000000000000000000000000000000000000000000000000000000',
    mask: '0xffffffff'
      + 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      + '0000000000000000000000000000000000000000000000000000000000000000',
    description: "Approve CIAN's ylstETH vault to spend WETH.",
  }

  await liquidVault.addStrategy(
    WETH_ADDRESS, approveForCIANStrategy.mask,
    approveForCIANStrategy.restrict, approveForCIANStrategy.description,
  )
  console.log(`Added strategy for LiquidVault: ${BLUEE}${approveForCIANStrategy.description}${RESET}`)


  // ======================== Execute strategy ========================

  const ylstEthInterace = new Interface(CIAN_TOKEN_ABI)
  const ylstEthToken = await ethers.getContractAt("ERC20", CIAN_YLST_ETH_ADDRESS)
  const weth = await ethers.getContractAt("ERC20", WETH_ADDRESS)

  await liquidVault.setLiquidityManager(liquidityManager.address, true)
  await liquidityManager.sendTransaction({ to: WETH_ADDRESS, value: parseEther("3.0") })
  await weth.connect(liquidityManager).transfer(liquidVaultAddress, parseEther("3.0"))
  console.log(`\n[Balance $WETH] Liquid vault               : ${GREEN}${
    formatEther(await weth.balanceOf(liquidVaultAddress))
  }${RESET}`)

  await liquidVault.connect(liquidityManager).executeStrategy(
    2,    // Approve strategy
    weth.interface.encodeFunctionData("approve", [
      CIAN_YLST_ETH_ADDRESS, parseEther("3.0")
    ])
  )

  await liquidVault.connect(liquidityManager).executeStrategy(
    0,    // Strategy index for deposit
    ylstEthInterace.encodeFunctionData("optionalDeposit", [
      WETH_ADDRESS, parseEther("1.4"), liquidVaultAddress, ZeroAddress,
    ])
  )
  console.log(`[Balance $WETH] Liquid vault after deposit : ${GREEN}${
    formatEther(await weth.balanceOf(liquidVaultAddress))
  }${RESET}`)
  console.log(`[Balance $ylstETH] Liquid vault after deposit : ${GREEN}${
    formatEther(await ylstEthToken.balanceOf(liquidVaultAddress))
  }${RESET}`)

  await liquidVault.connect(liquidityManager).executeStrategy(
    1,    // Strategy index for request redeem
    ylstEthInterace.encodeFunctionData("requestRedeem", [
      await ylstEthToken.balanceOf(liquidVaultAddress), STETH_ADDRESS,
    ])
  )
  console.log(`[Balance $WETH] Liquid vault after request : ${GREEN}${
    formatEther(await weth.balanceOf(liquidVaultAddress))
  }${RESET}`)
  console.log(`[Balance $ylstETH] Liquid vault after request : ${GREEN}${
    formatEther(await ylstEthToken.balanceOf(liquidVaultAddress))
  }${RESET}`)

}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
