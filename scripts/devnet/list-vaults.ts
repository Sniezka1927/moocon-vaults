import { Connection, PublicKey } from '@solana/web3.js'
import { DEVNET_RPC } from '../consts'
import { Vault } from '../../ts-sdk'

const connection = new Connection(DEVNET_RPC, 'confirmed')
const vault = new Vault(connection)

const main = async () => {
  // @ts-ignore
  BigInt.prototype.toJSON = function () {
    return this.toString()
  }
  const state = await vault.fetcher.getState()
  console.log('State:', JSON.stringify(state, null, 2))

  for (let i = 0; i < state.lastVault; i++) {
    const [pda] = vault.fetcher.getVaultAddress(i)
    console.log(`Vault ${i} PDA:`, pda.toBase58())
  }

  const vaults = await vault.fetcher.getAllVaults()
  console.log('Vaults:', JSON.stringify(vaults, null, 2))

  const rewards = await vault.fetcher.getAllRewards()
  console.log('Rewards:', JSON.stringify(rewards, null, 2))

  const userRewards = await vault.fetcher.getRewardsForAddress(
    new PublicKey('BsYDTmksyvTWpP3DGSWpoAXP7ykFDhikYdKEVspkStc4')
  )
  console.log('User Reward:', JSON.stringify(userRewards, null, 2))
}

main()
