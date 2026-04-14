import { vault } from '../../consts'
import { processVaultLifecycle } from './cron/lifecycle'
import { logError, logInfo } from './cron/logger'

// Entry point (called by Elysia cron every minute)
export const processDrawing = async () => {
  logInfo('drawing tick')

  try {
    const state = await vault.fetcher.getState(true)
    const vaultCount = state.lastVault

    for (let i = 0; i < vaultCount; i++) {
      try {
        const vaultAccount = await vault.fetcher.getVaultByIndex(i)
        await processVaultLifecycle(i, vaultAccount)
      } catch (err) {
        logError('vault processing error', { vaultIndex: i, err })
      }
    }
  } catch (err) {
    logError('fatal drawing cron error', { err })
  }
}
