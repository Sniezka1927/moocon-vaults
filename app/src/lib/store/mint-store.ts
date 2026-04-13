import { create } from 'zustand'
import { apiFetch } from '@/lib/api/client'
import type { MintData } from '@/lib/api/types'

interface MintStoreState {
  mints: Record<string, MintData>
  loaded: boolean
  fetchMints: () => Promise<void>
  getMint: (address: string) => MintData | undefined
}

export const useMintStore = create<MintStoreState>((set, get) => ({
  mints: {},
  loaded: false,
  fetchMints: async () => {
    if (get().loaded) return
    const data = await apiFetch<MintData[]>('/api/stats/mint-data')
    const map: Record<string, MintData> = {}
    for (const entry of data) map[entry.address] = entry
    set({ mints: map, loaded: true })
  },
  getMint: (address) => get().mints[address],
}))
