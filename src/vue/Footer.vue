<template>
    <footer>
        <div class="container">
            <div class="footer-row">
                <div class="footer-left">
                    <span class="footer-text">Data provided by Etherscan-compatible APIs.</span>
                </div>
            </div>
        </div>
    </footer>
</template>

<script>
    export default {
        name: 'Foot',
    };
</script>

<style lang="sass" scoped>
    @import "../css/variables"
    footer
        padding: 0.9rem 0
        background-color: $panel-background
        color: $text-alt
        border-top: 1px solid $border-grey

    .footer-row
        display: flex
        align-items: center
        justify-content: space-between
        gap: 0.9rem

    .footer-left
        display: flex
        align-items: center
        gap: 0.6rem
        min-width: 0

    .footer-text
        font-size: 0.9em
        opacity: 0.8

    @media screen and (max-width: 480px)
        .footer-row
            flex-direction: column
            align-items: flex-start
</style>
