const express = require('express');
const { sockets, clientInterests } = require('../index');
const { verbose } = require('../config');

const router = express.Router();

router.post('/', (req, res) => {
    const author = req.body.author;

    Object.entries(sockets).forEach(([socketID, socket]) => {
        const interests = clientInterests[socketID];

        if (!interests || interests.includes(author)) {
            socket.emit('delete', req.body);
        }
    });

    if (verbose) {
        process.stdout.write('D');
    }

    res.sendStatus(200);
})

module.exports = router;