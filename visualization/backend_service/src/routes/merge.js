const express = require('express');
const { sockets, clientInterests } = require('../index');
const { verbose } = require('../config');

const router = express.Router();

router.post('/', (req, res) => {
    const author = req.body?.author || req.body.source;

    Object.entries(sockets).forEach(([socketID, socket]) => {
        const interests = clientInterests[socketID];

        if (!interests || interests.includes(author)) {
            socket.emit('merge', req.body);
        }
    });

    if (verbose) {
        process.stdout.write('M');
    }

    res.sendStatus(200);
})

module.exports = router;