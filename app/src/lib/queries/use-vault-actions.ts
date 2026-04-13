import React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { SystemProgram, Transaction } from '@solana/web3.js'
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
  NATIVE_MINT
} from '@solana/spl-token'
import { toast } from 'sonner'
import { getLendingAccountsForMint, getClaimAccount } from 'ts-sdk'
import type { RewardAccount } from 'ts-sdk'
import { useVaults } from '@/lib/vaults/context'
import { openSolscan } from '@/lib/utils'
import { queryKeys } from '@/lib/api/query-keys'
import type { VaultWithAddress } from '@/lib/store/vault-store'
import { useMintStore } from '@/lib/store/mint-store'

// Backpack closes its popup after approval and throws "Plugin Closed" even though
// the transaction was successfully sent. Treat it as a submitted (not rejected) tx.
function isPluginClosed(e: Error) {
  return e.message?.toLowerCase().includes('plugin closed')
}

function isUserRejection(e: Error) {
  const msg = e.message?.toLowerCase() ?? ''
  return msg.includes('user rejected') || msg.includes('cancelled')
}

async function invalidateAfterAction(
  qc: ReturnType<typeof useQueryClient>,
  vault: VaultWithAddress
) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.vaults.all() }),
    qc.invalidateQueries({ queryKey: ['points'] }),
    qc.invalidateQueries({ queryKey: ['drawings', 'check'] }),
    qc.invalidateQueries({
      queryKey: ['user', 'deposited', vault.address.toBase58()]
    }),
    qc.invalidateQueries({
      queryKey: ['user', 'pTokenBalance', vault.address.toBase58()]
    }),
    qc.invalidateQueries({
      queryKey: ['user', 'tokenBalance', vault.mint.toBase58()]
    }),
    qc.invalidateQueries({
      queryKey: ['user', 'totalDepositsUsd']
    }),
    qc.invalidateQueries({
      queryKey: ['user', 'nativeSol']
    })
  ])
}

export function useDeposit(vault: VaultWithAddress) {
  const { publicKey, sendTransaction } = useWallet()
  const { connection } = useConnection()
  const program = useVaults()
  const qc = useQueryClient()
  const getMint = useMintStore.getState().getMint

  return useMutation({
    mutationFn: async (amount: bigint) => {
      if (!publicKey || !program) throw new Error('Wallet not connected')
      const la = getLendingAccountsForMint(vault.mint)
      if (!la) throw new Error('Unsupported mint')

      const isSol = vault.mint.equals(NATIVE_MINT)

      const depositorTokenAccount = getAssociatedTokenAddressSync(
        vault.mint,
        publicKey,
        false
      )
      const vaultTokenAccount = getAssociatedTokenAddressSync(
        vault.mint,
        vault.address,
        true
      )
      const depositorPTokenAccount = getAssociatedTokenAddressSync(
        vault.pMint,
        publicKey,
        false
      )
      const recipientTokenAccount = getAssociatedTokenAddressSync(
        la.fTokenMint,
        vault.address,
        true
      )

      const depositIx = await program.depositIx({
        depositor: publicKey,
        vaultIndex: vault.index,
        amount,
        depositorTokenAccount,
        vaultTokenAccount,
        recipientTokenAccount,
        mint: vault.mint,
        pMint: vault.pMint,
        depositorPTokenAccount,
        lendingAccounts: la
      })

      try {
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash()
        const tx = new Transaction()

        if (isSol) {
          // Check if WSOL ATA already exists
          const ataInfo = await connection.getAccountInfo(depositorTokenAccount)
          if (!ataInfo) {
            tx.add(
              createAssociatedTokenAccountInstruction(
                publicKey,
                depositorTokenAccount,
                publicKey,
                NATIVE_MINT
              )
            )
          }
          // Transfer lamports into the WSOL ATA and sync
          tx.add(
            SystemProgram.transfer({
              fromPubkey: publicKey,
              toPubkey: depositorTokenAccount,
              lamports: amount
            }),
            createSyncNativeInstruction(depositorTokenAccount)
          )
        }

        tx.add(depositIx)

        if (isSol) {
          // Close WSOL account to unwrap remaining lamports back to wallet
          tx.add(
            createCloseAccountInstruction(
              depositorTokenAccount,
              publicKey,
              publicKey
            )
          )
        }

        tx.feePayer = publicKey
        tx.lastValidBlockHeight = lastValidBlockHeight
        tx.recentBlockhash = blockhash
        const sig = await sendTransaction(tx, connection)
        await connection.confirmTransaction({
          blockhash,
          lastValidBlockHeight,
          signature: sig
        })

        return sig
      } catch (e) {
        console.log('Error while sending transaction', JSON.stringify(e))
        if (isPluginClosed(e as Error)) {
          invalidateAfterAction(qc, vault)
          return null
        }
        throw e
      }
    },
    onSuccess: async (sig) => {
      await invalidateAfterAction(qc, vault)

      if (!sig) {
        return
      }
      let depositedAmount: number | null = null
      if (sig) {
        const txMeta = await connection.getTransaction(sig, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        })
        const mintStr = vault.mint.toBase58()
        const ownerStr = publicKey?.toBase58()
        const pre = txMeta?.meta?.preTokenBalances?.find(
          (b) => b.mint === mintStr && b.owner === ownerStr
        )
        const post = txMeta?.meta?.postTokenBalances?.find(
          (b) => b.mint === mintStr && b.owner === ownerStr
        )
        console.log(pre, post)
        const preAmt = pre?.uiTokenAmount.uiAmount ?? null
        const postAmt = post?.uiTokenAmount.uiAmount ?? null
        if (preAmt !== null && postAmt !== null) {
          depositedAmount = preAmt - postAmt
        }
      }

      const tokenMeta = getMint(vault.mint.toBase58())
      const message =
        depositedAmount !== null && tokenMeta
          ? React.createElement(
              'span',
              { className: 'flex items-center gap-1.5' },
              `Deposited ${depositedAmount.toLocaleString(undefined, { maximumFractionDigits: tokenMeta.decimals })}`,
              React.createElement('img', {
                src: tokenMeta.icon ?? '',
                className: 'w-4 h-4 min-w-4 min-h-4 rounded-full object-cover',
                alt: tokenMeta.symbol ?? ''
              })
            )
          : 'Deposit successful!'

      toast.success(message, {
        action: sig
          ? {
              label: '↗ View on Solscan',
              onClick: () => openSolscan(`/tx/${sig}`, connection.rpcEndpoint)
            }
          : undefined,
        classNames: {
          actionButton:
            '!bg-[#0D2035] !border !border-[#1A3A5C] !text-[#75D4E8] !text-xs !font-medium hover:!bg-[#112840] !rounded-md !px-3 !py-1'
        }
      })
    },
    onError: (e: Error) => {
      if (!isUserRejection(e)) toast.error(e.message || 'Deposit failed')
    }
  })
}

