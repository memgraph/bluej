import { BskyAgent, AtpSessionEvent, AtpSessionData, ComAtprotoRepoGetRecord, AtpAgent, GraphNS, RepoNS } from '@atproto/api'
import * as dotenv from 'dotenv'
dotenv.config()
const util = require('util')

const neo4j = require('neo4j-driver')
const driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("", ""), { encrypted: 'ENCRYPTION_OFF' })

const agent = new BskyAgent({
    service: 'https://bsky.social/',
})

const graphNS = new RepoNS(agent.api);

const verbose = true;

let errorList: any[] = [];
let iterationTimes: any[] = [];
let skipUser: any[] = [];
let numberOfSkipUser: number = 0;

async function updateRelationships(type: string){
    let firstCalled = Date.now();
    let running = true;
    let numberOfUpdated = 0;
    let numberOfCalls = 0;
    let numberOfErrors = 0;
    let waitingTime = 0;

    while(running){
        let startIteration = Date.now();
        let update = await updateRelationship(type, numberOfUpdated, numberOfCalls);
        let endIteration = Date.now();
        if(update.get("error") == 0){
            numberOfUpdated = update.get("numberOfUpdated");
            numberOfCalls = update.get("numberOfCalls");
            if(verbose){
                console.log("Number of updated users: " + numberOfUpdated);
                console.log("Number of calls: " + numberOfCalls);
                console.log("Waiting time: " + waitingTime);
                console.log("Skiped users: " + skipUser);
            }
            iterationTimes.push([(endIteration.valueOf() - startIteration.valueOf()), update.get("numberOfCalls")])
            waitingTime = calculateWaitingTime(numberOfCalls, (endIteration - firstCalled.valueOf()));
            numberOfErrors = 0;
            await delay(waitingTime)
        } else {
            if(numberOfErrors >= 5){
                if(verbose){
                    if(update.get("error") == 1){
                        console.log("Wrong relationship type. Please try again!");
                    } else if(update.get("error") == 2) {
                        console.log("Couldn't load relationship. Please try again!");
                    } else if(update.get("error") == 3){
                        console.log("Couldn't load users relationships.")
                    }
                }
                running = false;
                return (Date.now().valueOf() - firstCalled.valueOf());
            }
            numberOfErrors += 1;
        }

        if(running){
            if((Date.now().valueOf() - startIteration) > (5 * 60 * 1000)){
                console.log("Finished 5 min iteration");
                running = false;
                return 0;
            }
        }
    }
}

async function updateRelationship(type: string, numberOfUpdated: number, numberOfCalls: number){
    let relationshipList: any[] = [];
    let relationship: any[] = [];

    let query = "";
    if(type == "FOLLOW"){
        query = "MATCH (p1:Person)-[r:FOLLOW]->(p2:Person)";
    } else if(type == "LIKE") {
        query = "MATCH (p1:Person)-[r:LIKE]->(p2:Post)";
    } else {
        return new Map<string, number>([
            ["error", 1]
        ])
    }

    try {
        const session = driver.session();
        let callQuery = query;
        const parameters = {
            skip: numberOfSkipUser
        }
        if(numberOfSkipUser > 0) callQuery = callQuery + `WHERE r.uri IS NULL RETURN p1, r, p2 SKIP ${parameters.skip} LIMIT 1`
        else callQuery = callQuery + `WHERE r.uri IS NULL RETURN p1, r, p2 LIMIT 1`
        let list = await session.run(callQuery, parameters);
        Array.prototype.push.apply(relationship, list.records);
        session.close()
    } catch (err) {
        errorList.push(["gettingRelationshipUser", err]);
        console.error('[gettingRelationshipUser]:', err);
    }

    if(relationship === undefined || relationship === null || relationship.length !== 1){
        return new Map<string, number>([
            ["error", 2]
        ])
    }

    let actorDid = relationship[0]["_fields"][0]["properties"]["did"];
    let state = true;
    let numOfPass = 0;
    let limit = 3000;
    while (state){
        try {
            const session = driver.session();
            const parameters = {
                did: actorDid,
                skip: (numOfPass * limit)
            };
            let que = "";
            if(parameters.skip == 0){
                que = query + `WHERE p1.did = $did RETURN p2 LIMIT ${limit}`
            }
            else {
                que = query + `WHERE p1.did = $did RETURN p2 SKIP ${parameters.skip} LIMIT ${limit}`
            }
            let list = await session.run(que, parameters);
            list.records.forEach(async (record) => {
                if(type == "FOLLOW") relationshipList.push(record["_fields"][0]["properties"]["did"]);
                else if (type == "LIKE") relationshipList.push(record["_fields"][0]["properties"]["uri"])
            });
            numOfPass += 1;
            if(list.records.length < limit){
                state = false;
            }
            session.close()
        } catch (err) {
            errorList.push(["gettingRelationshipUser", err]);
            if(verbose) console.error('[gettingRelationshipUser]:', err);
            state = false;
        }
    }

    let updatedRelationshipValue = await updateOneUser(type, actorDid, relationshipList);

    return new Map<string, any>([
        ["error", 0],
        ["numberOfUpdated", (updatedRelationshipValue.numberOfUpdated + numberOfUpdated)],
        ["numberOfCalls", (updatedRelationshipValue.numberOfCalls + numberOfCalls)]
    ]);
}

