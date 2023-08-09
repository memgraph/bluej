import { BskyAgent, AtpSessionEvent, AtpSessionData } from '@atproto/api'
import * as dotenv from 'dotenv'
dotenv.config()
const util = require('util')

const neo4j = require('neo4j-driver')
const driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("", ""), { encrypted: 'ENCRYPTION_OFF' })

const agent = new BskyAgent({
    service: 'https://bsky.social/',
})

let errorList: any[] = [];

async function allRelationships(type: string){
    let relationshipList: any[] = [];
    let end = false;
    let firstPass = false;

    while(!end){
        let query = "";
        if(type == "F"){
            query = "MATCH (p1:Person)-[r:FOLLOW]->(p2:Person)";
        } else if(type == "L"){
            query = "MATCH (p1:Person)-[r:LIKE]->(p2:Post)";
        }
        try {
            const session = driver.session();
            let list = await session.run(query + "WHERE r.elementId IS NULL RETURN p1, r, p2 LIMIT 5000");
            Array.prototype.push.apply(relationshipList, list.records);
            session.close()
        } catch (err) {
            errorList.push(["gettingRelationship", err]);
            console.error('[gettingRelationship]:', err);
        }

        if(relationshipList === undefined || relationshipList === null || relationshipList.length === 0){
            if(!firstPass){
                console.log("Couldn't load relationship list. List might be empty or there was an error in communication. Please try again!")
            } else {
                console.log(`Finished updating ${type} relationship`)
            }
            end = true;
            return;
        }
        firstPass = true;

        while(relationshipList.length != 0){
            let updatingList: any[] = [];
            for(let i=0; i < 10; i++){
                if(relationshipList.length > 0){
                    updatingList.push(relationshipList.pop()["_fields"])
                }
            }
            await Promise.all(updatingList.map(async (item) => {
                let cypher = "";
                let did1 = "";
                let did2 = "";
                if (type == "F") {
                    did1 = item[0]?.properties.did || "";
                    did2 = item[2]?.properties.did || "";
                    cypher = `MATCH (p1:Person {did: $did1})-[r:FOLLOW]->(p2:Person {did: $did2}) SET `;
                
                } else if(type == "L"){
                    did1 = item[0]?.properties.did || "";
                    did2 = item[2]?.properties.uri || "";
                    cypher = `MATCH (p1:Person {did: $did1})-[r:LIKE]->(p2:Post {uri: $did2}) SET `;
                }

                try {
                    const session = driver.session();
                    const parameters = {
                        did1: did1,
                        did2: did2,
                        elementId: item[1]?.elementId || ""
                    };

                    const setClauses = Object.entries(parameters)
                        .filter(([key, value]) => value !== null && value !== "" && key !== "did1" && key !== "did2")
                        .map(([key, value]) => `r.${key} = $${key}`)
                        .join(', ');

                    cypher += setClauses;
            
                    const result = await session.run(cypher, parameters);
                    session.close();
                } catch (err) {
                    errorList.push(["saveToDb", err, item[1]]);
                    console.error('[saveToDb]:', err);
                }
            }));
        }
    }
}

async function run(){
    await agent.login({ identifier: <string>process.env.FEEDGEN_HANDLE, password: <string>process.env.FEEDGEN_PASSWORD });
    console.log("Started script for follow and like");
    console.log("Updating follow relationships...");
    await allRelationships("F");
    console.log("Updating like relationships...");
    await allRelationships("L");
    process.exit(1);
}

run();