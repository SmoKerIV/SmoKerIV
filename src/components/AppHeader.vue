/* eslint-disable */
<template>
  <div className="flex items-center justify-between p-4">
    <div className="text-2xl font-bold">
      <h1>Logo</h1>
    </div>
    <div className="flex items-center justify-between ">
        <ul className="flex items-center justify-between gap-4">
            <li>Home</li>
            <li>About</li>
            <li>Contact</li>
        </ul>
    </div>
  </div>
</template>
<script>
export default {
  name: "AppHeader",
  data() {
    return {
      title: "Header",
    };
  },
};
</script>
<style scoped>

</style>