async function saveOneToDb(type: string, record: any, actorDid: string){
    let cypher = "";
    let state = false;

    if(type == "FOLLOW"){
        cypher = `MATCH (p1:Person {did: $did1})-[r:FOLLOW]->(p2:Person {did: $did2}) SET `;
    }
    else if(type == "LIKE"){
        cypher = `MATCH (p1:Person {did: $did1})-[r:LIKE]->(p2:Post {uri: $did2}) SET `;
    }
    
    try {
        const session = driver.session();
        const parameters = {
            did1: actorDid,
            did2: record.subject,
            uri: record.relationshipUri || ""
        };

        const setClauses = Object.entries(parameters)
            .filter(([key, value]) => value !== null && value !== "" && key !== "did1" && key !== "did2")
            .map(([key, value]) => `r.${key} = $${key}`)
            .join(', ');

        cypher += setClauses;

        const result = await session.run(cypher, parameters);
        session.close();
        state = true;
    } catch (err) {
        errorList.push(["saveToDb", err, record]);
        console.error('[saveToDb]:', err);
    }
    return state;
}
async function deleteUnreachable(type: string, relationshipList: any[], actorDid: string){
    let cypher = "";
    let state = false;

    if(type == "FOLLOW"){
        cypher = `MATCH (p1:Person {did: $did1})-[r:FOLLOW]->(p2:Person {did: $did2}) DELETE r `;
    }
    else if(type == "LIKE"){
        cypher = `MATCH (p1:Person {did: $did1})-[r:LIKE]->(p2:Post {uri: $did2}) DELETE r `;
    }

    for(let subjectDid of relationshipList){
        if(verbose) console.log("Actor Did: " + actorDid);
        if(verbose) console.log("Deleting: " + subjectDid);
        try {
            const session = driver.session();
            const parameters = {
                did1: actorDid,
                did2: subjectDid,
            };
    
            const result = await session.run(cypher, parameters);
            session.close();
            state = true;
        } catch (err) {
            errorList.push(["saveToDb", err, subjectDid]);
            console.error('[saveToDb]:', err);
        }
    }

    return state;
}
async function skipUnexistingUser(type: string, actorDid: string){
    if(!skipUser.includes(actorDid)){
        skipUser.push(actorDid);
    }
    numberOfSkipUser += 1;
}

