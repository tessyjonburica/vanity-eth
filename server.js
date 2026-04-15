'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');

// ---------------------------------------------------------------------------
// Tiny dependency-free static file server + API handler
// Avoids needing to install express as a production dependency.
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT) || 3000;
const DIST_DIR = path.join(__dirname, 'dist');

// Load .env file manually (no dotenv dependency required)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8')
        .split(/\r?\n/)
        .forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx === -1) return;
            const key = trimmed.slice(0, eqIdx).trim();
            const value = trimmed.slice(eqIdx + 1).trim();
            if (key && !(key in process.env)) {
                process.env[key] = value;
            }
        });
}

// Lazy-load the analysis module so the server starts fast
let analyzeWalletRecurrence;
try {
    analyzeWalletRecurrence = require('./src/js/walletRecurrenceAnalysis').analyzeWalletRecurrence;
} catch (err) {
    console.error('[server] Failed to load walletRecurrenceAnalysis:', err.message);
    process.exit(1);
}

// ---------------------------------------------------------------------------
// MIME types for static serving
// ---------------------------------------------------------------------------
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8',
};

function getMime(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return MIME[ext] || 'application/octet-stream';
}

// ---------------------------------------------------------------------------
// API handler  GET /api/wallet-recurrence?wallet=0x...&top=10
// ---------------------------------------------------------------------------
async function handleApi(req, res) {
    const parsed = url.parse(req.url, true);
    const query = parsed.query;

    const wallet = String(query.wallet || '').trim();
    const parsedTop = Number(query.top || 10);
    const top = Math.min(20, Math.max(1, Number.isFinite(parsedTop) ? parsedTop : 10));

    if (!wallet) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'wallet query parameter is required.' }));
    }

    try {
        const result = await analyzeWalletRecurrence(wallet, {
            apiKey: process.env.ETHERSCAN_API_KEY || '',
            topResults: top,
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    } catch (err) {
        const message = err && err.message ? err.message : 'wallet recurrence analysis failed';
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: message }));
    }
}

// ---------------------------------------------------------------------------
// Static file handler
// ---------------------------------------------------------------------------
function handleStatic(req, res) {
    // Strip query string
    let filePath = url.parse(req.url).pathname;

    // Security: prevent directory traversal
    filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');

    let fullPath = path.join(DIST_DIR, filePath);

    // If path is a directory, try index.html inside it
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
        fullPath = path.join(fullPath, 'index.html');
    }

    // SPA fallback: for unknown paths serve index.html
    if (!fs.existsSync(fullPath)) {
        fullPath = path.join(DIST_DIR, 'index.html');
    }

    fs.readFile(fullPath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('Not found');
        }
        res.writeHead(200, { 'Content-Type': getMime(fullPath) });
        res.end(data);
    });
}

// ---------------------------------------------------------------------------
// Main request handler
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
    // CORS headers (useful if you ever call the API from another origin)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    const pathname = url.parse(req.url).pathname;

    if (pathname === '/api/wallet-recurrence') {
        return handleApi(req, res);
    }

    handleStatic(req, res);
});

server.listen(PORT, () => {
    console.log(`\n  vanity-eth server running at http://localhost:${PORT}`);
    console.log(`  Etherscan API key: ${process.env.ETHERSCAN_API_KEY ? '✓ set' : '✗ not set (rate-limited mode)'}`);
    console.log(`  Static files from: ${DIST_DIR}\n`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`  Port ${PORT} is already in use. Set a different PORT env variable.`);
    } else {
        console.error('  Server error:', err.message);
    }
    process.exit(1);
});
