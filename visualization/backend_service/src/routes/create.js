const express = require('express');
const { sockets, clientInterests } = require('../index');

const router = express.Router();

router.post('/', (req, res) => {
    const author = req.body?.did || req.body?.author;

    Object.entries(sockets).forEach(([socketID, socket]) => {
        const interests = clientInterests[socketID];

        if (!interests || interests.includes(author)) {
            socket.emit('create', req.body);
        }
    });

    if (process.env.VERBOSE === 'true') {
        process.stdout.write('C');
    }

    res.sendStatus(200);
})

module.exports = router;