
import { InvalidRequestError } from '@atproto/xrpc-server'
import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { parallelQueries } from './parralel-queries'
import { weightedRoundRobin, deduplicateArray } from './weighted-round-robin'
import { followQuery, likedByFollowQuery, communityQuery } from './queries'

export const shortname = 'home-plus'

interface LastSeen {
    maxNodeId: number;
    timestamp: number;
}
let didLastSeen: Array<LastSeen> = []

// Check up the didLastSeen array every 60 minutes and remove any entry that is older then 12 hours
// This is a relatively long time to live, but for the time being the number of users is still relatively low so the memory footprint is not a problem
setInterval(() => {
    const currentTime = Date.now()
    const twelveHoursAgo = currentTime - (12 * 60 * 60 * 1000)
    didLastSeen = didLastSeen.filter(lastSeen => lastSeen.timestamp > twelveHoursAgo);
}, 60 * 60 * 1000)


// This is the main handler for the feed generator
export const handler = async (ctx: AppContext, params: QueryParams, requesterDid: string) => {
    try {

        if (requesterDid.length === 0) {
            console.log('[ERROR] requesterDid is empty, using default')
            requesterDid = 'did:plc:ewgejell4547pukut5255ibm5'
        }

        let limit = params.limit ? params.limit : 50
        let cursor = params.cursor ? params.cursor : undefined

        let maxNodeId: number = 0 // if there is a cursor this will be the max node.id that will be used in the query so the result will be the same as in the previous page. 0 means the first page as it'll be ignored in the query execution
        let position: number = 0  // the return array will be sliced from this position to the limit, default is 0 if no cursor is provided

        if (cursor !== undefined) {
            const [maxNodeIdCur, cid, positionCur] = cursor.split('::')
            maxNodeId = parseInt(maxNodeIdCur)
            position = parseInt(positionCur)
            if (!maxNodeId || !cid || !position || isNaN(maxNodeId) || isNaN(position) || position < 0 || maxNodeId < 0) {
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

        console.log('[home-plus] [', requesterDid, '] l:', limit, 'p:', position, 'c:', cursor)

        // the number of results defined by limit determines how it will be distributed in the weightedRoundRobin call below
        let queryResults = await parallelQueries(requesterDid, maxNodeId, {
            follow: { query: followQuery, limit: 300 },
            likedByFollow: { query: likedByFollowQuery, limit: 100 },
            community: { query: communityQuery, limit: 100 }
        })

        // distribute the posts returned using a weighted round robin algorithm, using the length of the array as the weight
        let results = deduplicateArray(
            weightedRoundRobin(
                queryResults.follow,
                queryResults.likedByFollow,
                queryResults.community
            )
        )

        // If this is a new refresh, which we intuit by the absence of a cursor and the limit param having a low value (which indicates a probe not a refresh), we want to show the user the latest posts on top of the feed
        if (didLastSeen[requesterDid] !== undefined && didLastSeen[requesterDid].maxNodeId !== undefined) {
            const newResults = results.filter((result) => result.id > didLastSeen[requesterDid].maxNodeId);
            const seenResults = results.filter((result) => result.id <= didLastSeen[requesterDid].maxNodeId);
            results = [...newResults, ...seenResults]
        }

        // the maxNodeId is used to ensure the request for the next page will have be based on same results as the previous page, this value is stored in the curosr used to paginate
        if (maxNodeId === 0) {
            maxNodeId = Math.max(
                Math.max(...queryResults.follow.map(i => i.id)),
                Math.max(...queryResults.likedByFollow.map(i => i.id)),
                Math.max(...queryResults.community.map(i => i.id))
            )
        }
        // Trim down the large result set to the requested start and length of the page
        let maxLength = results.length
        results = results.slice(position, position + limit)

        // A larger limit and no cursor indicates that this was not a new-post probe, but a full feed refresh, so we mark the higherst Node.ID as the last seen post for this user, which is used above to put the newest posts on top of the feed
        if (limit >= 10 && cursor === undefined) {
            // using the requesterDid to make sure we only have one marker per user for space efficiency
            didLastSeen[requesterDid] = {
                maxNodeId: maxNodeId,
                timestamp: Date.now()
            }
        }

        // Create a new cursor using the maxNodeId to start of at the same point, the requesterDid to checksum the origin, and the position to start where we left of in the previous page
        position += limit

        if (maxLength > position + limit + 1) {
            cursor = encodeURI(maxNodeId + '::' + requesterDid + '::' + position)
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
