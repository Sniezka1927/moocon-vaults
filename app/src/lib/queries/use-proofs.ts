import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import type { DrawingProofsResponse, WalletProofResponse } from '@/lib/api/types'

export function useDrawingProofs(drawingId: string) {
  return useQuery({
    queryKey: queryKeys.proofs.byDrawing(drawingId),
    queryFn: () => apiFetch<DrawingProofsResponse>(`/api/proofs/${drawingId}`),
    enabled: Boolean(drawingId),
    staleTime: 60_000,
    gcTime: 300_000,
  })
}

export function useDrawingProofsByVaultRound(vault: string, round: number) {
  return useQuery({
    queryKey: queryKeys.proofs.byVaultRound(vault, round),
    queryFn: () => apiFetch<DrawingProofsResponse>(`/api/proofs/vault/${vault}/${round}`),
    enabled: Boolean(vault) && round > 0,
    staleTime: 60_000,
    gcTime: 300_000,
  })
}

export function useWalletProof(drawingId: string, wallet: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.proofs.byDrawingWallet(drawingId, wallet ?? ''),
    queryFn: () => apiFetch<WalletProofResponse>(`/api/proofs/${drawingId}/${wallet}`),
    enabled: Boolean(drawingId) && Boolean(wallet),
    staleTime: 60_000,
    gcTime: 300_000,
  })
}
