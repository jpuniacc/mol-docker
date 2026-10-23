<script setup lang="ts">
import { computed } from 'vue'

import {
  TEXTO_ENLACE_PORTAL_SOLICITUDES,
  URL_PORTAL_SOLICITUDES,
} from '@/constants/carteraOficial'

const props = defineProps<{ texto: string }>()

const partes = computed(() => {
  const marca = TEXTO_ENLACE_PORTAL_SOLICITUDES
  const indice = props.texto.indexOf(marca)
  if (indice < 0) return { antes: props.texto, enlace: '', despues: '' }
  return {
    antes: props.texto.slice(0, indice),
    enlace: marca,
    despues: props.texto.slice(indice + marca.length),
  }
})
</script>

<template>
  <span>
    {{ partes.antes }}<a
      v-if="partes.enlace"
      :href="URL_PORTAL_SOLICITUDES"
      class="cursor-pointer font-bold text-[#D91B7A] underline underline-offset-2 hover:text-[#D91B7A]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D91B7A]"
      target="_blank"
      rel="noopener noreferrer"
    >{{ partes.enlace }}</a>{{ partes.despues }}
  </span>
</template>
