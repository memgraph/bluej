require('dotenv').config();
const express = require('express');
const { Server } = require('socket.io');

const neo4j = require('neo4j-driver');
const driver = neo4j.driver('bolt://localhost:7687');

const { BskyAgent } = require('@atproto/api');
const agent = new BskyAgent({
    service: 'https://bsky.social/',
});

const login_bluesky = async () => {
    try {
        await agent.login({ identifier: process.env.HANDLE, password: process.env.PASSWORD });

        if (process.env.VERBOSE === 'true') {
            console.log('Connected to Bluesky agent.');
        }
    } catch (err) {
        if (process.env.VERBOSE === 'true') {
            console.log('Failed to connect to Bluesky agent. Trying again in 10 seconds...');
        }

        setTimeout(() => login_bluesky(), 10000);
    }
}

login_bluesky();

const app = express();

const server = app.listen(parseInt(process.env.PORT), () => {
    if (process.env.VERBOSE === 'true') {
        console.log(`App listening on port ${process.env.PORT}.`);
    }
});

const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT
    }
});

const sockets = {};
const clientInterests = {};

io.on('connection', (socket) => {
    if (process.env.VERBOSE === 'true') {
        console.log('\nUser connected.');
    }

    sockets[socket.id] = socket;

    socket.on('interest', async (clientInterest) => {
        if (clientInterest && clientInterest.match(/^([a-zA-Z0-9\.-]+)$/)) {
            if (process.env.VERBOSE === 'true') {
                console.log('Client is interested in handle: ' + clientInterest);
            }

            const session = driver.session();
    
            try {
                // Initialization of the DID interest array
                const DIDs = [];
                const results = [];

                const interestPerson = await session.run(`MATCH (interested:Person {handle: "${clientInterest}"}) RETURN interested;`);
                const initialRecord = interestPerson.records[0];

                if (initialRecord) {
                    DIDs.push(initialRecord._fields[0].properties.did);

                    // Initialize visualization array with filtered node
                    results.push({
                        type: initialRecord._fields[0].labels[0],
                        ...initialRecord._fields[0].properties
                    });

                    // Find the most active direct friends, add some of them (nodeCount - 1) to visualization array
                    const closeFollowers = await session.run(
                        `MATCH (interested:Person {handle: "${clientInterest}"})-[follow:FOLLOW]->(follower:Person)
                        WITH interested, follow, follower
                        OPTIONAL MATCH (follower)-[]->(post:Post)
                        RETURN interested, follow, follower, count(post) AS number_of_posts ORDER BY number_of_posts DESC LIMIT 1000;`
                    );
    
                    if (closeFollowers?.records[0]?._fields[0]) {
                        let cnt = 0;
    
                        closeFollowers.records.forEach(record => {
                            DIDs.push(record._fields[2].properties.did);
    
                            if (cnt >= parseInt(process.env.NODE_COUNT)) {
                                return;
                            }
    
                            const node1 = {
                                type: record._fields[0].labels[0],
                                ...record._fields[0].properties
                            };
                            
                            const node2 = {
                                type: record._fields[2].labels[0],
                                ...record._fields[2].properties
                            };
            
                            let source = record._fields[0].properties.did;
                            let target = record._fields[2].properties.did;
            
                            const relationship = {
                                type: record._fields[1].type,
                                source,
                                target
                            };
            
                            results.push({node1, relationship, node2});
                            cnt++;
                        });
                    }
                    
                    // Find friends of friends, add 1000 most active ones to the DID interest array
                    const distantFollowers = await session.run(
                        `MATCH (interested:Person {handle: "${clientInterest}"})-[:FOLLOW *2]->(follower:Person)
                        WITH follower
                        OPTIONAL MATCH (follower)-[]->(post:Post)
                        RETURN follower.did AS did, count(post) AS number_of_posts ORDER BY number_of_posts DESC LIMIT 1000;`
                    );
    
                    if (distantFollowers?.records[0]?._fields[0]) {
                        distantFollowers.records.forEach(record => {
                            DIDs.push(record._fields[0]);
                        });
                    }
                }

                clientInterests[socket.id] = DIDs;
                socket.emit(`initial ${clientInterest}`, results);
            } finally {
                await session.close();
            }
        } else {
            if (clientInterests[socket.id]) {
                delete clientInterests[socket.id];
            }
        }
    });

    socket.on('info', async (id) => {
        if (!id || !id.match(/^([a-zA-Z0-9\.:\/]+)$/)) {
            return;
        }

        if (process.env.VERBOSE === 'true') {
            console.log('Client is interested in info about ID: ' + id);
        }

        const info = {};
        const session = driver.session();

        try {
            if (id.startsWith('did')) {
                const result = await session.run(`MATCH (p:Person {did: "${id}"}) RETURN p;`);
                const resultProperties = result.records[0]?._fields[0]?.properties;

                if (resultProperties?.displayName) {
                    info['Display name'] = resultProperties.displayName;
                }

                if (resultProperties?.handle) {
                    info['Handle'] = resultProperties.handle;
                }

                if (resultProperties?.description) {
                    info['Description'] = resultProperties.description;
                }

                if (resultProperties?.followersCount >= 0) {
                    info['Followers'] = resultProperties.followersCount;
                }

                if (resultProperties?.followsCount >= 0) {
                    info['Following'] = resultProperties.followsCount;
                }
            } else {
                const result = await session.run(`MATCH (p:Post {uri: "${id}"}) RETURN p;`);
                const resultProperties = result.records[0]?._fields[0]?.properties;

                if (resultProperties?.text) {
                    info['Text'] = resultProperties.text;
                }

                if (resultProperties?.repostUri) {
                    const originalResult = await session.run(`MATCH (p:Post {uri: "${resultProperties.repostUri}"}) RETURN p.text;`);
                    const originalText = originalResult.records[0]?._fields[0];

                    if (originalText) {
                        info['Original post text'] = originalText;
                    }
                }

                if (resultProperties?.author) {
                    const author = await session.run(`MATCH (p:Person {did: "${resultProperties.author}"}) RETURN p.handle;`);
                    const authorHandle = author.records[0]?._fields[0];

                    if (authorHandle) {
                        info['Author'] = authorHandle;
                    }
                }

                if (resultProperties?.createdAt) {
                    let splitDate = resultProperties.createdAt.substring(0, 10).split('-');
                    let dateTime = `${resultProperties.createdAt.substring(11, 16)}, ${splitDate[2]}.${splitDate[1]}.${splitDate[0]}.`;
                    info['Created at'] = dateTime;
                }
            }
        } finally {
            await session.close();
        }

        if (Object.keys(info).length > 0) {
            const package = {id, info};
            socket.emit('info', package);
        }
    });

    socket.on('disconnect', () => {
        if (process.env.VERBOSE === 'true') {
            console.log('\nUser disconnected.');
        }

        delete sockets[socket.id];

        if (clientInterests[socket.id]) {
            delete clientInterests[socket.id];
        }
    });
});

module.exports = {
    io,
    sockets,
    clientInterests,
    driver,
    agent
};

app.use(express.json());

const createRouter = require('./routes/create');
const deleteRouter = require('./routes/delete');
const mergeRouter = require('./routes/merge');
const detachRouter = require('./routes/detach');
const enrichRouter = require('./routes/enrich');

app.use('/create', createRouter);
app.use('/delete', deleteRouter);
app.use('/merge', mergeRouter);
app.use('/detach', detachRouter);
app.use('/enrich', enrichRouter);

app.get('/status', (req, res) => {
    res.status(200).send('Server up and running.');
});