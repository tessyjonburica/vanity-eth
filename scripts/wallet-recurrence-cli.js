#!/usr/bin/env node
/* eslint-disable no-console */
const { analyzeWalletRecurrence } = require('../src/js/walletRecurrenceAnalysis');

const parseCsvAddresses = (value) =>
    new Set(
        String(value || '')
            .split(',')
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean)
    );

const parseArgs = (argv) => {
    const args = {
        wallet: '',
        apiKey: process.env.ETHERSCAN_API_KEY || '',
        baseUrl: 'https://api.etherscan.io/v2/api',
        exchangeAddresses: new Set(),
        spamAddresses: new Set(),
        top: 10,
    };

    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (token === '--wallet') {
            args.wallet = argv[i + 1];
            i++;
        } else if (token === '--apiKey') {
            args.apiKey = argv[i + 1];
            i++;
        } else if (token === '--baseUrl') {
            args.baseUrl = argv[i + 1];
            i++;
        } else if (token === '--exchange') {
            args.exchangeAddresses = parseCsvAddresses(argv[i + 1]);
            i++;
        } else if (token === '--spam') {
            args.spamAddresses = parseCsvAddresses(argv[i + 1]);
            i++;
        } else if (token === '--top') {
            args.top = Number(argv[i + 1]) || 10;
            i++;
        }
    }

    return args;
};

const printUsage = () => {
    console.log('Usage:');
    console.log(
        'node scripts/wallet-recurrence-cli.js --wallet <0x...> [--apiKey <ETHERSCAN_KEY>] [--baseUrl <url>] [--exchange <a,b>] [--spam <a,b>] [--top <N>]'
    );
};

const main = async () => {
    const args = parseArgs(process.argv.slice(2));
    if (!args.wallet) {
        printUsage();
        process.exitCode = 1;
        return;
    }

    const result = await analyzeWalletRecurrence(args.wallet, {
        apiKey: args.apiKey,
        etherscanBaseUrl: args.baseUrl,
        exchangeAddresses: args.exchangeAddresses,
        spamAddresses: args.spamAddresses,
        topResults: args.top,
    });

    console.log(JSON.stringify(result, null, 2));
};

main().catch((err) => {
    console.error(`wallet recurrence analysis failed: ${err.message}`);
    process.exitCode = 1;
});
