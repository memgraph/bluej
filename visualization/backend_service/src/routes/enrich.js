const express = require('express');
const { enrichment, verbose } = require('../config');
const enrichPerson = require('../util/enrich_util');

const router = express.Router();

router.post('/person', async (req, res) => {
    if (!enrichment) {
        res.sendStatus(200);
        return;
    }

    const did = req.body.did;

    const result = await enrichPerson(did);

    if (result) {
        if (verbose) {
            process.stdout.write('Ep');
        }

        res.sendStatus(200);
    } else {
        if (verbose) {
            process.stdout.write(`\nAn error occured while trying to enrich person with DID: ${did}.\n`);
        }

        res.sendStatus(500);
    }
})

module.exports = router;