async function updateOneUser(type: string, actorDid: string, relationshipList: any[]){
    let startIteration = Date.now();
    let cursor: string | undefined = "";
    let numberOfCalls = 0;
    let state = true;
    let collection = (type == "FOLLOW") ? "app.bsky.graph.follow" : "app.bsky.feed.like";
    let numberOfUpdated = 0;

    let numberOfErrors = 0;

    while(state){
        let apiList: any[] = [];
        let saveList: any[] = [];
        try {
            //Follow collection: "app.bsky.graph.follow";
            //Like collection: "app.bsky.feed.like"
            let profile = await graphNS.listRecords({repo: actorDid, collection: collection, limit: 100, cursor: cursor});
            profile.data.records.forEach(async (record) => {
                if(type == "FOLLOW"){
                    apiList.push({relationshipUri: record.uri, subject: record.value["subject"]})
                } else if (type == "LIKE"){
                    apiList.push({relationshipUri: record.uri, subject: record.value["subject"]["uri"]})
                }
            });
            cursor = profile.data.cursor;
            numberOfCalls += 1;
            numberOfErrors = 0;
            apiList.forEach(async (item) => {
                if(relationshipList.includes(item.subject)){
                    let index = relationshipList.indexOf(item.subject);
                    relationshipList.splice(index, 1);
                    saveList.push(item);
                }
            });
            if(profile.data.records.length < 100){
                state = false;
            }
        } catch (err) {
            errorList.push(["fetchFollow", err]);
            console.error('[fetchFollow]:', err);
            numberOfErrors += 1;
        }

        if(relationshipList.length == 0){
            state = false;
        } else {
            if(!state){
                await deleteUnreachable(type, relationshipList, actorDid);
                return {error: 1, numberOfCalls: numberOfCalls, numberOfUpdated: numberOfUpdated};;
            }
        }
        if(numberOfErrors >= 5){
            state = false;
            await skipUnexistingUser(type, actorDid);
            return {error: 1, numberOfCalls: numberOfCalls, numberOfUpdated: numberOfUpdated};;
        }

        while(saveList.length > 0){
            let lookingList: any[] = [];
            for(let i=0; i < 10; i++){
                if(saveList.length > 0){
                    lookingList.push(saveList.pop());
                }
            }
            const session = driver.session();
            const promises = lookingList.map(async (record) => {
                let saveValues = await saveOneToDb(type, record, actorDid);
                if(saveValues) numberOfUpdated += 1;
            });
            await Promise.all(promises);
            session.close();
        }
    }
    
    return {error: 0, numberOfCalls: numberOfCalls, numberOfUpdated: numberOfUpdated};
}

function calculateWaitingTime(numberOfCalls: number, durationOfRun: number){
    let sum = 0;
    iterationTimes.forEach(async (time) => {
        sum += (time[0] / time[1]);
    });
    let average = sum / iterationTimes.length;
    let possibleRemainingCalls = (((5*60*1000)-durationOfRun) / average);

    let waitingTime = 0;

    if((possibleRemainingCalls + numberOfCalls) > 2950){
        waitingTime = ((5*60*1000) / 2950) - average
    }
    
    return waitingTime;
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run(){
    await agent.login({ identifier: <string>process.env.FEEDGEN_HANDLE, password: <string>process.env.FEEDGEN_PASSWORD });
    console.log("Started script for follow and like");
    console.log("Updating follow relationships...");

    let remaining = 0;
    skipUser = [];
    numberOfSkipUser = 0;
    while(remaining == 0){
        let ret = await updateRelationships("FOLLOW");
        if(ret != undefined && ret != null){
            remaining = ret;
            if(remaining != 0){
                if(verbose) console.log("Cooling off for: " + remaining);
                await delay(remaining);
            }
        }
        await delay(5000);
    }
    remaining = 0;
    skipUser = [];
    numberOfSkipUser = 0;
    console.log("Updating like relationships...");
    while(remaining == 0){
        let ret = await updateRelationships("LIKE");
        if(ret != undefined && ret != null){
            remaining = ret;
            if(remaining != 0){
                console.log("Cooling off for: " + remaining);
                await delay(remaining);
            }
        }
        await delay(5000);
    }
    process.exit(1);
}

run();