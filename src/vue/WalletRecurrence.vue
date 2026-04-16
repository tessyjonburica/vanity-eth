<template>
    <div class="panel">
        <h2>Wallet Activity</h2>
        <p class="subtext">See which addresses this wallet interacts with most and how value flows between them.</p>

        <div class="controls">
            <div class="field">
                <div class="label-row">
                    <label for="wallet-address">Wallet address</label>
                    <a
                        v-if="walletAddress"
                        class="etherscan-link"
                        :href="etherscanAddressUrl(walletAddress)"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open wallet on Etherscan"
                        title="Open wallet on Etherscan"
                    >
                        <svg class="tx-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                                fill="currentColor"
                                d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3ZM5 5h6v2H7v10h10v-4h2v6H5V5Z"
                            />
                        </svg>
                    </a>
                </div>
                <input
                    id="wallet-address"
                    v-model.trim="walletAddress"
                    class="text-input-large"
                    type="text"
                    placeholder="0x..."
                    autocomplete="off"
                />
            </div>

            <div class="field field--small">
                <label for="top-results">Top results</label>
                <input
                    id="top-results"
                    v-model.number="topResults"
                    class="text-input-large"
                    type="number"
                    min="1"
                    max="20"
                />
            </div>

            <div class="actions">
                <button class="button-large" :disabled="loading || !walletAddress" @click="runAnalysis">
                    {{ loading ? 'Analyzing...' : 'Analyze Wallet' }}
                </button>
            </div>
        </div>

        <p v-if="error" class="error-text">{{ error }}</p>
        <p v-if="!loading && !error && results.length === 0 && hasRun" class="subtext">
            No recent valid interactions found.
        </p>

        <div v-if="hasRun && !loading" class="summary">
            <div class="summary-item">
                <div class="summary-label">Current wallet balance (USD)</div>
                <div class="summary-value mono">
                    {{
                        currentWalletBalanceUsdDisplay ||
                        (currentWalletBalanceUsd === null ? '—' : formatAmount(currentWalletBalanceUsd))
                    }}
                </div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Note</div>
                <div class="summary-value">
                    “Net flow” in the table is <span class="mono">(received − sent)</span> with each counterparty, which
                    can differ from your current wallet balance.
                </div>
            </div>
        </div>

        <div v-if="hasRun && !loading" class="table-wrap">
            <table class="results-table">
                <thead>
                    <tr>
                        <th>Address</th>
                        <th>Recurrence</th>
                        <th>Total Sent</th>
                        <th>Total Received</th>
                        <th>Net flow</th>
                        <th>Direction</th>
                        <th>Label</th>
                        <th class="tx-col">Tx</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="error || results.length === 0">
                        <td class="empty-row" colspan="8">
                            {{ error ? `Could not load results: ${error}` : 'No results to display yet.' }}
                        </td>
                    </tr>
                    <tr v-else v-for="entry in results" :key="entry.address">
                        <td class="mono">{{ entry.address }}</td>
                        <td>{{ entry.recurrence }}</td>
                        <td>{{ entry.total_sent_display || formatAmount(entry.total_sent) }}</td>
                        <td>{{ entry.total_received_display || formatAmount(entry.total_received) }}</td>
                        <td>{{ entry.balance_display || formatAmount(entry.balance) }}</td>
                        <td>{{ entry.direction }}</td>
                        <td>{{ entry.label }}</td>
                        <td class="tx-col">
                            <a
                                v-if="entry.latest_tx_hash"
                                class="tx-link"
                                :href="etherscanTxUrl(entry.latest_tx_hash)"
                                target="_blank"
                                rel="noopener noreferrer"
                                :aria-label="`View tx ${entry.latest_tx_hash} on Etherscan`"
                                title="View latest tx on Etherscan"
                            >
                                <svg class="tx-icon" viewBox="0 0 24 24" aria-hidden="true">
                                    <path
                                        fill="currentColor"
                                        d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3ZM5 5h6v2H7v10h10v-4h2v6H5V5Z"
                                    />
                                </svg>
                            </a>
                            <span v-else class="tx-empty">—</span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script>
    export default {
        name: 'WalletRecurrence',
        data() {
            return {
                walletAddress: '',
                topResults: 10,
                loading: false,
                error: '',
                hasRun: false,
                results: [],
                currentWalletBalanceUsd: null,
                currentWalletBalanceUsdDisplay: '',
            };
        },
        methods: {
            etherscanTxUrl(hash) {
                const safe = typeof hash === 'string' ? hash.trim() : '';
                if (!safe) {
                    return 'https://etherscan.io';
                }
                return `https://etherscan.io/tx/${encodeURIComponent(safe)}`;
            },
            etherscanAddressUrl(address) {
                const safe = typeof address === 'string' ? address.trim() : '';
                if (!safe) {
                    return 'https://etherscan.io';
                }
                return `https://etherscan.io/address/${encodeURIComponent(safe)}`;
            },
            formatAmount(value) {
                const num = Number(value);
                if (!Number.isFinite(num)) {
                    return '$0';
                }
                const formatted = Math.abs(num).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 8,
                });
                return `${num < 0 ? '-$' : '$'}${formatted}`;
            },
            async runAnalysis() {
                this.loading = true;
                this.error = '';
                this.hasRun = true;
                try {
                    const query = new URLSearchParams({
                        wallet: this.walletAddress,
                        top: String(this.topResults),
                    });
                    const raw = await fetch(`/api/wallet-recurrence?${query.toString()}`);
                    const text = await raw.text();
                    let response;
                    try {
                        response = text ? JSON.parse(text) : {};
                    } catch (parseErr) {
                        throw new Error(
                            `API returned non-JSON (status ${raw.status}). Are you running the API server?`
                        );
                    }
                    if (!raw.ok) {
                        throw new Error(response.error || 'Analysis failed.');
                    }
                    this.results = Array.isArray(response.counterparties) ? response.counterparties : [];
                    this.currentWalletBalanceUsd =
                        response.current_wallet_balance_usd !== undefined &&
                        response.current_wallet_balance_usd !== null
                            ? Number(response.current_wallet_balance_usd)
                            : null;
                    this.currentWalletBalanceUsdDisplay =
                        response.current_wallet_balance_usd_display &&
                        typeof response.current_wallet_balance_usd_display === 'string'
                            ? response.current_wallet_balance_usd_display
                            : '';
                } catch (err) {
                    this.results = [];
                    this.currentWalletBalanceUsd = null;
                    this.currentWalletBalanceUsdDisplay = '';
                    this.error = err && err.message ? err.message : 'Analysis failed.';
                } finally {
                    this.loading = false;
                }
            },
        },
    };
