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
            <p class="subtext note">
                Net is calculated as received minus sent (ETH). A negative net means the wallet sent more ETH to that
                address than it received.
            </p>
            <div class="results-cards">
                <div v-for="entry in results" :key="entry.address" class="result-card">
                    <div class="card-row">
                        <div class="card-label">Address</div>
                        <div class="card-value mono" :title="entry.address">{{ shortAddress(entry.address) }}</div>
                    </div>
                    <div class="card-row">
                        <div class="card-label">Recurrence</div>
                        <div class="card-value">{{ entry.recurrence }}</div>
                    </div>
                    <div class="card-row">
                        <div class="card-label">Sent</div>
                        <div class="card-value">{{ formatEth(entry.total_sent, entry.currency) }}</div>
                    </div>
                    <div class="card-row">
                        <div class="card-label">Received</div>
                        <div class="card-value">{{ formatEth(entry.total_received, entry.currency) }}</div>
                    </div>
                    <div class="card-row">
                        <div class="card-label">Net (recv − sent)</div>
                        <div class="card-value" :class="balanceClass(entry.balance)">
                            {{ formatEth(entry.balance, entry.currency, { showSign: true }) }}
                        </div>
                    </div>
                    <div class="card-row">
                        <div class="card-label">Direction</div>
                        <div class="card-value">{{ entry.direction }}</div>
                    </div>
                    <div class="card-row">
                        <div class="card-label">Label</div>
                        <div class="card-value">{{ entry.label }}</div>
                    </div>
                </div>
            </div>

            <table class="results-table">
                <thead>
                    <tr>
                        <th>Address</th>
                        <th>Recurrence</th>
                        <th>Total Sent (ETH)</th>
                        <th>Total Received (ETH)</th>
                        <th>Net (recv − sent)</th>
                        <th>Direction</th>
                        <th>Label</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="entry in results" :key="entry.address">
                        <td class="mono">{{ entry.address }}</td>
                        <td>{{ entry.recurrence }}</td>
                        <td>{{ formatEth(entry.total_sent, entry.currency) }}</td>
                        <td>{{ formatEth(entry.total_received, entry.currency) }}</td>
                        <td :class="balanceClass(entry.balance)">
                            {{ formatEth(entry.balance, entry.currency, { showSign: true }) }}
                        </td>
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
            formatAmount(value, options = {}) {
                const num = Number(value);
                if (!Number.isFinite(num)) {
                    return '0';
                }
                const maximumFractionDigits = Number.isFinite(options.maximumFractionDigits)
                    ? options.maximumFractionDigits
                    : 8;
                return num.toLocaleString(undefined, { maximumFractionDigits });
            },
            formatEth(value, currency, options = {}) {
                const num = Number(value);
                const symbol = currency || 'ETH';
                if (!Number.isFinite(num)) {
                    return `0 ${symbol}`;
                }
                const showSign = Boolean(options.showSign);
                const formatted = this.formatAmount(num, { maximumFractionDigits: 8 });
                const sign = showSign && num > 0 ? '+' : '';
                return `${sign}${formatted} ${symbol}`;
            },
            shortAddress(address) {
                const addr = String(address || '');
                if (!addr.startsWith('0x') || addr.length < 10) {
                    return addr;
                }
                return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
            },
            balanceClass(balance) {
                const num = Number(balance);
                if (!Number.isFinite(num) || num === 0) return 'balance-neutral';
                return num > 0 ? 'balance-positive' : 'balance-negative';
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

    .note
        margin-top: 0.5em

    .error-text
        color: #ff9b9b
        margin-top: 1em

    .table-wrap
        margin-top: 1.5em
        overflow-x: auto

    .results-cards
        display: none
        margin-top: 1em
        gap: 0.8em

    .result-card
        background: rgba(255, 255, 255, 0.06)
        border: 1px solid rgba(255, 255, 255, 0.12)
        border-radius: 10px
        padding: 0.9em

    .card-row
        display: flex
        justify-content: space-between
        gap: 1em
        padding: 0.25em 0

    .card-label
        opacity: 0.8

    .card-value
        text-align: right
        word-break: break-word

    .balance-positive
        color: #8ef0b3

    .balance-negative
        color: #ff9b9b

    .balance-neutral
        opacity: 0.9

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

    @media screen and (max-width: 640px)
        .results-table
            display: none

        .results-cards
            display: grid
</style>
