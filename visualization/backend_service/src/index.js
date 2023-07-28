const express = require('express');
const { Server } = require('socket.io');
const { PORT } = require('./config');

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