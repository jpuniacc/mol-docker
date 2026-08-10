<script setup lang="ts">
import { useErrorStore } from './stores/error'
import { onErrorCaptured } from 'vue'

import 'vue-sonner/style.css'
import Toaster from '@/components/ui/toast/Toaster.vue'
import { Toaster as Sonner } from 'vue-sonner'

onErrorCaptured((error) => {
  useErrorStore().setError({ error })
})
</script>

<template>
  <div class="min-h-svh bg-zinc-100">
    <Toaster />
    <Sonner position="top-center" expand richColors />

    <RouterView v-slot="{ Component, route }">
      <Transition name="fade" mode="out-in">
        <div :key="route.fullPath" class="min-h-svh">
          <component :is="Component" />
        </div>
      </Transition>
    </RouterView>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
