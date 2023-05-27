import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../lexicon'
import { AppContext } from '../config'
import algos from '../algos'
import { validateAuth } from '../auth'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeedSkeleton(async ({ params, req }) => {
    let algo = algos[params.feed]
    if (!algo) {
      // seems encoded feed can sometimes break things, try this as work around
      algo = algos[decodeURI(params.feed)]
    }
    if (!algo) {
      throw new InvalidRequestError(
        'Unsupported algorithm',
        'UnsupportedAlgorithm',
      )
    }
    let requesterDid = ''
    try {
      requesterDid = await validateAuth(
        req,
        ctx.cfg.serviceDid,
        ctx.didResolver,
      )
    } catch (e) {
      console.error(e)
    }
    const body = await algo(ctx, params, requesterDid)
    return {
      encoding: 'application/json',
      body: body,
    }
  })
}
