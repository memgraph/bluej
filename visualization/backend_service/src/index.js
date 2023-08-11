const express = require('express');
const { Server } = require('socket.io');
const { PORT, nodeCount } = require('./config');
const neo4j = require('neo4j-driver');
const driver = neo4j.driver('bolt://localhost:7687');

const app = express();

const server = app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}.`);
});

const io = new Server(server, {
    cors: {
      origin: 'http://localhost:3001'
    }
});

const sockets = {};
const clientInterests = {};

io.on('connection', (socket) => {
    console.log('\nUser connected.');

    sockets[socket.id] = socket;

    socket.on('interest', async (clientInterest) => {
        if (clientInterest !== '') {
            console.log('Client is interested in handle: ' + clientInterest);

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
    
                            if (cnt >= nodeCount) {
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
    })

    socket.on('disconnect', () => {
        console.log('\nUser disconnected.');

        delete sockets[socket.id];

        if (clientInterests[socket.id]) {
            delete clientInterests[socket.id];
        }
    });
});

module.exports = {
    io,
    sockets,
    clientInterests
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