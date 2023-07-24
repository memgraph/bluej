import { BskyAgent, AtpSessionEvent, AtpSessionData } from '@atproto/api'
import * as dotenv from 'dotenv'
dotenv.config()
const util = require('util')

const neo4j = require('neo4j-driver')
const driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("", ""), { encrypted: 'ENCRYPTION_OFF' })

const agent = new BskyAgent({
    service: 'https://bsky.social/',
})

async function updateUsers(){
    let firstCalled = Date.now();
    let userList = [];
    let returnValue : any[] = [];
    
    try {
        const session = driver.session()
        let list = await session.run(" MATCH (n:Person) WHERE n.handle IS NULL RETURN n; ")
        Array.prototype.push.apply(userList, list.records);
        session.close()
    } catch (err) {
        console.error('[saveFollow]:', err)
    }

    while(userList.length > 0){
        let numOfRepeat = (userList.length > 5) ? 5 : userList.length;
        let lookingList : any[] = [];
        for(let i=0; i < numOfRepeat; i++){
            const node : Map<string, any> | undefined = userList.pop();
            if(node){
                lookingList.push(node["_fields"][0]["properties"]["did"]);
            }
        }
        let time = 20;
        let saveValues: any[] = [];
        console.log(lookingList)
        let intervalId = setInterval(async () => {
            if(lookingList.length > 0){
                let newItem = await calculateNew(lookingList.pop());
                saveValues.push(newItem);
            }
        }, time);
        let startWaiting = Date.now();
        while(saveValues.length < numOfRepeat){
            //empty while for waiting
            if((Date.now().valueOf() - startWaiting.valueOf()) > 10000){
                console.log("Waiting time to long");
                break;
            }
        }
        clearInterval(intervalId);
        saveToDb(saveValues, time);

        break;
    }
}

async function calculateNew(did: string){
    console.log("Usao")
    let user = await fetchProfile(did)
    if(user != undefined){
        let wantedValues = new Map<string, any>([
            ["did", user?.data.did],
            ["avatar", user?.data.avatar],
            ["handle", user?.data.handle],
            ["description", user?.data.description],
            ["followsCount", user?.data.followsCount],
            ["followersCount", user?.data.followersCount],
            ["displayName", user?.data.displayName]]);
        return wantedValues;
    }
    return {};
}

async function saveToDb(save: any[], time: number){
    for(let i=0; i < save.length; i++){
        let item = save[i];
        try {
            const session = driver.session()
            await session.run(`
                MATCH (n:Person)
                WHERE n.did = "${item.get("did")}"
                SET n.handle = "${item.get("handle")}",
                n.description = "${item.get("description")}",
                n.displayName = "${item.get("displayName")}",
                n.avatar = "${item.get("avatar")}",
                n.followsCount = "${item.get("followsCount")}",
                n.followersCount = "${item.get("followersCount")}"
                RETURN n;
            `)
            session.close()
        } catch (err) {
            console.error('[saveFollow]:', err)
        }
    }
    console.log(`Saved ${save.length} values`);
    console.log(save)
}

async function fetchProfile(handle: string) {
    console.log(handle)
    try {
        let profile = await agent.getProfile({actor: handle})
        return profile;
    } catch (err) {
        console.error('[fetchProfile]:', err);
    }
}

async function run(){
    await agent.login({ identifier: <string>process.env.FEEDGEN_HANDLE, password: <string>process.env.FEEDGEN_PASSWORD })
    updateUsers()
}

run()