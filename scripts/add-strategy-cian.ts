import "dotenv/config"
import { ethers } from "hardhat";

const GREEN = "\x1b[32m"
const BLUEE = "\x1b[34m"
const RESET = "\x1b[0m"

async function main() {

  /**
   * Uncomment next line to run on mainnet:
   *  npx hardhat run --network mainnet ./scripts/add-strategy-cian.ts
   */
  // const [realAdmin] = await ethers.getSigners()
  
  /**
   * Use next 3 lines to simulate on mainnet fork:
   *  npx hardhat run --network hardhat ./scripts/add-strategy-cian.ts
   */
  const provider = ethers.provider
  const realAdmin = await ethers.getImpersonatedSigner("0xEe8B9e072212f51B1A0c105E83b86bDC104f36B2")
  await provider.send("hardhat_setBalance", [realAdmin.address, "0x1" + "0".repeat(20)])


  // ======================== Prepare addresses =======================
  const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599".toLowerCase()
  const CIAN_BTC_VAULT_ADDRESS = "0xd4Cc9b31e9eF33E392FF2f81AD52BE8523e0993b".toLowerCase()

  const liquidVault = await ethers.getContractAt("LiquidVault", process.env.MAINNET_CIAN_LVAULT!)
  const liquidVaultAddress = await liquidVault.getAddress()

  // ====================== Add deposit strategy ======================
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


  // =================== Add request-redeem strategy ==================
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


  // ====================== Add approve strategy ======================
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

}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
