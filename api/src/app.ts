import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'
import { proofsHandler } from './handlers/proofs'
import { drawingHandler } from './handlers/drawing'
import { statsHandler } from './handlers/stats'
import { pointsHandler } from './handlers/points'
import { referralsHandler } from './handlers/referrals'
import { eventsHandler } from './handlers/events'
import logixlysia from 'logixlysia'

const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000'

const appInstance = new Elysia()
  .use(
    cors({
      origin: '*'
    })
  )
  .use(
    logixlysia({
      config: {
        service: 'api-server',
        showStartupMessage: true,
        startupMessageFormat: 'banner',
        showContextTree: true,
        contextDepth: 2,
        slowThreshold: 500,
        verySlowThreshold: 1000,
        timestamp: {
          translateTime: 'yyyy-mm-dd HH:MM:ss.SSS'
        },
        ip: true
      }
    })
  )
  .get('/health', () => ({ status: 'ok' as const }))
  .use(proofsHandler)
  .use(drawingHandler)
  .use(statsHandler)
  .use(pointsHandler)
  .use(referralsHandler)
  .use(eventsHandler)

export const app = appInstance

export type App = typeof app