export function useWithdraw(vault: VaultWithAddress) {
  const { publicKey, sendTransaction } = useWallet()
  const { connection } = useConnection()
  const program = useVaults()
  const qc = useQueryClient()
  const getMint = useMintStore.getState().getMint

  return useMutation({
    mutationFn: async (amount: bigint) => {
      if (!publicKey || !program) throw new Error('Wallet not connected')
      const la = getLendingAccountsForMint(vault.mint)
      if (!la) throw new Error('Unsupported mint')

      const isSol = vault.mint.equals(NATIVE_MINT)

      const vaultFTokenAccount = getAssociatedTokenAddressSync(
        la.fTokenMint,
        vault.address,
        true
      )
      const vaultTokenAccount = getAssociatedTokenAddressSync(
        vault.mint,
        vault.address,
        true
      )
      const withdrawerTokenAccount = getAssociatedTokenAddressSync(
        vault.mint,
        publicKey,
        false
      )
      const withdrawerPTokenAccount = getAssociatedTokenAddressSync(
        vault.pMint,
        publicKey,
        false
      )
      const claimAccount = getClaimAccount(vault.mint, la.lendingAdmin)

      const withdrawIx = await program.withdrawIx({
        withdrawer: publicKey,
        vaultIndex: vault.index,
        amount,
        vaultFTokenAccount,
        vaultTokenAccount,
        withdrawerTokenAccount,
        mint: vault.mint,
        pMint: vault.pMint,
        withdrawerPTokenAccount,
        claimAccount,
        lendingAccounts: la
      })

      try {
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash()
        const tx = new Transaction()

        if (isSol) {
          // Ensure WSOL ATA exists to receive withdrawn tokens
          const ataInfo = await connection.getAccountInfo(
            withdrawerTokenAccount
          )
          if (!ataInfo) {
            tx.add(
              createAssociatedTokenAccountInstruction(
                publicKey,
                withdrawerTokenAccount,
                publicKey,
                NATIVE_MINT
              )
            )
          }
        }

        tx.add(withdrawIx)

        if (isSol) {
          // Close WSOL account to unwrap to native SOL
          tx.add(
            createCloseAccountInstruction(
              withdrawerTokenAccount,
              publicKey,
              publicKey
            )
          )
        }

        tx.feePayer = publicKey
        tx.lastValidBlockHeight = lastValidBlockHeight
        tx.recentBlockhash = blockhash
        const sig = await sendTransaction(tx, connection)
        await connection.confirmTransaction({
          blockhash,
          lastValidBlockHeight,
          signature: sig
        })
        return sig
      } catch (e) {
        if (isPluginClosed(e as Error)) {
          invalidateAfterAction(qc, vault)
          return null
        }
        throw e
      }
    },
    onSuccess: async (sig) => {
      await invalidateAfterAction(qc, vault)

      let withdrawnAmount: number | null = null
      if (sig) {
        const txMeta = await connection.getTransaction(sig, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        })
        const mintStr = vault.mint.toBase58()
        const ownerStr = publicKey?.toBase58()
        const pre = txMeta?.meta?.preTokenBalances?.find(
          (b) => b.mint === mintStr && b.owner === ownerStr
        )
        const post = txMeta?.meta?.postTokenBalances?.find(
          (b) => b.mint === mintStr && b.owner === ownerStr
        )
        const preAmt = pre?.uiTokenAmount.uiAmount ?? null
        const postAmt = post?.uiTokenAmount.uiAmount ?? null
        if (preAmt !== null && postAmt !== null) {
          withdrawnAmount = postAmt - preAmt
        }
      }

      const tokenMeta = getMint(vault.mint.toBase58())
      const message =
        withdrawnAmount !== null && tokenMeta
          ? React.createElement(
              'span',
              { className: 'flex items-center gap-1.5' },
              `Withdrew ${withdrawnAmount.toLocaleString(undefined, { maximumFractionDigits: tokenMeta.decimals })}`,
              React.createElement('img', {
                src: tokenMeta.icon ?? '',
                className: 'w-4 h-4 min-w-4 min-h-4 rounded-full object-cover',
                alt: tokenMeta.symbol ?? ''
              })
            )
          : 'Withdrawal successful!'

      toast.success(message, {
        action: sig
          ? {
              label: '↗ View on Solscan',
              onClick: () => openSolscan(`/tx/${sig}`, connection.rpcEndpoint)
            }
          : undefined,
        classNames: {
          actionButton:
            '!bg-[#0D2035] !border !border-[#1A3A5C] !text-[#75D4E8] !text-xs !font-medium hover:!bg-[#112840] !rounded-md !px-3 !py-1'
        }
      })
    },
    onError: (e: Error) => {
      if (!isUserRejection(e)) toast.error(e.message || 'Withdrawal failed')
    }
  })
}

