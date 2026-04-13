import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function solscanUrl(path: string, isDevnet: boolean): string {
  const base = 'https://solscan.io'
  const cluster = isDevnet ? '?cluster=devnet' : ''
  return `${base}${path}${cluster}`
}

export function openSolscan(path: string, rpcUrl: string) {
  const isDevnet = rpcUrl.includes('devnet')
  window.open(solscanUrl(path, isDevnet), '_blank')
}

export function ellipsify(str = '', len = 4, delimiter = '..') {
  const strLen = str.length
  const limit = len * 2 + delimiter.length

  return strLen >= limit ? str.substring(0, len) + delimiter + str.substring(strLen - len, strLen) : str
}
