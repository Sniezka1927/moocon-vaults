import { create } from 'zustand'
import type { VaultAccount } from 'ts-sdk'
import type { PublicKey } from '@solana/web3.js'

export type VaultWithAddress = VaultAccount & { address: PublicKey; index: number }

interface VaultsState {
  vaults: VaultWithAddress[]
  vaultsLoading: boolean
  vaultsError: string | null
  setVaults: (vaults: VaultWithAddress[]) => void
  setVaultsLoading: (loading: boolean) => void
  setVaultsError: (error: string | null) => void
}

export const useVaultsStore = create<VaultsState>((set) => ({
  vaults: [],
  vaultsLoading: false,
  vaultsError: null,
  setVaults: (vaults) => set({ vaults }),
  setVaultsLoading: (vaultsLoading) => set({ vaultsLoading }),
  setVaultsError: (vaultsError) => set({ vaultsError }),
}))
