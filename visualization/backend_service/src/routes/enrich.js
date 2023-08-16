const express = require('express');
const enrichPerson = require('../util/enrich_util');

const router = express.Router();

router.post('/person', async (req, res) => {
    if (process.env.ENRICHMENT !== 'true') {
        res.sendStatus(200);
        return;
    }

    const did = req.body.did;

    const result = await enrichPerson(did);

    if (result) {
        if (process.env.VERBOSE === 'true') {
            process.stdout.write('Ep');
        }

        res.sendStatus(200);
    } else {
        if (process.env.VERBOSE === 'true') {
            process.stdout.write(`\nAn error occured while trying to enrich person with DID: ${did}.\n`);
        }

        res.sendStatus(500);
    }
})

module.exports = router;