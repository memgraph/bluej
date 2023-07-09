
import { InvalidRequestError } from '@atproto/xrpc-server'
import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { parallelQueries } from './parralel-queries'
import { deduplicateArray } from './weighted-round-robin'
import { ParallelQueriesOutput } from './parralel-queries'

export const shortname = 'authors'

const authorQuery =
    'MATCH (post:Post) ' +
    'WHERE post.text CONTAINS "#author"' +
    'RETURN ID(post), post.uri, 1 as hour_age, 2 as likes, 3 as score ' +
    'ORDER BY post.indexedAt DESC ' +
    'LIMIT 300'

let authorPosts: ParallelQueriesOutput[]

async function loadAuthorsPosts() {
    let queryResults = await parallelQueries('', 0, {
        authors: { query: authorQuery, limit: 400 },
    })
    authorPosts = queryResults.authors
}

loadAuthorsPosts()

// Then reload authors list every minute
setInterval(loadAuthorsPosts, 60 * 1000); 

// This is the main handler for the feed generator
export const handler = async (ctx: AppContext, params: QueryParams, requesterDid: string) => {
    try {
        let limit = params.limit ? params.limit : 50
        let cursor = params.cursor ? params.cursor : undefined
        let position: number = 0  // the return array will be sliced from this position to the limit, default is 0 if no cursor is provided

        if (cursor !== undefined) {
            const [cid, positionCur] = cursor.split('::')            
            position = parseInt(positionCur)
            if (!cid || !position || isNaN(position) || position < 0) {
                console.log('[ERROR] malformed cursor ', cursor)
                throw new InvalidRequestError('[ERROR] malformed cursor ', cursor)
            }
            if (cid !== requesterDid) {
                console.log('[ERROR] JWT and cursor DID do not match', cursor)
                throw new InvalidRequestError('[ERROR] JWT and cursor DID do not match', cursor)
            }
        }
        // define some sane limits to avoid abuse
        position = position < 600 ? position : 600
        limit = limit < 600 ? limit : 600

        console.log('[ authors ] [', requesterDid, '] l:', limit, 'p:', position, 'c:', cursor)

        // the number of results defined by limit determines how it will be distributed in the weightedRoundRobin call below
        let queryResults = authorPosts

        // distribute the posts returned using a weighted round robin algorithm, using the length of the array as the weight
        let results = deduplicateArray(queryResults)

        // Trim down the large result set to the requested start and length of the page
        let maxLength = results.length
        results = results.slice(position, position + limit)

        // Create a new cursor using the maxNodeId to start of at the same point, the requesterDid to checksum the origin, and the position to start where we left of in the previous page
        position += limit

        if (maxLength > position + limit + 1) {
            cursor = encodeURI(requesterDid + '::' + position)
        }
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
    return { feed: [] }
}
