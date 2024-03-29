import { BskyAgent, AtpSessionEvent, AtpSessionData } from '@atproto/api'
import * as dotenv from 'dotenv'
dotenv.config()
const util = require('util')

const neo4j = require('neo4j-driver')
const driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("", ""), { encrypted: 'ENCRYPTION_OFF' })

const agent = new BskyAgent({
    service: 'https://bsky.social/',
})

let iterationTimes: number[] = [];
let updatedUserDidList: string[] = [];
let errorList: any[] = [];

//Parent function of updating users
async function users(){
    let firstCalled = Date.now(); //start of running code (expected duraton 5 minutes)
    let userList: any[] = []; //Contains list of users necessary for update
    
    try {
        const session = driver.session()
        let list = await session.run(" MATCH (n:Person) WHERE n.handle IS NULL RETURN n LIMIT 3000; "); //Fetching all users that don't have handle (not updated ones)
        Array.prototype.push.apply(userList, list.records);
        session.close()
    } catch (err) {
        errorList.push(["saveUsers", err]);
        console.error('[saveUsers]:', err);
    }

    //Recursive function of updating all fetched users
    iterationTimes = [];
    if(userList === undefined || userList === null || userList.length === 0){
        console.log("Couldn't load user list. Please try again!")
        return new Map<string, number>([
            ["error", 1]
        ])
    }
    else{
        console.log("Running update user script...");
        let updatedUserList = await updateUsers(userList, firstCalled, 0, 0, 0);
        if(updatedUserList != undefined && updatedUserList != null){
            userList = updatedUserList;
        }
    }

    return new Map<string, any>([
        ["duration", Date.now().valueOf() - firstCalled],
        ["unresolvedUsers", userList.length]
    ])
}

async function updateUsers(userList: any[], firstCalled: number,
        numberOfUpdatedUsers: number, iterationNumber: number, waitingTime: number){
    if(userList.length === 0){
        return [];;
    }

    let startIteration = Date.now(); //Time of updating 5 users
    let numOfRepeat = (userList.length > 5) ? 5 : userList.length; //Finding remaining number of users in the list
    let lookingList : any[] = []; //List containing only dids for easier use

    for(let i=0; i < numOfRepeat; i++){
        const node : Map<string, any> | undefined = userList.pop();
        if(node){
            lookingList.push(node["_fields"][0]["properties"]["did"]);
        }
    }
    let saveValues: any[] = []; //List containing all necessary info for updating users

    let numberOfSuccess = 0;
    const session = driver.session();
    const promises = lookingList.map(async (did) => {
        let newItem = await getInfo(did);
        if(newItem != undefined && newItem != null){
            let saveValues = await saveOneToDb(newItem, session);
            if(saveValues){
                numberOfUpdatedUsers += 1;
                numberOfSuccess += 1;
                updatedUserDidList.push(did);
            }
        }
    });

    await Promise.all(promises);
    session.close();

    let endIteration = Date.now(); //Time of end for updating 5 users
    let durationOfIteration = endIteration.valueOf() - startIteration.valueOf() //How long did update of 5 users take
    let durationOfRun = endIteration.valueOf() - firstCalled.valueOf(); //How long is updating whole list taking

    iterationTimes.push(durationOfIteration);

    //Return the rest if 5min had passed
    if((Date.now().valueOf() - firstCalled) > (5 * 60 * 1000)){
        let sum = 0;
        iterationTimes.forEach(async (time) => {
            sum += time;
        })
        let average = Math.round(sum/iterationTimes.length)
        console.log("Updated users: ");
        console.log(updatedUserDidList)
        console.log(`Number of updated users: ${numberOfUpdatedUsers}; Average iteration time: ${average}`)
        return userList;
    }

    //Calculating waiting time before next iteration so it evenly spreads over 5 minutes
    if(iterationNumber % 10 === 0){;
        waitingTime = calculateWaitingTime(numberOfUpdatedUsers, durationOfRun)
    }

    await delay(waitingTime);
    return await updateUsers(userList, firstCalled, numberOfUpdatedUsers, iterationNumber += 1, waitingTime)
}

//Calling api for getting info about users and returning its value
async function getInfo(did: string){
    let user = await fetchProfile(did);
    if(user != undefined && user != null){
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
    return undefined;
}

//Saving one value to db
async function saveOneToDb(item: any, session: any){
    let state = false;
    try {
        const session = driver.session();
        let cypher = `MATCH (n:Person) WHERE n.did = $did SET `;
        const parameters = {
            did: item.get("did") || "",
            handle: item.get("handle") || "",
            displayName: item.get("displayName") || "",
            avatar: item.get("avatar") || "",
            followsCount: item.get("followsCount") || "",
            followersCount: item.get("followersCount") || ""
        };
        
        //Using to check if some variables are empty so it doesn't try to save and throw error
        const setClauses = Object.entries(parameters)
            .filter(([key, value]) => value !== null && value !== "" && key !== "did")
            .map(([key, value]) => `n.${key} = $${key}`)
            .join(', ');

        cypher += setClauses

        const result = await session.run(cypher, parameters);

        session.close();
        state = true;
    } catch (err) {
        errorList.push(["saveToDb", err, item])
        console.error('[saveToDb]:', err);
    }
    return state;
}

//Calculates new waiting time every 10 iterations based on average iteration time
function calculateWaitingTime(numberOfUpdatedUsers: number, durationOfRun: number){
    let sum = 0;
    iterationTimes.forEach(async (time) => {
        sum += time;
    })
    let average = Math.round(sum/iterationTimes.length)
    let possibleRemainingUsers = (((5*60*1000)-durationOfRun) / average) * 5

    let waitingTime = 0;

    if((possibleRemainingUsers + numberOfUpdatedUsers) > 2950){
        waitingTime = (5*60*1000)/(2950 / 5) - average
    }

    return waitingTime;
}

async function fetchProfile(handle: string) {
    try {
        let profile = await agent.getProfile({actor: handle})
        return profile;
    } catch (err) {
        errorList.push(["fetchProfile", err]);
        console.error('[fetchProfile]:', err);
    }
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//Running login and startting parent function of updating users
async function run(){
    await agent.login({ identifier: <string>process.env.FEEDGEN_HANDLE, password: <string>process.env.FEEDGEN_PASSWORD })
    let gettingUserErrorCount = 0;
    while(true){
        let returnValue = await users();
        if(returnValue != undefined){
            if(returnValue.get("error") === 1){
                gettingUserErrorCount += 1;
            }
            else if(returnValue.get("duration") < (5*60*1000)){
                gettingUserErrorCount = 0;
                console.log("Finished current list of users for update")
                console.log("Resting for " + (((5*60*1000) - returnValue.get("duration"))/1000) + " seconds...")
                await delay((5*60*1000) - returnValue.get("duration"))
            }
            if(gettingUserErrorCount >= 5){
                console.log("Remaining user list is empty or users can not be fetched.");
                break;
            }
            await delay(5000);
        }
        else{
            console.log("Something went wrong!");
            break;
        }
    }
    console.log("Found errors: ");
    console.log(errorList);
    process.exit(1)
}

run()