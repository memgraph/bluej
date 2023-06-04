
import { InvalidRequestError } from '@atproto/xrpc-server'
import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { parallelQueries } from './parralel-queries'
import { weightedRoundRobin } from './weighted-round-robin'
import { followQuery, topFollowQuery, communityQuery } from './queries'

export const uri = 'at://did:plc:ewgejell4547pukut5255ibm/app.bsky.feed.generator/friendcomm'

export const handler = async (ctx: AppContext, params: QueryParams, requesterDid: string) => {

    let limit = params.limit ? params.limit : 50
    let cursor = params.cursor ? params.cursor : undefined

    console.log('did: ', requesterDid, 'cursor: ', cursor, 'limit:', limit)

    let maxNodeId = 0 // if there is a cursor this will be the max node.id that will be used in the query so the result will be the same as in the previous page. 0 means the first page as it'll be ignored in the query execution
    let position = 0  // the return array will be sliced from this position to the limit, default is 0 if no cursor is provided

    if (cursor !== undefined) {
        const [maxNodeId, cid, position] = cursor.split('::')
        if (!maxNodeId || !cid || !position) {
            console.log('malformed cursor')
            throw new InvalidRequestError('malformed cursor')
        }
        if (cid !== requesterDid) {
            console.log('incorrect cursor for DID')
            throw new InvalidRequestError('incorrect cursor for DID')
        }
    }

    try {
        // the number of results defined by limit determines how it will be distributed in the weightedRoundRobin call below
        let queryResults = await parallelQueries(requesterDid, maxNodeId, { 
            follow: { query: followQuery, limit: 200},
            topFollow: {query: topFollowQuery, limit: 100 },
            community: { query: communityQuery, limit: 100 }
        })

        // distribute the posts returned using a weighted round robin algorithm, using the length of the array as the weight
        let results = weightedRoundRobin([queryResults.follow, queryResults.topFollow, queryResults.community])
        results = results.slice(position, limit)

        // Set a new cursor for the next page. -1 as Array.slice uses 0 as offset
        if (maxNodeId === 0) {
            maxNodeId = Math.max(
                Math.max(...queryResults.follow.map(i => i.id)),
                Math.max(...queryResults.topFollow.map(i => i.id)),
                Math.max(...queryResults.community.map(i => i.id))
            )
        }
        position += (limit - 1)
        cursor = encodeURI(maxNodeId + '::' + requesterDid + '::' + position)

        // The feed format contains an array of post: uri, so map it to just this field
        const feed = results.map((row) => ({
            post: row.uri,
        }))

        return {
            cursor,
            feed,
        }

    } catch (e) {
        console.error(e)
    }
    return { feed: []}
}
