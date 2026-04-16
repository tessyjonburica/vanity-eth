<template>
    <div class="panel">
        <h2>Wallet Activity</h2>
        <p class="subtext">See which addresses this wallet interacts with most and how value flows between them.</p>

        <div class="controls">
            <div class="field">
                <label for="wallet-address">Wallet address</label>
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

        <div v-if="results.length" class="table-wrap">
            <table class="results-table">
                <thead>
                    <tr>
                        <th>Address</th>
                        <th>Recurrence</th>
                        <th>Total Sent</th>
                        <th>Total Received</th>
                        <th>Balance</th>
                        <th>Direction</th>
                        <th>Label</th>
                        <th class="tx-col">Tx</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="entry in results" :key="entry.address">
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
                    const response = await raw.json();
                    if (!raw.ok) {
                        throw new Error(response.error || 'Analysis failed.');
                    }
                    this.results = Array.isArray(response.counterparties) ? response.counterparties : [];
                } catch (err) {
                    this.results = [];
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

    @media (max-width: 720px)
        .controls
            grid-template-columns: 1fr

        .results-table
            font-size: 0.9em
</style>
