import { create } from 'zustand'
import type { VaultAccount } from 'ts-sdk'
import type { PublicKey } from '@solana/web3.js'

export type VaultWithAddress = VaultAccount & { address: PublicKey; index: number }

interface VaultsState {
  vaults: VaultWithAddress[]
  vaultsError: string | null
  setVaults: (vaults: VaultWithAddress[]) => void
  setVaultsError: (error: string | null) => void
}

export const useVaultsStore = create<VaultsState>((set) => ({
  vaults: [],
  vaultsError: null,
  setVaults: (vaults) => set({ vaults }),
  setVaultsError: (vaultsError) => set({ vaultsError }),
}))
