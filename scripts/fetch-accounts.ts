import { PublicKey } from '@solana/web3.js'
import { MAINNET_RPC } from './consts'

const MET_PID = new PublicKey('cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG')

const main = async () => {
  const now = Date.now()
  const accounts: { pubkey: string }[] = []

  let paginationKey: string | null = null

  do {
    const body: Record<string, unknown> = {
      jsonrpc: '2.0',
      id: '1',
      method: 'getProgramAccountsV2',
      params: [
        MET_PID.toBase58(),
        {
          commitment: 'confirmed',
          encoding: 'base64',
          limit: 10000,
          dataSlice: { offset: 0, length: 128 },
          ...(paginationKey ? { paginationKey } : {})
        }
      ]
    }

    const res = await fetch(MAINNET_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    const json = (await res.json()) as {
      result: { accounts: { pubkey: string }[]; paginationKey: string | null }
    }

    if (!json.result) {
      console.error('Unexpected response:', JSON.stringify(json, null, 2))
      break
    }

    const page = json.result.accounts
    if (!page || page.length === 0) break

    accounts.push(...page)
    if (accounts.length >= 50_000) break
    paginationKey = json.result.paginationKey ?? null
    // if (paginationKey) await new Promise(r => setTimeout(r, 200))
  } while (paginationKey !== null)

  const delta = Date.now() - now
  console.log('Fetched', accounts.length, 'accounts in ms:', delta)
}

main()
