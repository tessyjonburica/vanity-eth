'use strict';

const { analyzeWalletRecurrence } = require('../src/js/walletRecurrenceAnalysis');

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

    try {
        const { wallet, top } = req.query;
        const walletAddr = String(wallet || '').trim();
        const parsedTop = Number(top || 10);
        const topCount = Math.min(20, Math.max(1, Number.isFinite(parsedTop) ? parsedTop : 10));

        if (!walletAddr) {
            return res.status(400).json({ error: 'wallet query parameter is required.' });
        }

        const result = await analyzeWalletRecurrence(walletAddr, {
            apiKey: process.env.ETHERSCAN_API_KEY || '',
            topResults: topCount,
        });

        return res.status(200).json(result);
    } catch (err) {
        const message = err && err.message ? err.message : 'wallet recurrence analysis failed';
        return res.status(500).json({ error: message });
    }
};
