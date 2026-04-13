import { PublicKey, Connection } from '@solana/web3.js'
import { MAINNET_RPC } from './consts'

const pdaList = [
  '95oSa2aRyNHtXb5eaZkfpvGfCJ3oDVyUMUGfxvR75gCM',
  'A8may3M24ExYRuvVXPXP87zHFcgFhTPV75vzh4g3Av7f',
  '95oSa2aRyNHtXb5eaZkfpvGfCJ3oDVyUMUGfxvR75gCM',
  '87q24Pm3XzEs4NkW1TnsmFmxviJfRvMisAEYMxxZWXz1'
]
const main = async () => {
  const pubkey = '87q24Pm3XzEs4NkW1TnsmFmxviJfRvMisAEYMxxZWXz1'
  const connection = new Connection(MAINNET_RPC)

  const accountInfo = await connection.getAccountInfo(new PublicKey(pubkey))
  if (!accountInfo) {
    console.error('Account not found')
    return
  }

  console.log('Account data (base64):', accountInfo.data.toString('base64'))

  const arr = new Uint8Array(accountInfo.data)
  for (let i = 0; i < arr.length; i++) {
    const slice = arr.slice(i, i + 32)
    // console.log(`Bytes ${i} to ${i + 31}:`, Buffer.from(slice).toString('base64'))
    console.log('Pubkey:', new PublicKey(slice).toBase58())
  }
}

main()
