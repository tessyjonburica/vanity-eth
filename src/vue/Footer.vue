<template>
    <footer>
        <div class="container">
            <div class="row align-items-center">
                <div class="col-12 col-lg-8 address">
                    <span class="label">Tips&nbsp;</span>
                    <a :href="`https://etherscan.io/address/${tipsAddress}`" target="_blank" v-text="tipsAddress"></a>
                </div>
                <div class="col-12 col-lg-4 links">
                    <a :href="`https://etherscan.io/address/${tipsAddress}`" target="_blank">
                        <i class="icon-ethereum"></i>&nbsp;&nbsp;Donate
                    </a>
                </div>
            </div>
        </div>
    </footer>
</template>

<script>
    export default {
        data: function () {
            return {
                tipsAddress: '0xAceBabe64807cb045505b268ef253D8fC2FeF5Bc',
            };
        },
    };
</script>

<style lang="sass" scoped>
    @import "../css/variables"
    footer
        padding: 1rem 0 0.5rem
        background-color: $panel-background
        color: $text-alt
        border-top: 1px solid $border-grey
        a
            text-decoration: none
            color: $text-alt
            &:hover
                color: $text
        .label
            font-size: 0.78em
            text-transform: uppercase
            letter-spacing: 0.1em
            color: $text-alt
            margin-right: 4px
        .address
            margin-bottom: 12px
            a
                font-family: $monospace-font
                font-size: 0.88em
                word-break: break-all
        .links
            text-align: right
            a
                margin-right: 20px
                i
                    font-size: 1.1em

    @media screen and (max-width: 480px)
        footer
            padding-bottom: 1em
        .links
            text-align: left
            margin-top: 8px
</style>
