
import { InvalidRequestError } from '@atproto/xrpc-server'
import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import neo4j from 'neo4j-driver'
import fs from 'fs'
import md5 from 'md5'

let pageLimit = 250

export const uri = 'at://did:plc:ewgejell4547pukut5255ibm/app.bsky.feed.generator/friendcomm'

const followQuery =
    'MATCH (my_person:Person {did: $did})-[:FOLLOW]->(follow_person:Person) ' +
    'MATCH(follow_person) - [: AUTHOR_OF] -> (post:Post) ' +
    'WHERE post.indexedAt IS NOT NULL ' +
    'RETURN post ' +
    'ORDER BY post.indexedAt DESC ' +
    'LIMIT ' + pageLimit + ';';

const fofQuery =
    'MATCH (my_person:Person {did: $did})-[:FOLLOW]->(follow_person:Person) ' +
    'MATCH(follow_person) - [: AUTHOR_OF] -> (post: Post) ' +
    'WHERE post.indexedAt IS NOT NULL  AND NOT exists((post) - [: ROOT] -> (: Post)) ' +
    'WITH localDateTime() - post.indexedAt AS duration, post ' +
    'WITH duration.hour + duration.day * 24 AS item_hour_age, post ' +
    'WHERE item_hour_age <= 24 ' +
    'WITH cos(item_hour_age / 15.28) AS most_recent_score, post ' +
    'MATCH(: Person) - [l: LIKE] -> (post) ' +
    'WITH count(l) AS num_of_likes, post, most_recent_score ' +
    'RETURN round(num_of_likes + most_recent_score) AS popularity, post ' +
    'ORDER BY popularity DESC ' +
    'LIMIT ' + pageLimit + ';';

const communityQuery =
    'MATCH(my_person: Person { did: $did }), (other_person: Person) ' +
    'WHERE other_person.did != my_person.did AND other_person.community_id = my_person.community_id ' +
    'MATCH(other_person) - [: AUTHOR_OF] -> (post:Post) ' +
    'WHERE post.indexedAt IS NOT NULL AND NOT exists((post) - [: ROOT] -> (: Post)) ' +
    'WITH localDateTime() - post.indexedAt AS duration, post ' +
    'WITH duration.hour + duration.day * 24 AS item_hour_age, post ' +
    'WHERE item_hour_age <= 24 ' +
    'WITH cos(item_hour_age / 15.28) AS most_recent_score, post ' +
    'MATCH(: Person) - [l: LIKE] -> (post) ' +
    'WITH count(l) AS votes, post, most_recent_score AS result ' +
    'RETURN(votes - 1) / result AS popularity, post ' +
    'ORDER BY popularity DESC ' +
    'LIMIT ' + pageLimit + ';';


async function parallelQeuries(did: string) {
    const driver = neo4j.driver(
        'bolt://localhost',
        neo4j.auth.basic('', '')
    );

    const sessionFollow = driver.session()
    const sessionFoF = driver.session()
    const sessionCommunity = driver.session()

    let follow = sessionFollow.run(followQuery, { did: did })
    let followOfFollow = sessionFoF.run(fofQuery, { did: did })
    let community = sessionCommunity.run(communityQuery, { did: did })

    let results = {
        followResult: await follow,
        fofResult: await followOfFollow,
        communityResult: await community
    }

    let followArray: Array<string> = []
    let fofArray: Array<string> = []
    let communityArray: Array<string> = []
    for (let i = 0; i < pageLimit; i++) {
        try {
            if (results.followResult.records[i] !== undefined) followArray.push(results.followResult.records[i]['_fields'][0].properties.uri)
        } catch (e) {
            console.log('follow results error')
        }
        try {
            if (results.fofResult.records[i] !== undefined) fofArray.push(results.fofResult.records[i]['_fields'][1].properties.uri)
        } catch (e) {
            console.log('follow results error')
        }
        try {
            if (results.communityResult.records[i] !== undefined) communityArray.push(results.communityResult.records[i]['_fields'][1].properties.uri)
        } catch (e) {
            console.log('follow results error')
        }
    }

    let returnArray: Array<string> = []
    let randomPost = 0
    for (let i = 0; i < pageLimit; i++) {
        randomPost = Math.floor(Math.random() * 3)
        if (randomPost == 0 && followArray.length > 0) {
            returnArray.push(<string>followArray.pop())
        } else if (randomPost == 1 || followArray.length == 0) {
            returnArray.push(<string>fofArray.pop())
        } else if (randomPost == 2 || fofArray.length == 0) {
            returnArray.push(<string>communityArray.pop())
        }
    }

    returnArray.forEach((uri) => {
        post: uri
    })

    await sessionFollow.close();
    await sessionFoF.close();
    await sessionCommunity.close();
    await driver.close();

    return returnArray
}


export const handler = async (ctx: AppContext, params: QueryParams, requesterDid: string) => {

    let limit = params.limit ? params.limit : 50
    let cursor = params.cursor ? params.cursor : undefined

    console.log('did: ', requesterDid, 'cursor: ', cursor, 'limit:', limit)

    let results: Array<string> = []

    try {
        if (cursor !== undefined) {
            const [cid, position] = cursor.split('::')
            if (!cid || !position) {
                console.log('malformed cursor')
                throw new InvalidRequestError('malformed cursor')
            }
            if (cid !== requesterDid) {
                console.log('incorrect cursor for DID')
                throw new InvalidRequestError('incorrect cursor for DID')
            }
            if (fs.existsSync('./cache/' + md5(requesterDid))) {

                console.log('Cache: ' + './cache/' + md5(cid))
                let buffer = JSON.parse(fs.readFileSync('./cache/' + md5(requesterDid), { encoding: 'utf8', flag: 'r' }))
                console.log('buffer has', buffer.length, 'items, slicing ', position, 'to', position + limit)
                results = buffer.slice(position, position + limit)
                // increase cursort to next chunk
                if (results.length < parseInt(position) + (limit * 2) + 1) {
                    cursor = requesterDid + '::' + (position + limit)
                } else {
                    cursor = undefined
                }
            }
        }

        if (!results.length || cursor === undefined) {
            // no valid cache, query and store results to use in paging
            results = await parallelQeuries(requesterDid)
            console.log('[no cache] ', requesterDid + 'results: ', results.length)
            cursor = encodeURI(requesterDid + '::0')
            // save results to cache
            fs.writeFileSync('./cache/' + md5(requesterDid), JSON.stringify(results))
            results = results.slice(0, limit)
        }

    } catch (e) {
        console.error(e)
    }
    const feed = results.map((row) => ({
        post: row,
    }))


    return {
        cursor,
        feed,
    }
}
