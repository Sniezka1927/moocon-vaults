import { Program, EventParser, BorshCoder } from '@coral-xyz/anchor'
import { Connection, PublicKey } from '@solana/web3.js'
import { PremiumVaults } from './idl/premium_vaults'

export interface CommitEventData {
  vault: PublicKey
  round: number
  amount: bigint
  merkleRoot: number[]
  secretHash: number[]
  vrfSeed: number[]
}

export interface RevealEventData {
  vault: PublicKey
  round: number
  secretSeed: number[]
  randomness: number[]
  winnerIndex: bigint
}

export async function parseEvents(
  program: Program<PremiumVaults>,
  connection: Connection,
  signature: string
): Promise<{ name: string; data: any }[]> {
  const tx = await connection.getTransaction(signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0
  })

  if (!tx?.meta?.logMessages) return []

  const parser = new EventParser(program.programId, new BorshCoder(program.idl))
  const events: { name: string; data: any }[] = []

  const gen = parser.parseLogs(tx.meta.logMessages)
  let next = gen.next()
  while (!next.done) {
    events.push({ name: next.value.name, data: next.value.data })
    next = gen.next()
  }

  return events
}
