const express = require('express');
const { sockets, clientInterests } = require('../index');

const router = express.Router();

router.post('/', (req, res) => {
    const author = req.body.source.startsWith('did') ? req.body.source : req.body?.author;

    Object.entries(sockets).forEach(([socketID, socket]) => {
        const interests = clientInterests[socketID];

        if (!interests || interests.includes(author)) {
            socket.emit('merge', req.body);
        }
    });

    if (process.env.VERBOSE === 'true') {
        process.stdout.write('M');
    }

    res.sendStatus(200);
})

module.exports = router;