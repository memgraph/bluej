const express = require('express');
const { Server } = require('socket.io');
const { PORT } = require('./config');
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
            console.log('Client is interested in DID: ' + clientInterest);

            const session = driver.session();
    
            try {
                const DIDs = [];

                const interestPerson = await session.run(`MATCH (interest:Person {did: "${clientInterest}"}) RETURN interest;`);
                const initialRecord = interestPerson.records[0];

                if (initialRecord) {
                    DIDs.push(clientInterest);

                    socket.emit('create', {
                        type: initialRecord._fields[0].labels[0].toLowerCase(),
                        ...initialRecord._fields[0].properties
                    });

                    const closeFollowers = await session.run(
                        `MATCH (interested:Person {did: "${clientInterest}"})-[follow:FOLLOW]->(follower:Person)-[]->(post:Post)
                        RETURN interested, follow, follower, count(post) AS number_of_posts ORDER BY number_of_posts DESC LIMIT 1000;`
                    );
    
                    if (closeFollowers.records[0]._fields[0] !== null) {
                        let cnt = 0;
    
                        DIDs.push(clientInterest);

                        // const new_results = [];
    
                        closeFollowers.records.forEach(record => {
                            DIDs.push(record._fields[2].properties.did);
    
                            if (cnt >= 50) {
                                return;
                            }
    
                            const node1 = {
                                type: record._fields[0].labels[0].toLowerCase(),
                                ...record._fields[0].properties
                            };
                            
                            const node2 = {
                                type: record._fields[2].labels[0].toLowerCase(),
                                ...record._fields[2].properties
                            };
            
                            let source = record._fields[0].properties.did;
                            let target = record._fields[2].properties.did;
            
                            const relationship = {
                                type: record._fields[1].type.toLowerCase(),
                                source,
                                target
                            };
            
                            socket.emit(`initial ${clientInterest}`, {node1, relationship, node2});
                            // new_results.push({node1, relationship, node2});
    
                            cnt++;
                        });
                    }
                    
                    const distantFollowers = await session.run(
                        `MATCH (p:Person {did: "${clientInterest}"})-[:FOLLOW *2]->(follower:Person)-[]->(post:Post)
                        RETURN follower.did AS did, count(post) AS number_of_posts ORDER BY number_of_posts DESC LIMIT 1000;`
                    );
    
                    if (distantFollowers.records[0]._fields[0] !== null) {
                        distantFollowers.records.forEach(record => {
                            DIDs.push(record._fields[0]);
                        });
                    }
                }

                clientInterests[socket.id] = DIDs;
            } finally {
                await session.close();

                console.log(clientInterests);
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

app.use('/create', createRouter);
app.use('/delete', deleteRouter);
app.use('/merge', mergeRouter);

app.get('/status', (req, res) => {
    res.status(200).send('Server up and running.');
});