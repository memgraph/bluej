const express = require('express');
const { Server } = require('socket.io');
const { PORT, BFSDepth } = require('./config');
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

io.on('connection', (socket) => {
    console.log('\nUser connected.');

    socket.on('interest', async (clientInterest) => {
        console.log('Client is interested in did: ' + clientInterest);

        const session = driver.session();

        try {
            const results = await session.run(
                `MATCH (p {did: "${clientInterest}"})
                MATCH path=(p)-[*bfs 1..${BFSDepth}]-(r)
                UNWIND relationships(path) AS relationship
                RETURN startNode(relationship) AS startNode, relationship, endNode(relationship) AS endNode;`
            );

            // const new_results = [];

            // const relationship_types = new Set();
            // const node_types = new Set();

            results.records.forEach(record => {
                const node1 = {
                    type: record._fields[0].labels[0],
                    ...record._fields[0].properties
                };
                
                const node2 = {
                    type: record._fields[2].labels[0],
                    ...record._fields[2].properties
                };

                let start = '';
                let end = '';

                if (record._fields[1].startNodeElementId === record._fields[0].elementId) {
                    start = record._fields[0].properties?.uri || record._fields[0].properties?.did;
                    end = record._fields[2].properties?.uri || record._fields[2].properties?.did;
                } else {
                    start = record._fields[2].properties?.uri || record._fields[2].properties?.did;
                    end = record._fields[0].properties?.uri || record._fields[0].properties?.did;
                }

                const relationship = {
                    type: record._fields[1].type.toLowerCase(),
                    start,
                    end
                };

                socket.emit('initial', {node1, relationship, node2});
                // new_results.push({node1, relationship, node2});

                // relationship_types.add(relationship.type);
                // node_types.add(node1.type);
                // node_types.add(node2.type);
            });

            // socket.emit('initial', new_results);

            // console.log(relationship_types); // Set(5) { 'follow', 'like', 'author_of', 'parent', 'root' }
            // console.log(node_types); // Set(2) { 'Person', 'Post' }
        } finally {
            await session.close();
        }
    })

    socket.on('disconnect', () => {
        console.log('\nUser disconnected.');
    });
});

module.exports = {
    io: io
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