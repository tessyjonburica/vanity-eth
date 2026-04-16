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
