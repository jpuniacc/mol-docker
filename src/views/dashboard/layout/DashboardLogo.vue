<script setup lang="ts">
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
</script>

<template>
  <RouterLink to="/dashboard" class="transition-colors hover:text-primary">
    <p class="font-sans text-base font-bold tracking-tight">
      {{ appStore.appName }}
    </p>
  </RouterLink>
</template>
