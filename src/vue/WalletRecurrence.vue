<template>
    <div class="panel">
        <h2>Wallet Activity</h2>
        <p class="subtext">See which addresses this wallet interacts with most and how value flows between them.</p>

        <label for="wallet-address">Wallet address</label>
        <input
            id="wallet-address"
            v-model.trim="walletAddress"
            class="text-input-large"
            type="text"
            placeholder="0x..."
            autocomplete="off"
        />

        <label for="top-results">Top results</label>
        <input id="top-results" v-model.number="topResults" class="text-input-large" type="number" min="1" max="20" />

        <button class="button-large" :disabled="loading || !walletAddress" @click="runAnalysis">
            {{ loading ? 'Analyzing...' : 'Analyze Wallet' }}
        </button>

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
                    return '0';
                }
                return num.toLocaleString(undefined, { maximumFractionDigits: 8 });
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

    .results-table th,
    .results-table td
        border-bottom: 1px solid rgba(255, 255, 255, 0.15)
        padding: 0.55em 0.4em
        text-align: left

    .mono
        font-family: monospace
        font-size: 0.9em
</style>
