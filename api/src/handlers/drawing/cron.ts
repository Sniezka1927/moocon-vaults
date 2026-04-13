import { vault } from '../../consts'
import { processVaultLifecycle } from './cron/lifecycle'
import { logError, logInfo } from './cron/logger'

// Entry point (called by Elysia cron every minute)
export const processDrawing = async () => {
  logInfo('drawing tick')

  try {
    const vaults = await vault.fetcher.getAllVaults(true)

    for (let i = 0; i < vaults.length; i++) {
      try {
        await processVaultLifecycle(i, vaults[i])
      } catch (err) {
        logError('vault processing error', { vaultIndex: i, err })
      }
    }
  } catch (err) {
    logError('fatal drawing cron error', { err })
  }
}
