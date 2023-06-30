import axios from 'axios'
import { BskyAgent } from '@atproto/api'
import * as dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

const agent = new BskyAgent({
    service: 'https://bsky.social/',
})

// Function to resolve a handle to a DID using the getProfile XRPC call. Returns an empty string on failure
async function fetchDid(handle: string): Promise<string> {
    try {
        handle = handle.trim()
        let profile = await agent.getProfile({ actor: handle })
        return profile.data.did
    } catch (err) {
        //console.error('fetchDid failed for', handle )
        return ''
    }
}

async function downloadCSVData(): Promise<string[]> {

    // Google sheet created by @jillianne.bsky.social / https://bsky.app/profile/did:plc:jjioi6tsi2v5oqz5bp2labs2
    const url = 'https://docs.google.com/spreadsheets/d/1HrhKRL7G8eaJxm2hk_J-Q0YMS1ztWY98RFPfnBkA_AA/gviz/tq?tqx=out:csv&sheet=Authors%20on%20Bluesky';
    
    try {
        // Fetch the sheet as CSV so it can be parsed
        const response = await axios.get(url)
        const csvData: string = response.data

        // Split the CSV data into rows
        const rows: string[] = csvData.split('\n')

        // Extract the values from the first column starting at the 3rd row which contains the author handles
        const values: string[] = rows.slice(2).map((row) => row.split(',')[0].replace(/"|@/g, ''))
        
        // The handle then needs to be resolved to a DID that can be used in queries
        const fetchedValues = await Promise.all(
            values.map((value) => fetchDid(value))
        )
        // Some of them might fail lookup, so filter out any empty (failed) values
        const nonEmptyValues: string[] = fetchedValues.filter((value) => value !== '')

        // And finally we have a list of author DIDs from the spreadsheet
        return nonEmptyValues

    } catch (error) {
        console.error('Error downloading CSV data:', error)
        return []
    }
}

async function run() {
    await agent.login({ identifier: <string>process.env.FEEDGEN_HANDLE, password: <string>process.env.FEEDGEN_PASSWORD })
    const authors = await downloadCSVData()
    if (authors.length > 0) {
        fs.writeFile('authors.json', JSON.stringify(authors), err => {
            if (err) {
                console.error('Error writing file:', err)
            }
        })
    }
}

run()
