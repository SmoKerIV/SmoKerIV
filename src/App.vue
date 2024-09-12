/* eslint-disable */
<template>
    <div id="app">
        <AppHeader /> 
        <HomePage />
    </div>
</template>

<script>
import AppHeader from './components/AppHeader.vue'; 
import HomePage from './components/HomePage.vue';

export default {
    name: 'App',
    components: {
        AppHeader,
        HomePage
    }
}
</script>

<style>
/* Your styles here */
</style>
