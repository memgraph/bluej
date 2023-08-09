const express = require('express');
const { sockets, clientInterests } = require('../index');
const { verbose } = require('../config');

const router = express.Router();

router.post('/', (req, res) => {
    let author;
    if (req.body?.did) {
        author = req.body.did;
    } else {
        author = req.body?.author;
    }

    Object.entries(sockets).forEach(([socketID, socket]) => {
        const interests = clientInterests[socketID];

        if (!interests || interests.includes(author)) {
            socket.emit('create', req.body);
        }
    });

    if (verbose) {
        process.stdout.write('C');
    }

    res.sendStatus(200);
})

module.exports = router;