const express = require('express');
const { io } = require('../index');
const { verbose } = require('../config');

const router = express.Router();

router.post('/', (req, res) => {
    io.emit('merge', req.body);

    if (verbose) {
        process.stdout.write('M');
    }

    res.sendStatus(200);
})

module.exports = router;