export function useClaimReward() {
  const { publicKey, sendTransaction } = useWallet()
  const { connection } = useConnection()
  const program = useVaults()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      reward,
      vault
    }: {
      reward: RewardAccount
      vault: VaultWithAddress
    }) => {
      if (!publicKey || !program) throw new Error('Wallet not connected')

      const ix = await program.claimIx({
        claimer: publicKey,
        vaultIndex: vault.index,
        round: reward.round,
        pMint: vault.pMint
      })

      try {
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash()
        const tx = new Transaction().add(ix)
        tx.feePayer = publicKey
        tx.recentBlockhash = blockhash
        tx.lastValidBlockHeight = lastValidBlockHeight
        const sig = await sendTransaction(tx, connection)
        await connection.confirmTransaction({
          blockhash,
          lastValidBlockHeight,
          signature: sig
        })
        return sig
      } catch (e) {
        if (isPluginClosed(e as Error)) return null
        throw e
      }
    },
    onSuccess: async (sig) => {
      await qc.invalidateQueries({ queryKey: ['rewards', 'user'] })
      toast.success('Reward claimed!', {
        action: sig
          ? {
              label: '↗ View on Solscan',
              onClick: () => openSolscan(`/tx/${sig}`, connection.rpcEndpoint)
            }
          : undefined,
        classNames: {
          actionButton:
            '!bg-[#0D2035] !border !border-[#1A3A5C] !text-[#75D4E8] !text-xs !font-medium hover:!bg-[#112840] !rounded-md !px-3 !py-1'
        }
      })
    },
    onError: (e: Error) => {
      if (!isUserRejection(e)) toast.error(e.message || 'Claim failed')
    }
  })
}

export function useClaimAllRewards() {
  const { publicKey, sendTransaction } = useWallet()
  const { connection } = useConnection()
  const program = useVaults()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (
      pairs: { reward: RewardAccount; vault: VaultWithAddress }[]
    ) => {
      if (!publicKey || !program) throw new Error('Wallet not connected')

      const instructions = await Promise.all(
        pairs.map(({ reward, vault }) => {
          return program.claimIx({
            claimer: publicKey,
            vaultIndex: vault.index,
            round: reward.round,
            pMint: vault.pMint
          })
        })
      )

      try {
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash()
        const tx = new Transaction()
        instructions.forEach((ix) => tx.add(ix))
        tx.feePayer = publicKey
        tx.recentBlockhash = blockhash
        tx.lastValidBlockHeight = lastValidBlockHeight
        const sig = await sendTransaction(tx, connection)
        await connection.confirmTransaction({
          blockhash,
          lastValidBlockHeight,
          signature: sig
        })
        return sig
      } catch (e) {
        if (isPluginClosed(e as Error)) return null
        throw e
      }
    },
    onSuccess: async (sig) => {
      await qc.invalidateQueries({ queryKey: ['rewards', 'user'] })
      toast.success('All rewards claimed!', {
        action: sig
          ? {
              label: '↗ View on Solscan',
              onClick: () => openSolscan(`/tx/${sig}`, connection.rpcEndpoint)
            }
          : undefined,
        classNames: {
          actionButton:
            '!bg-[#0D2035] !border !border-[#1A3A5C] !text-[#75D4E8] !text-xs !font-medium hover:!bg-[#112840] !rounded-md !px-3 !py-1'
        }
      })
    },
    onError: (e: Error) => {
      if (!isUserRejection(e)) toast.error(e.message || 'Claim all failed')
    }
  })
}
