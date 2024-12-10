import "dotenv/config"
import { ethers, hardhatArguments } from "hardhat"
import { formatEther, parseEther, Interface, ZeroAddress, parseUnits, formatUnits, Signer } from "ethers"
import { LiquidVault } from "../typechain-types"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"

const CIAN_VAULT_ABI = require("../abi/abi-cianBTC.json")

const GREEN = "\x1b[32m"
const BLUEE = "\x1b[34m"
const RESET = "\x1b[0m"

async function assertStrategyMatch(btcfiVault: LiquidVault, strategyIdx: number, restrict: string, mask: string) {
  let existingStrategy = await btcfiVault.strategies(strategyIdx)
  if (existingStrategy[2] !== restrict) {
    throw new Error(`Strategy restrict mismatch: expected ${restrict}, got ${existingStrategy[2]}`)
  } else if (existingStrategy[1] !== mask) {
    throw new Error(`Strategy mask mismatch: expected ${mask}, got ${existingStrategy[1]}`)
  } else {
    console.log(`[Info] Strategy ${BLUEE}${strategyIdx}${RESET} match.`)
  }
}

async function main() {

  // ========================= Address Book =========================

  const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599".toLowerCase()
  const CIAN_BTC_VAULT_ADDRESS = "0xd4Cc9b31e9eF33E392FF2f81AD52BE8523e0993b".toLowerCase()
  const BTCFI_CIAN_VAULT_ADDRESS = "0xe790C9D5C68EfAfCdc4f9c3E5BA153F89d837660".toLowerCase()



  // ====================== Prepare mock tokens ======================

  const cianBtcVaultInterface = new Interface(CIAN_VAULT_ABI)
  const cianBtcVault = await ethers.getContractAt("ERC20", CIAN_BTC_VAULT_ADDRESS)
  const wbtc = await ethers.getContractAt("ERC20", WBTC_ADDRESS)
  const btcfiVault = await ethers.getContractAt("LiquidVault", BTCFI_CIAN_VAULT_ADDRESS)

  const provider = ethers.provider
  let realAdmin: HardhatEthersSigner
  let realLiquidityManager: HardhatEthersSigner

  if (hardhatArguments.network === "hardhat") {
    console.log("\nSetting up hardhat testing environment (fork from mainnet @21350000)...")
    const ADMIN_ADDRESS = "0xEe8B9e072212f51B1A0c105E83b86bDC104f36B2".toLowerCase()
    const LIQUIDITY_MANAGER_ADDRESS = "0x4D077B30C6318D564c347382751bC284D4E844e9".toLowerCase()
    realAdmin = await ethers.getImpersonatedSigner(ADMIN_ADDRESS)
    realLiquidityManager = await ethers.getImpersonatedSigner(LIQUIDITY_MANAGER_ADDRESS)
    await provider.send("hardhat_setBalance", [ADMIN_ADDRESS, "0x1" + "0".repeat(20)])
    await provider.send("hardhat_setBalance", [LIQUIDITY_MANAGER_ADDRESS, "0x1" + "0".repeat(20)])
  } 
  
  else if (hardhatArguments.network === "mainnet") {
    console.log("\nSetting up ethereum mainnet environment...")
    const signers = await ethers.getSigners()
    realAdmin = signers[0]
    realLiquidityManager = signers[1]
    console.log(`Check admin: ${GREEN}${realAdmin.address}${RESET}`)
    console.log(`Check liquidity manager: ${GREEN}${realLiquidityManager.address}${RESET}`)
  }

  else {
    throw new Error("\nUnsupported network")
  }

  console.log()


  // ===================== Check strategies for CIAN =====================

  const strategyIdxDepositWbtcToCian = 4       // Strategy 4: Deposit $WBTC to CIAN's PumpBTC vault
  const restrictForDepositWbtcToCian = '0x32507a5f'
    + '000000000000000000000000' + WBTC_ADDRESS.slice(2)                  // Must be WBTC
    + '0000000000000000000000000000000000000000000000000000000000000000'  // Can be any amount
    + '000000000000000000000000' + BTCFI_CIAN_VAULT_ADDRESS.slice(2)      // Must be vault address
    + '0000000000000000000000000000000000000000000000000000000000000000'  // Must be zero address
  const maskForDepositWbtcToCian = '0xffffffff'
    + 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    + '0000000000000000000000000000000000000000000000000000000000000000'
    + 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    + 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
  await assertStrategyMatch(
    btcfiVault, strategyIdxDepositWbtcToCian, restrictForDepositWbtcToCian, maskForDepositWbtcToCian
  )

  const strategyIdxRequestRedeem = 5
  const restrictForRequestRedeem = '0xaa2f892d'
    + '0000000000000000000000000000000000000000000000000000000000000000'  // Can be any share balance
  const maskForRequestRedeem = '0xffffffff'
    + '0000000000000000000000000000000000000000000000000000000000000000'
  await assertStrategyMatch(
    btcfiVault, strategyIdxRequestRedeem, restrictForRequestRedeem, maskForRequestRedeem
  )

  const strategyIdxApproveWbtcForCian = 6
  const restrictForApproveWbtcForCian = '0x095ea7b3'
    + '000000000000000000000000' + CIAN_BTC_VAULT_ADDRESS.slice(2)
    + '0000000000000000000000000000000000000000000000000000000000000000'
  const maskForApproveWbtcForCian = '0xffffffff'
    + 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    + '0000000000000000000000000000000000000000000000000000000000000000'
  await assertStrategyMatch(
    btcfiVault, strategyIdxApproveWbtcForCian, restrictForApproveWbtcForCian, maskForApproveWbtcForCian
  )


  // ======================== Execute strategy ========================

  // 1. Execute strategy: approve $WBTC for CIAN's PumpBTC vault
  const txApprove = await btcfiVault.connect(realLiquidityManager).executeStrategy(
    strategyIdxApproveWbtcForCian,
    wbtc.interface.encodeFunctionData("approve", [
      CIAN_BTC_VAULT_ADDRESS, parseUnits("0.00000040", 8)   // 40 sats
    ])
  )
  console.log(`\n[Tx] Execute strategy (approve)...`)
  await txApprove.wait(1)
  console.log(`[Tx] Confirmation: ${BLUEE}${txApprove.hash}${RESET}`)
  console.log(`[Balance $WBTC] Btcfi vault before deposit : ${GREEN}${formatUnits(
    await wbtc.balanceOf(BTCFI_CIAN_VAULT_ADDRESS), 8
  )}${RESET}`)

  // 2. Execute strategy: deposit $WBTC to CIAN's PumpBTC vault
  const txDeposit = await btcfiVault.connect(realLiquidityManager).executeStrategy(
    strategyIdxDepositWbtcToCian,
    cianBtcVaultInterface.encodeFunctionData("optionalDeposit", [
      WBTC_ADDRESS, parseUnits("0.00000040", 8), BTCFI_CIAN_VAULT_ADDRESS, ZeroAddress,
    ])
  )
  console.log(`\n[Tx] Execute strategy (deposit)...`)
  await txDeposit.wait(1)
  console.log(`[Tx] Confirmation: ${BLUEE}${txDeposit.hash}${RESET}`)
  console.log(`[Balance $WBTC] Btcfi vault after deposit : ${GREEN}${formatUnits(
    await wbtc.balanceOf(BTCFI_CIAN_VAULT_ADDRESS), 8
  )}${RESET}`)

  // 3. Execute strategy: request redeem all shares from CIAN's PumpBTC vault
  const txRequestRedeem = await btcfiVault.connect(realLiquidityManager).executeStrategy(
    strategyIdxRequestRedeem,
    cianBtcVaultInterface.encodeFunctionData("requestRedeem", [
      await cianBtcVault.balanceOf(BTCFI_CIAN_VAULT_ADDRESS),
    ])
  )
  console.log(`\n[Tx] Execute strategy (request redeem)...`)
  await txRequestRedeem.wait(1)
  console.log(`[Tx] Confirmation: ${BLUEE}${txRequestRedeem.hash}${RESET}`)
  console.log(`[Balance $WBTC] Liquid vault after request : ${GREEN}${formatUnits(
    await wbtc.balanceOf(BTCFI_CIAN_VAULT_ADDRESS), 8
  )}${RESET}`)
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
