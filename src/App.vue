<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <RouterLink class="brand" to="/">
        <span>拼豆工坊</span>
        <small>PIN DOU STUDIO</small>
      </RouterLink>
      <nav aria-label="主导航">
        <RouterLink to="/">首页</RouterLink>
        <RouterLink to="/editor">图纸编辑器</RouterLink>
      </nav>
    </header>
    <main>
      <RouterView />
    </main>
  </div>
</template>
