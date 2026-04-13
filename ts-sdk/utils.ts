import {
  Keypair,
  Transaction,
  Connection,
  PublicKey,
  TransactionInstruction,
  SystemProgram
} from '@solana/web3.js'
import { Buffer } from 'node:buffer'
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction,
  createSetAuthorityInstruction,
  AuthorityType
} from '@solana/spl-token'
import {
  createMetadataAccountV3,
  findMetadataPda,
  mplTokenMetadata
} from '@metaplex-foundation/mpl-token-metadata'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import {
  toWeb3JsInstruction,
  fromWeb3JsPublicKey
} from '@metaplex-foundation/umi-web3js-adapters'
import { ICreateMintIx } from './types'

export const signAndSend = async (
  connection: Connection,
  transaction: Transaction,
  signers: Keypair[]
): Promise<string> => {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash()

  transaction.recentBlockhash = blockhash
  transaction.lastValidBlockHeight = lastValidBlockHeight
  transaction.feePayer = signers[0].publicKey

  transaction.sign(...signers)

  const signature = await connection.sendRawTransaction(
    transaction.serialize(),
    {
      skipPreflight: true
    }
  )

  const result = await connection.confirmTransaction(
    { blockhash, lastValidBlockHeight, signature },
    'confirmed'
  )

  if (result.value.err) {
    const txResult = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    })
    throw Object.assign(
      new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`),
      {
        logs: txResult?.meta?.logMessages ?? []
      }
    )
  }

  return signature
}

export const createMintWithMetadataIxs = async (
  params: ICreateMintIx
): Promise<{
  instructions: TransactionInstruction[]
  mintKeypair: Keypair
}> => {
  const {
    connection,
    vault,
    payer,
    name,
    symbol,
    uri,
    decimals,
    preparedKeypair,
    authorityOverride
  } = params

  const mintKeypair = preparedKeypair ?? Keypair.generate()
  const mintPubkey = mintKeypair.publicKey
  const authority = authorityOverride ?? vault

  const lamports = await getMinimumBalanceForRentExemptMint(connection)

  const ixs: TransactionInstruction[] = []

  // 1. Create account for mint
  ixs.push(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mintPubkey,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID
    })
  )

  // 2. Initialize mint with payer as temporary authority
  ixs.push(createInitializeMintInstruction(mintPubkey, decimals, payer, null))

  // 3. Create metadata account via UMI
  const umi = createUmi(connection.rpcEndpoint).use(mplTokenMetadata())
  const umiMint = fromWeb3JsPublicKey(mintPubkey)
  const umiPayer = fromWeb3JsPublicKey(payer)

  const metadataIxBuilder = createMetadataAccountV3(umi, {
    metadata: findMetadataPda(umi, { mint: umiMint }),
    mint: umiMint,
    mintAuthority: umiPayer,
    payer: umiPayer,
    updateAuthority: umiPayer,
    data: {
      name,
      symbol,
      uri,
      sellerFeeBasisPoints: 0,
      creators: null,
      collection: null,
      uses: null
    },
    isMutable: true,
    collectionDetails: null
  })

  const umiIxs = metadataIxBuilder.getInstructions()
  for (const umiIx of umiIxs) {
    ixs.push(toWeb3JsInstruction(umiIx))
  }

  // 4. Transfer mint authority from payer to vault PDA
  ixs.push(
    createSetAuthorityInstruction(
      mintPubkey,
      payer,
      AuthorityType.MintTokens,
      authority
    )
  )

  return { instructions: ixs, mintKeypair }
}

export const getClaimAccount = (assetAddress: PublicKey, user: PublicKey) => {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_claim'), user.toBuffer(), assetAddress.toBuffer()],
    new PublicKey('5uDkCoM96pwGYhAUucvCzLfm5UcjVRuxz6gH81RnRBmL') //LIQUIDITY_PROGRAM_ID
  )
  return pda
}
