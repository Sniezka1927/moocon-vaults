import assert from 'assert'
import * as anchor from '@coral-xyz/anchor'
import { Keypair, LAMPORTS_PER_SOL, Transaction } from '@solana/web3.js'
import { createMint } from '@solana/spl-token'
import { Vault } from '../ts-sdk/vault'
import { signAndSend } from '../ts-sdk/utils'
import { VRF_TEST_AUTHORITY, airdrop, TIER_60_40 } from './test-utils'

describe('moocon-vaults admin', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const admin = VRF_TEST_AUTHORITY
  const vrfAuthority = VRF_TEST_AUTHORITY
  const DUMMY_LENDING = Keypair.generate().publicKey
  let vault: Vault
  let mint: anchor.web3.PublicKey
  let fMint: anchor.web3.PublicKey

  before(async () => {
    vault = new Vault(provider.connection)

    await airdrop(provider.connection, admin.publicKey, 2 * LAMPORTS_PER_SOL)

    mint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      6
    )

    fMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      6
    )
  })

  it('initialize', async () => {
    const ix = await vault.initializeIx({
      admin: admin.publicKey,
      vrfAuthority: vrfAuthority.publicKey
    })
    await signAndSend(provider.connection, new Transaction().add(ix), [admin])

    vault.fetcher.state = null
    const state = await vault.fetcher.getState()
    assert.ok(state.admin.equals(admin.publicKey), 'admin mismatch')
    assert.ok(
      state.vrfAuthority.equals(vrfAuthority.publicKey),
      'vrfAuthority mismatch'
    )
    assert.equal(state.lastVault, 0)
  })

  it('set_vrf_authority', async () => {
    const newVrfAuthority = Keypair.generate()
    const ix = await vault.setVrfAuthorityIx({
      admin: admin.publicKey,
      newVrfAuthority: newVrfAuthority.publicKey
    })
    await signAndSend(provider.connection, new Transaction().add(ix), [admin])

    vault.fetcher.state = null
    const state = await vault.fetcher.getState()
    assert.ok(
      state.vrfAuthority.equals(newVrfAuthority.publicKey),
      'vrfAuthority not updated'
    )

    // Restore vrfAuthority for subsequent test suites
    const restoreIx = await vault.setVrfAuthorityIx({
      admin: admin.publicKey,
      newVrfAuthority: vrfAuthority.publicKey
    })
    await signAndSend(provider.connection, new Transaction().add(restoreIx), [
      admin
    ])
  })

  it('initialize_vault', async () => {
    const [vaultPda] = vault.fetcher.getVaultAddress(0)
    const pMint = await createMint(
      provider.connection,
      admin,
      vaultPda,
      null,
      6
    )
    const ix = await vault.initializeVaultIx({
      admin: admin.publicKey,
      mint,
      fMint,
      pMint,
      lending: DUMMY_LENDING,
      minDeposit: 1_000_000n,
      withdrawFee: 50n,
      tiers: TIER_60_40
    })
    await signAndSend(provider.connection, new Transaction().add(ix), [admin])

    vault.fetcher.vaults.clear()
    const vaultAccount = await vault.fetcher.getVaultByIndex(0)

    assert.equal(vaultAccount.minDeposit, 1_000_000n)
    assert.equal(vaultAccount.withdrawFee, 50n)
    assert.ok(vaultAccount.mint.equals(mint), 'mint mismatch')
    assert.ok(vaultAccount.fMint.equals(fMint), 'fMint mismatch')
    assert.ok(vaultAccount.pMint.equals(pMint), 'pMint mismatch')
    assert.ok(vaultAccount.lending.equals(DUMMY_LENDING), 'lending mismatch')

    vault.fetcher.state = null
    const state = await vault.fetcher.getState()
    assert.equal(state.lastVault, 1)
  })

  it('set_vrf_authority fails for non-admin', async () => {
    const nonAdmin = Keypair.generate()
    await airdrop(provider.connection, nonAdmin.publicKey, LAMPORTS_PER_SOL)

    const ix = await vault.setVrfAuthorityIx({
      admin: nonAdmin.publicKey,
      newVrfAuthority: Keypair.generate().publicKey
    })
    try {
      await signAndSend(provider.connection, new Transaction().add(ix), [
        nonAdmin
      ])
      assert.fail('Should have thrown')
    } catch (e: any) {
      assert.ok(e.logs?.some((l: string) => l.includes('Unauthorized')) ?? true)
    }
  })

  it('set_withdraw_fee fails for non-admin', async () => {
    const nonAdmin = Keypair.generate()
    await airdrop(provider.connection, nonAdmin.publicKey, LAMPORTS_PER_SOL)

    const ix = await vault.setWithdrawFeeIx({
      admin: nonAdmin.publicKey,
      vaultIndex: 0,
      withdrawFee: 999n
    })
    try {
      await signAndSend(provider.connection, new Transaction().add(ix), [
        nonAdmin
      ])
      assert.fail('Should have thrown')
    } catch (e: any) {
      assert.ok(e.logs?.some((l: string) => l.includes('Unauthorized')) ?? true)
    }
  })

  it('set_withdraw_fee', async () => {
    const ix = await vault.setWithdrawFeeIx({
      admin: admin.publicKey,
      vaultIndex: 0,
      withdrawFee: 99n
    })
    await signAndSend(provider.connection, new Transaction().add(ix), [admin])

    vault.fetcher.vaults.clear()
    const vaultAccount = await vault.fetcher.getVaultByIndex(0)
    assert.equal(vaultAccount.withdrawFee, 99n)
  })
})
