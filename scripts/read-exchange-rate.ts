import { MAINNET_RPC } from './consts'

const LENDING_ACCOUNT = 'Ey9UTFK5KDMZJuHqndU8kYrSrWHQb5uQqNEaTk57Toc'
const TOKEN_EXCHANGE_PRICE_OFFSET = 115

async function main() {
  const res = await fetch(MAINNET_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getAccountInfo',
      params: [LENDING_ACCOUNT, { encoding: 'base64' }]
    })
  })

  const json = (await res.json()) as {
    result?: { value?: { data?: [string, string] } }
  }

  const raw = json.result?.value?.data?.[0]
  if (!raw) {
    console.error('Account not found or empty')
    return
  }

  const buf = Buffer.from(raw, 'base64')
  console.log('Account data length:', buf.length)

  if (buf.length < TOKEN_EXCHANGE_PRICE_OFFSET + 8) {
    console.error(
      `Data too short (${buf.length} bytes), need at least ${
        TOKEN_EXCHANGE_PRICE_OFFSET + 8
      }`
    )
    return
  }

  const exchangeRate = buf.readBigUInt64LE(TOKEN_EXCHANGE_PRICE_OFFSET)
  console.log('Current time:', new Date().toISOString())
  console.log('token_exchange_price (raw u64):', exchangeRate.toString())
  console.log('token_exchange_price (/ 1e12):', Number(exchangeRate) / 1e12)
}

main()
