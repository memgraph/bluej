import express from 'express'
import { verifyJwt, AuthRequiredError } from '@atproto/xrpc-server'
import { DidResolver } from '@atproto/did-resolver'

export const validateAuth = async (
  req: express.Request,
  serviceDid: string,
  didResolver: DidResolver,
): Promise<string> => {
  const { authorization = '' } = req.headers
  if (!authorization.startsWith('Bearer ')) {
    // temp hack so we can test locally
    return 'did:plc:ewgejell4547pukut5255ibm'
    //throw new AuthRequiredError()
  }
  const jwt = authorization.replace('Bearer ', '').trim()
  return verifyJwt(jwt, serviceDid, async (did: string) => {
    return didResolver.resolveAtprotoKey(did)
  })
}
