import "dotenv/config"
import { ethers } from "hardhat"
import { formatEther, parseEther, Interface, ZeroAddress, parseUnits, formatUnits } from "ethers"

const CIAN_VAULT_ABI = require("./abi-cianBTC.json")

const GREEN = "\x1b[32m"
const BLUEE = "\x1b[34m"
const RESET = "\x1b[0m"

async function main() {

  // ========================= Address Book =========================

  const CIAN_BTC_VAULT_ADDRESS = "0xd4Cc9b31e9eF33E392FF2f81AD52BE8523e0993b".toLowerCase()

  const PUMPBTC_ADDRESS = "0xF469fBD2abcd6B9de8E169d128226C0Fc90a012e".toLowerCase()    // asset()
  const FBTC_ADDRESS = "0xC96dE26018A54D51c097160568752c4E3BD6C364".toLowerCase()
  const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599".toLowerCase()

  const ADMIN_ADDRESS = "0xEe8B9e072212f51B1A0c105E83b86bDC104f36B2".toLowerCase()
  const LM_ADDRESS = "0x4D077B30C6318D564c347382751bC284D4E844e9".toLowerCase()
  const WBTC_HOLDER_ADDRESS = "0x5Ee5bf7ae06D1Be5997A1A72006FE6C607eC6DE8".toLowerCase()
  const CIAN_OWNER_ADDRESS = "0x4adD00e818c4ed8fd69718A74B5D54Fa1DbbBb2a".toLowerCase()


  // ====================== Prepare mock tokens ======================

  const cianBtcVaultInterface = new Interface(CIAN_VAULT_ABI)

  const cianBtcVault = await ethers.getContractAt("ERC20", CIAN_BTC_VAULT_ADDRESS)
  const wbtc = await ethers.getContractAt("ERC20", WBTC_ADDRESS)
  const fbtc = await ethers.getContractAt("ERC20", FBTC_ADDRESS)
  const pumpbtc = await ethers.getContractAt("ERC20", PUMPBTC_ADDRESS)
  const liquidVault = await ethers.getContractAt("LiquidVault", process.env.MAINNET_CIAN_LVAULT!)
  const liquidVaultAddress = await liquidVault.getAddress()

  const provider = ethers.provider
  const realAdmin = await ethers.getImpersonatedSigner(ADMIN_ADDRESS)
  const realLiquidityManager = await ethers.getImpersonatedSigner(LM_ADDRESS)
  const wbtcHolder = await ethers.getImpersonatedSigner(WBTC_HOLDER_ADDRESS)
  const cianOwner = await ethers.getImpersonatedSigner(CIAN_OWNER_ADDRESS)
  await provider.send("hardhat_setBalance", [ADMIN_ADDRESS, "0x1" + "0".repeat(20)])
  await provider.send("hardhat_setBalance", [LM_ADDRESS, "0x1" + "0".repeat(20)])
  await provider.send("hardhat_setBalance", [WBTC_HOLDER_ADDRESS, "0x1" + "0".repeat(20)])
  await provider.send("hardhat_setBalance", [CIAN_OWNER_ADDRESS, "0x1" + "0".repeat(20)])

  await wbtc.connect(wbtcHolder).transfer(liquidVaultAddress, parseUnits("20", 8))

  
  // =================== Mock modification for CIAN ===================

  await cianOwner.sendTransaction({
    to: CIAN_BTC_VAULT_ADDRESS,
    data: cianBtcVaultInterface.encodeFunctionData("updateMaxPriceUpdatePeriod", [259199])
  })

  console.log(await provider.call({
    to: CIAN_BTC_VAULT_ADDRESS,
    data: cianBtcVaultInterface.encodeFunctionData("maxDeposit", [LM_ADDRESS])
  }))



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
      + '000000000000000000000000' + WBTC_ADDRESS.slice(2)                  // Must be WBTC
      + '0000000000000000000000000000000000000000000000000000000000000000'  // Can be any amount
      + '000000000000000000000000' + liquidVaultAddress.slice(2)            // Must be vault address
      + '0000000000000000000000000000000000000000000000000000000000000000', // Must be zero address
    mask: '0xffffffff'
      + 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      + '0000000000000000000000000000000000000000000000000000000000000000'
      + 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      + 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    description: "Deposit any amount of $WBTC to CIAN's PumpBTC vault, "
      + "and the receiver must be the liquid vault itself.",
  }

  await liquidVault.connect(realAdmin).addStrategy(
    CIAN_BTC_VAULT_ADDRESS, depositStrategy.mask,
    depositStrategy.restrict, depositStrategy.description,
  )
  console.log(`\nAdded strategy for LiquidVault: ${BLUEE}${depositStrategy.description}${RESET}`)

  /**
   * Example data for redeem in CIAN:
    * 0xaa2f892d   // requestRedeem
    * 000000000000000000000000000000000000000000000000015f30d2cc572fcc   // Share balance
   */

  const requestRedeemStrategy = {
    restrict: '0xaa2f892d'
      + '0000000000000000000000000000000000000000000000000000000000000000',  // Can be any share balance
    mask: '0xffffffff'
      + '0000000000000000000000000000000000000000000000000000000000000000',
    description: "Request-redeem any amount of shares from CIAN's PumpBTC vault, "
      + "to unknown token.",
  }

  await liquidVault.connect(realAdmin).addStrategy(
    CIAN_BTC_VAULT_ADDRESS, requestRedeemStrategy.mask,
    requestRedeemStrategy.restrict, requestRedeemStrategy.description,
  )
  console.log(`Added strategy for LiquidVault: ${BLUEE}${requestRedeemStrategy.description}${RESET}`)


  const approveForCIANStrategy = {
    restrict: '0x095ea7b3'
      + '000000000000000000000000' + CIAN_BTC_VAULT_ADDRESS.slice(2)
      + '0000000000000000000000000000000000000000000000000000000000000000',
    mask: '0xffffffff'
      + 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      + '0000000000000000000000000000000000000000000000000000000000000000',
    description: "Approve CIAN's PumpBTC vault to spend $WBTC.",
  }

  await liquidVault.connect(realAdmin).addStrategy(
    WBTC_ADDRESS, approveForCIANStrategy.mask,
    approveForCIANStrategy.restrict, approveForCIANStrategy.description,
  )
  console.log(`Added strategy for LiquidVault: ${BLUEE}${approveForCIANStrategy.description}${RESET}`)


  // ======================== Execute strategy ========================

  const strategyLatestId = await liquidVault.strategiesLength()
  console.log(`[Balance $WBTC   ] Liquid vault  : ${GREEN}${formatUnits(
    await wbtc.balanceOf(liquidVaultAddress), 8
  )}${RESET}`)

  await liquidVault.connect(realLiquidityManager).executeStrategy(
    strategyLatestId - 1n,    // Approve strategy
    wbtc.interface.encodeFunctionData("approve", [
      CIAN_BTC_VAULT_ADDRESS, parseUnits("3.0", 8)
    ])
  )

  await liquidVault.connect(realLiquidityManager).executeStrategy(
    strategyLatestId - 3n,    // Strategy index for deposit
    cianBtcVaultInterface.encodeFunctionData("optionalDeposit", [
      WBTC_ADDRESS, parseUnits("1.4", 8), liquidVaultAddress, ZeroAddress,
    ])
  )
  console.log(`[Balance $WBTC   ] Liquid vault after deposit : ${GREEN}${formatUnits(
    await wbtc.balanceOf(liquidVaultAddress), 8
  )}${RESET}`)
  console.log(`[Balance $cianBTC] Liquid vault after deposit : ${GREEN}${formatUnits(
    await cianBtcVault.balanceOf(liquidVaultAddress), 8
  )}${RESET}`)

  await liquidVault.connect(realLiquidityManager).executeStrategy(
    strategyLatestId - 2n,    // Strategy index for request redeem
    cianBtcVaultInterface.encodeFunctionData("requestRedeem", [
      await cianBtcVault.balanceOf(liquidVaultAddress),
    ])
  )
  console.log(`[Balance $WBTC] Liquid vault after request : ${GREEN}${formatUnits(
    await wbtc.balanceOf(liquidVaultAddress), 8
  )}${RESET}`)
  console.log(`[Balance $cianBTC] Liquid vault after request : ${GREEN}${formatUnits(
    await cianBtcVault.balanceOf(liquidVaultAddress), 8
  )}${RESET}`)
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
