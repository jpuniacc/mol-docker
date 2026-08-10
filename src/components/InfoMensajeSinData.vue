<script setup lang="ts">
import { Construction, ListX } from 'lucide-vue-next' // iconos

const iconos = {
  mantencion: Construction,
  vacio: ListX,
}

defineProps<{
  icono: 'mantencion' | 'vacio'
  mensaje: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center space-y-2 py-8">
    <component :is="iconos[icono]" :size="32" class="text-gray-500" />
    <p class="text-muted-foreground">{{ mensaje }}</p>
  </div>
</template>
