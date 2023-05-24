
import { InvalidRequestError } from '@atproto/xrpc-server'
import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import neo4j from 'neo4j-driver'

let pageLimit = 100

export const uri = 'at://did:plc:ewgejell4547pukut5255ibm/app.bsky.feed.generator/friends-and-community'

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

    
async function parallelQeuries(did: string, limit: number) {
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
    //console.log(util.inspect(results.followResult, false, null, true))
    let followArray: Array<string> = []
    let fofArray: Array<string> = []
    let communityArray: Array<string> = []
    for (let i = 0; i < pageLimit; i++) {
        if (results.followResult.records[i] !== undefined) followArray.push(results.followResult.records[i]['_fields'][0].properties.uri)
        if (results.fofResult.records[i] !== undefined) fofArray.push(results.fofResult.records[i]['_fields'][1].properties.uri)
        if (results.communityResult.records[i] !== undefined) communityArray.push(results.communityResult.records[i]['_fields'][1].properties.uri)
    }

    let returnArray: Array<string> = []
    for (let i = 0; i < pageLimit; i++) {
        switch (Math.floor(Math.random() * 3)) {
            case 0:
                returnArray.push(<string> followArray.pop())
                break;
            case 1:
                returnArray.push(<string>fofArray.pop())
                break;
            case 2:
                returnArray.push(<string>communityArray.pop())
                break
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
    let limit = params.limit
    //let cursor = params.cursor ? params.cursor : undefined
    let results = await parallelQeuries(requesterDid, limit)
    const feed = results.map((row) => ({
        post: row,
    }))
    //cursor = `${new Date(last.indexedAt).getTime()}::${last.cid}`
    //cursor = `${new Date().getTime()}`
    let cursor = undefined
    //cursor ?: string
    return {
        cursor,
        feed,
    }
}