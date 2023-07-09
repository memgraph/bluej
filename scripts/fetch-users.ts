import { BskyAgent, AtpSessionEvent, AtpSessionData } from '@atproto/api'
import * as fs from 'fs';
import * as rd from 'readline'
import * as dotenv from 'dotenv'
import PromisePool from 'es6-promise-pool'

dotenv.config()

const neo4j = require('neo4j-driver')
const driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("", ""), { encrypted: 'ENCRYPTION_OFF' })

const agent = new BskyAgent({
    service: 'https://bsky.social/',
})

let followCount = 0

const rateLimit = 2000
const per = 5 * 60 * 1000

let lastCalled = Date.now()
let tokens = rateLimit


async function rateLimiter() {
    const now = Date.now()
    const elapsed = now - lastCalled
    lastCalled = now
    tokens += elapsed * (rateLimit / per)
    tokens = Math.min(tokens, rateLimit)
    if (tokens < 1) {
        const delay = (1 - tokens) * (per / rateLimit)
        tokens = 0
        return new Promise(resolve => setTimeout(resolve, delay))
    }
    tokens -= 1
}

async function saveFollow(did: string, follow: string) {
    try {
        const session = driver.session()
        await session.run(" MERGE (p1:Person {did: $authorDid}) MERGE (p2:Person {did: $subjectDid}) MERGE (p1)-[:FOLLOW]->(p2)", { authorDid: did, subjectDid: follow })
        session.close()
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
        await rateLimiter()
        let follows = await agent.getFollows({ actor: did, limit: 100 })
        followCount = 100
        await saveFollows(did, follows)
        let cursor = follows.data.cursor
        while (cursor !== undefined) {
            try {
                await rateLimiter()
                followCount += 100
                let follows = await agent.getFollows({ actor: did, limit: 100, cursor: cursor })
                await saveFollows(did, follows)
                cursor = follows.data.cursor
            } catch (err) {
                console.error('[ERROR]:', err)
            }
            if (followCount > 1000) {
                break
            }
        }
    } catch (err) {
        console.error('[fetchFollows]: ', err)
    }
}

async function run(fileName: string) {
    console.log(fileName, " Running...")
    await agent.login({ identifier: <string>process.env.FEEDGEN_HANDLE, password: <string>process.env.FEEDGEN_PASSWORD })
    let reader = rd.createInterface(fs.createReadStream(fileName))
    const handles: string[] = [];
    for await (const handle of reader) {
        handles.push(handle);
    }
    const fetchFollowsPool = new PromisePool(() => {
        if (handles.length === 0) {
            return undefined
        }
        const handle = String(handles.shift())
        return fetchFollows(handle)
    }, 20)

    await fetchFollowsPool.start()
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
