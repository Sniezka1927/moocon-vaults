import assert from 'assert'
import * as anchor from '@coral-xyz/anchor'
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction
} from '@solana/web3.js'
import { createMint } from '@solana/spl-token'
import { Vault } from '../ts-sdk/vault'
import { signAndSend } from '../ts-sdk/utils'
import { VRF_TEST_AUTHORITY, airdrop } from './test-utils'

describe('set-fee-', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const admin = VRF_TEST_AUTHORITY
  const DUMMY_WRITABLE = Keypair.generate().publicKey

  let vault: Vault
  let mint: PublicKey
  let vaultIndex: number
  let vaultPda: PublicKey
  let pMint: PublicKey

  before(async () => {
    vault = new Vault(provider.connection)

    await airdrop(provider.connection, admin.publicKey, 5 * LAMPORTS_PER_SOL)

    try {
      const initIx = await vault.initializeIx({
        admin: admin.publicKey,
        vrfAuthority: admin.publicKey
      })
      await signAndSend(provider.connection, new Transaction().add(initIx), [
        admin
      ])
    } catch {
      /* already exists */
    }

    mint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      6
    )

    const fMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      6
    )

    vault.fetcher.state = null
    const stateAcc = await vault.fetcher.getState()
    vaultIndex = stateAcc.lastVault

    // Get vault PDA before creating pMint (pMint authority = vaultPda)
    ;[vaultPda] = vault.fetcher.getVaultAddress(vaultIndex)

    // Create pMint owned by vaultPda
    pMint = await createMint(provider.connection, admin, vaultPda, null, 6)

    const initVaultIx = await vault.initializeVaultIx({
      admin: admin.publicKey,
      mint,
      fMint,
      lending: DUMMY_WRITABLE,
      minDeposit: 0n,
      pMint,
      withdrawFee: 0n
    })
    await signAndSend(provider.connection, new Transaction().add(initVaultIx), [
      admin
    ])
  })

  it('set_withdraw_fee fails when fee > FEE_DENOMINATOR', async () => {
    const ix = await vault.setWithdrawFeeIx({
      admin: admin.publicKey,
      vaultIndex,
      withdrawFee: 1_000_001n
    })
    try {
      await signAndSend(provider.connection, new Transaction().add(ix), [admin])
      assert.fail('Should have thrown InvalidFee')
    } catch (e: any) {
      assert.ok(e.logs?.some((l: string) => l.includes('InvalidFee')) ?? true)
    }
  })

  it('set_withdraw_fee succeeds at exact boundary', async () => {
    const ix = await vault.setWithdrawFeeIx({
      admin: admin.publicKey,
      vaultIndex,
      withdrawFee: 1_000_000n
    })
    await signAndSend(provider.connection, new Transaction().add(ix), [admin])

    vault.fetcher.vaults.clear()
    const vaultAccount = await vault.fetcher.getVaultByIndex(vaultIndex)
    assert.equal(vaultAccount.withdrawFee, 1_000_000n)
  })

  it('set_withdraw_fee at zero', async () => {
    const ix = await vault.setWithdrawFeeIx({
      admin: admin.publicKey,
      vaultIndex,
      withdrawFee: 0n
    })
    await signAndSend(provider.connection, new Transaction().add(ix), [admin])

    vault.fetcher.vaults.clear()
    const vaultAccount = await vault.fetcher.getVaultByIndex(vaultIndex)
    assert.equal(vaultAccount.withdrawFee, 0n)
  })
})
