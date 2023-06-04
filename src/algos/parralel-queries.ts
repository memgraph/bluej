import neo4j from 'neo4j-driver'
import { QueryResult, Record } from 'neo4j-driver';


export interface ParallelQueriesInput {
    query: string;
    limit: number;
}

export interface ParallelQueriesOutput {
    id: number;
    uri: string;
    hour_age: number;
    likes: number;
    score: number
}

export async function parallelQueries(did: string, max_node_id: number, queryMap: { [key: string]: ParallelQueriesInput }) {
    const driver = neo4j.driver(
        'bolt://localhost',
        neo4j.auth.basic('', '')
    );

    const sessions: { [key: string]: any } = {};
    const promises: Promise<QueryResult>[] = [];
    const returnObj: { [key: string]: ParallelQueriesOutput[] } = {};
    
    for (const key in queryMap) {
        sessions[key] = driver.session();
        // fetch query for $key
        let query = queryMap[key].query
        // if there is a cursor it uses the Node.ID property limit results to nodes older then the time the cursor was created so it returns the same result to page on
        let where_post_node_id = max_node_id > 0 ? query.replace('WHERE_POST_NODE_ID', 'AND ID(post) <= ' + max_node_id.toString()) : query.replace('WHERE_POST_NODE_ID', '')
        // replace the WHERE_POST_NODE_ID and add the $limit for this query to the end of the string
        query = query.replace('WHERE_POST_NODE_ID', where_post_node_id) + queryMap[key].limit.toString() + ';'
        // And finally create a session for it parsing in the $did for who to run the query for
        promises.push(sessions[key].run(query, { did: did }));
        returnObj[key] = [];
    }

    const results: QueryResult[] = await Promise.all(promises);

    let i = 0;
    for (const key in sessions) {
        const records: Record[] = results[i].records;
        for (let j = 0; j < records.length; j++) {
            try {
                if (records[j] !== undefined) {
                    returnObj[key].push({
                        id: records[j]['_fields'][0].properties.id,
                        uri: records[j]['_fields'][0].properties.uri,
                        hour_age: records[j]['_fields'][0].properties.hour_age,
                        likes: records[j]['_fields'][0].properties.likes,
                        score: records[j]['_fields'][0].properties.score
                    })
                }
            } catch (e) {
                console.log(key + ' results error')
            }
        }
        i++;
    }

    for (const key in sessions) {
        await sessions[key].close();
    }
    await driver.close();

    return returnObj
}