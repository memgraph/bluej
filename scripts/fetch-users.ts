import { BskyAgent, AtpSessionEvent, AtpSessionData } from '@atproto/api'
import * as fs from 'fs';
import * as rd from 'readline'
import * as dotenv from 'dotenv'

const neo4j = require('neo4j-driver')
const driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("", ""), { encrypted: 'ENCRYPTION_OFF' })
const session = driver.session()

const agent = new BskyAgent({
    service: 'https://bsky.social/',
})

let followCount = 0

async function saveFollow(did: string, follow: string) {
    try {
        await session.run(" MERGE (p1:Person {did: $authorDid}) MERGE (p2:Person {did: $subjectDid}) MERGE (p1)-[:FOLLOW]->(p2)", { authorDid: did, subjectDid: follow })
    } catch (err) {
        console.error('[saveFollow]:', err)
    }
}

async function saveFollows(did, follows) {
    for (const follow of follows.data.follows) {
        console.log(did, " follows: ", follow.handle)
        await saveFollow(did, follow.did)
    }
}

async function fetchFollows(did: string) {
    try {
        let follows = await agent.getFollows({ actor: did, limit: 100 })
        //let did = follows.data.subject.did
        followCount = 100
        await saveFollows(did, follows)
        let cursor = follows.data.cursor
        while (cursor !== undefined) {
            try {
                followCount += 100
                let follows = await agent.getFollows({ actor: did, limit: 100, cursor: cursor })
                await saveFollows(did, follows)
                cursor = follows.data.cursor
            } catch (err) {
                console.error('[ERROR]:', err)
            }
            // Some people follow 70k+ people, so we need to stop somewhere to avoid turning friend-of-friend queries into meaningless noise
            if (followCount > 499) {
                break
            }
        }
    } catch (err) {
        console.error('[fetchFollows]: ', err)
    }
}

async function run(fileName: string) {
    console.log(fileName, " Running...")
    await agent.login({ identifier: <string>process.env.BSKY_EMAIL, password: <string>process.env.BSKY_PASSWORD })
    let reader = rd.createInterface(fs.createReadStream(fileName))
    for await (const handle of reader) {
        if (handle === undefined || handle === '') {
            return
        }
        await fetchFollows(handle)
    }
}

let fileName = process.argv[2]?.trim()
if (fileName === undefined) {
    console.log("Usage: ts-node fetch-users.js <file>")
    process.exit(1)
}

if (!fs.existsSync(fileName)) {
    console.log("File not found: ", fileName)
    process.exit(1)
}

run(fileName)
