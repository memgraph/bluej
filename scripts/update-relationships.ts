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

let errorList: any[] = [];
let iterationTimes: any[] = [];
let doneUserFollows: string[] = [];
let doneUserLikes: string[] = [];

async function updateRelationships(type: string){
    let relationshipList: any[] = [];
    let firstCalled = Date.now();

    let query = "";
    if(type == "FOLLOW"){
        query = "MATCH (p1:Person)-[r:FOLLOW]->(p2:Person)";
    } else if(type == "LIKE") {
        query = "MATCH (p1:Person)-[r:LIKE]->(p2:Post)";
    } else {
        console.log("Wrong relationship type. Please try again!")
        return new Map<string, number>([
            ["error", 2]
        ])
    }

    try {
        const session = driver.session();
        let list = await session.run(query + "WHERE r.uri IS NULL RETURN p1, r, p2 LIMIT 5000");
        Array.prototype.push.apply(relationshipList, list.records);
        session.close()
    } catch (err) {
        errorList.push(["gettingRelationship", err]);
        console.error('[gettingRelationship]:', err);
    }

    iterationTimes = [];
    if(relationshipList === undefined || relationshipList === null || relationshipList.length === 0){
        console.log("Couldn't load relationship list. Please try again!")
        return new Map<string, number>([
            ["error", 1]
        ])
    } else {
        let updatedRelationshipList = await updateRelationship(type, relationshipList, firstCalled, 0, 0, 0);
    }
}

async function updateRelationship(type: string, relationshipList: any[], firstCalled: number, numberOfCalls: number, waitingTime: number, numberOfUpdated: number){
    if(relationshipList.length === 0){
        return [];
    }

    let startIteration = Date.now(); //Time of updating 5 users
    let lookingRel = relationshipList.pop(); //List containing only dids for easier use

    let rel = new Map<string, any>([
        ["node1", lookingRel["_fields"][0]],
        ["relationship", lookingRel["_fields"][1]],
        ["node2", lookingRel["_fields"][2]]
    ]);

    let actorDid = rel.get("node1")["properties"]["did"].toString()
    if(type == "FOLLOW"){
        if(!doneUserFollows.includes(actorDid)){
            doneUserFollows.push(actorDid);         
        }
    } else if (type == "LIKE"){
        if(!doneUserLikes.includes(actorDid)){
            doneUserLikes.push(actorDid);
        }
    }
    let oneUserInfo = await fetchRecords(type, actorDid);
    numberOfCalls += oneUserInfo.numberOfCalls
    if(oneUserInfo != undefined && oneUserInfo != null){
        while(oneUserInfo?.returnList.length > 0){
            let lookingList: any[] = [];
            for(let i=0; i < 10; i++){
                if(oneUserInfo.returnList.length > 0){
                    lookingList.push(oneUserInfo.returnList.pop());
                }
            }
            const session = driver.session();
            const promises = lookingList.map(async (record) => {
                let saveValues = await saveOneToDb(type, record, actorDid, session);
                if(saveValues) numberOfUpdated += 1;
            });
            await Promise.all(promises);
            session.close();
        }
    }

    let endIteration = Date.now(); //Time of end for updating 5 users
    let durationOfIteration = endIteration.valueOf() - startIteration.valueOf() //How long did update of 5 users take
    let durationOfRun = endIteration.valueOf() - firstCalled.valueOf(); //How long is updating whole list taking

    iterationTimes.push([durationOfIteration, numberOfCalls]);

    console.log("Updated: " + numberOfUpdated)

    if((endIteration.valueOf() - firstCalled) > (5 * 60 * 1000)){
        console.log("Finished 5 min iteration");
        return relationshipList;
    }

    waitingTime = calculateWaitingTime(numberOfCalls, durationOfRun);

    console.log("Waiting time: " + waitingTime)

    await delay(waitingTime);
    return await updateRelationship(type, relationshipList, firstCalled, numberOfCalls, waitingTime, numberOfUpdated);
}

async function saveOneToDb(type: string, record: any, actorDid: string, session: any){
    let node2 = "";
    let cypher = "";
    let state = false;

    if(type == "FOLLOW"){
        node2 = record["value"]["subject"];
        cypher = `MATCH (p1:Person {did: $did1})-[r:FOLLOW]->(p2:Person {did: $did2}) SET `;
    }
    else if(type == "LIKE"){
        node2 = record["value"]["subject"]["uri"];
        cypher = `MATCH (p1:Person {did: $did1})-[r:LIKE]->(p2:Post {uri: $did2}) SET `;
    }

    try {
        const session = driver.session();
        const parameters = {
            did1: actorDid,
            did2: node2,
            uri: record["uri"] || ""
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

async function fetchRecords(type: string, actorDid: string){
    let cursor: string | undefined = "";
    let numberOfCalls = 0;
    let state = true;
    let returnList: any[] = [];
    let collection = (type == "FOLLOW") ? "app.bsky.graph.follow" : "app.bsky.feed.like";

    let numberOfErrors = 0;

    while(state){
        try {
            //Follow collection: "app.bsky.graph.follow";
            //Like collection: "app.bsky.feed.like"
            let profile = await graphNS.listRecords({repo: actorDid, collection: collection, limit: 100, cursor: cursor});
            profile.data.records.forEach(async (record) => {
                returnList.push(record);
            });
            cursor = profile.data.cursor;
            numberOfCalls += 1;
            numberOfErrors = 0;
            if(profile.data.records.length < 100){
                state = false;
            }
            //state = false;
        } catch (err) {
            errorList.push(["fetchFollow", err]);
            console.error('[fetchFollow]:', err);
            numberOfErrors += 1;
        }
        if(numberOfErrors >= 5){
            state = false;
        }
    }
    return {numberOfCalls: numberOfCalls, returnList: returnList}
}

function calculateWaitingTime(numberOfCalls: number, durationOfRun: number){
    let sum = 0;
    iterationTimes.forEach(async (time) => {
        sum += (time[0] / time[1]);
    });
    let average = sum / iterationTimes.length;
    let possibleRemainingCalls = (((5*60*1000)-durationOfRun) / average);

    let waitingTime = 0;

    console.log(iterationTimes)
    console.log("Average: " + average);
    console.log(possibleRemainingCalls);


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
    await updateRelationships("FOLLOW");
    //console.log("Updating like relationships...");
    //await allRelationships("L");
    process.exit(1);
}

run();