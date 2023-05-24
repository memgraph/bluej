import { BskyAgent, AtpSessionEvent, AtpSessionData } from '@atproto/api'
import * as dotenv from 'dotenv'
dotenv.config()
const util = require('util')

const agent = new BskyAgent({
    service: 'https://bsky.social/',
})

async function fetchProfile(handle: string) {
    try {
        let profile = await agent.getProfile({actor: handle})
        console.log(util.inspect(profile, false, null, true))
    } catch (err) {
        console.error('[fetchProfile]:', err)
    }
}

async function run(handle: string) {
    console.log(" Querying...", handle)
    await agent.login({ identifier: <string>process.env.FEEDGEN_HANDLE, password: <string>process.env.FEEDGEN_PASSWORD })
    fetchProfile(handle)
}

let handle = process.argv[2]?.trim()
if (handle === undefined) {
    console.log("Usage: ts-node get-did.ts <handle>")
    process.exit(1)
}

run(handle)
