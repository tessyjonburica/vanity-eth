<template>
    <div class="panel">
        <p class="intro">
            Veleno lets you craft an Ethereum address that's unmistakably yours — choose a prefix, suffix, or both, and
            let your browser do the heavy lifting.
        </p>
        <div class="shortcut">
            <button type="button" class="button-large" @click="scrollDown">Generate now</button>
        </div>

        <div class="info-grid">
            <div class="info-block">
                <h2>What is a vanity address?</h2>
                <p>A custom address where part of the hex is your choice — not random noise.</p>
                <ul>
                    <li><span class="monospace">0x<b>c0ffee</b>254729296a45a3885639AC7E10F9d54979</span></li>
                    <li><span class="monospace">0x<b>dead</b>99cf1046e68e36E1aA2E0E07105eDDD1f08E</span></li>
                </ul>
            </div>

            <div class="info-block">
                <h2>Security</h2>
                <p>
                    Everything runs locally in your browser — no servers, no databases, no leaks.
                    <b>Veleno never sees your private key.</b> Disconnect from the internet after loading and it still
                    works. Keystores are encrypted with AES-128-CTR + PBKDF2-SHA256.
                </p>
            </div>

            <div class="info-block">
                <h2>Compatibility</h2>
                <p>
                    Every address is ERC-20 ready. Keystore files drop straight into MetaMask, MyEtherWallet, and geth.
                    Chrome gives the best generation throughput.
                </p>
            </div>
        </div>
    </div>
</template>

<script>
    export default {
        data: function () {
            return {
                scrollTimeOut: null,
            };
        },
        methods: {
            scrollDown() {
                this.scrollTo(document.getElementById('input-panel'), -1);
            },
            scrollTo(element, lastValue) {
                let currentValue = window.scrollY;
                let diff = element.getBoundingClientRect().top / 6;
                if (Math.abs(diff) > 1 && currentValue > lastValue) {
                    window.scrollTo(0, window.scrollY + diff);
                    this.scrollTimeOut = setTimeout(this.scrollTo, 30, element, currentValue);
                } else if (currentValue >= lastValue) {
                    document.getElementById('input').focus();
                }
            },
        },
    };
</script>

<style lang="sass" scoped>
    @import "../css/variables"

    .intro
        font-size: 1.05em
        line-height: 1.7
        color: $text-alt
        margin-bottom: 0.5em

    .shortcut
        text-align: center
        .button-large
            width: 160px
            margin: 18px 0 32px

    .info-grid
        display: grid
        grid-template-columns: repeat(3, 1fr)
        gap: 2em
        margin-top: 0.5em

    .info-block
        h2
            font-size: 0.82em
            text-transform: uppercase
            letter-spacing: 0.12em
            color: $secondary
            margin-bottom: 0.6em
            font-weight: 700
        p
            color: $text-alt
            font-size: 0.92em
            line-height: 1.65
            margin: 0 0 0.6em
        ul
            margin: 0.4em 0 0 0
            padding-left: 1.1em
            li
                color: $text-alt
                font-size: 0.88em
                margin-bottom: 0.3em
        .monospace
            font-family: $monospace-font
            font-size: 0.82em
            b
                color: $secondary

    @media screen and (max-width: 900px)
        .info-grid
            grid-template-columns: 1fr 1fr

    @media screen and (max-width: 580px)
        .info-grid
            grid-template-columns: 1fr
</style>
