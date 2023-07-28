const express = require('express');
const { io } = require('../index');
const { verbose } = require('../config');

const router = express.Router();

router.post('/', (req, res) => {
    io.emit('delete', req.body);

    if (verbose) {
        process.stdout.write('D');
    }

    res.sendStatus(200);
})

module.exports = router;