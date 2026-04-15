<template>
    <div class="panel">
        <p v-if="error === 'workers_unsupported'">
            Your browser doesn't support multi-threaded computation.<br />
            Try Chrome or Firefox for the best experience.
        </p>

        <div v-if="error === 'insecure_location'">
            <h3>Security alert</h3>
            Veleno is running from an untrusted context, which could expose your private keys.<br />
            Run it locally or download the build to use offline.
        </div>
        <p v-else v-html="error.replace('\n', '<br>')"></p>
    </div>
</template>

<script>
    export default {
        props: {
            error: {
                type: String,
                required: true,
            },
        },
    };
</script>

<style lang="sass" scoped>
    @import "../css/variables"
    .panel
        background-color: $error
        color: $text-opposite
        a, a:visited, a:hover
            text-decoration: underline
            color: $text-opposite
</style>