</script>

<style lang="sass" scoped>
    h2
        margin-bottom: 0.4em

    .label-row
        display: flex
        align-items: center
        justify-content: space-between
        gap: 0.6em

    .etherscan-link
        display: inline-flex
        align-items: center
        justify-content: center
        width: 32px
        height: 32px
        border-radius: 8px
        color: rgba(255, 255, 255, 0.9)
        text-decoration: none
        transition: background-color 120ms ease, color 120ms ease

    .etherscan-link:hover
        background-color: rgba(255, 255, 255, 0.08)
        color: #fff

    .controls
        display: grid
        grid-template-columns: 1fr 160px
        gap: 0.9em
        align-items: end

    .field
        min-width: 0

    .actions
        grid-column: 1 / -1

    .button-large
        width: 100%

    label
        display: block
        margin-bottom: 0.4em

    .subtext
        margin-bottom: 1em
        opacity: 0.8

    .error-text
        color: #ff9b9b
        margin-top: 1em

    .summary
        margin-top: 1em
        display: grid
        grid-template-columns: 1fr 2fr
        gap: 0.9em
        padding: 0.9em
        border: 1px solid rgba(255, 255, 255, 0.12)
        border-radius: 12px
        background: rgba(255, 255, 255, 0.03)

    .summary-label
        font-size: 0.85em
        opacity: 0.75
        margin-bottom: 0.25em

    .summary-value
        font-size: 0.98em

    .table-wrap
        margin-top: 1.5em
        overflow-x: auto

    .results-table
        width: 100%
        border-collapse: collapse
        font-size: 0.93em
        min-width: 760px

    .results-table th,
    .results-table td
        border-bottom: 1px solid rgba(255, 255, 255, 0.15)
        padding: 0.55em 0.4em
        text-align: left

    .mono
        font-family: monospace
        font-size: 0.9em
        word-break: break-all

    .tx-col
        width: 52px
        text-align: center

    .tx-link
        display: inline-flex
        align-items: center
        justify-content: center
        width: 32px
        height: 32px
        border-radius: 8px
        color: rgba(255, 255, 255, 0.9)
        text-decoration: none
        transition: background-color 120ms ease, color 120ms ease

    .tx-link:hover
        background-color: rgba(255, 255, 255, 0.08)
        color: #fff

    .tx-icon
        width: 18px
        height: 18px

    .tx-empty
        opacity: 0.6

    .empty-row
        padding: 0.9em 0.6em
        opacity: 0.85

    @media (max-width: 720px)
        .controls
            grid-template-columns: 1fr

        .summary
            grid-template-columns: 1fr

        .results-table
            font-size: 0.9em
</style>
