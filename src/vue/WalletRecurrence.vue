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
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="entry in results" :key="entry.address">
                        <td class="mono">{{ entry.address }}</td>
                        <td>{{ entry.recurrence }}</td>
                        <td>{{ formatAmount(entry.total_sent) }}</td>
                        <td>{{ formatAmount(entry.total_received) }}</td>
                        <td>{{ formatAmount(entry.balance) }}</td>
                        <td>{{ entry.direction }}</td>
                        <td>{{ entry.label }}</td>
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

    @media (max-width: 720px)
        .controls
            grid-template-columns: 1fr

        .results-table
            font-size: 0.9em
</style>
