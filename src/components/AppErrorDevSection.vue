<script setup lang="ts">
import { TriangleAlert } from 'lucide-vue-next' // iconos

defineProps<{
  message: string
  customCode: number
  code: string
  statusCode: number
  hint: string | null
  details: string
}>()
</script>

<template>
  <div>
    <TriangleAlert class="error__icon mx-auto" :size="70" />
    <h1 class="error__code">Error {{ customCode || code }}</h1>
    <p class="error__code" v-if="statusCode">Status code: {{ statusCode }}</p>
    <h1 class="error__msg">{{ message }}</h1>
    <h1>{{ hint }}</h1>
    <h1>{{ details }}</h1>
    <div class="error-footer">
      <p class="error-footer__text">
        Lo sentimos, algo salió mal. Pero este error quedó registrado en la base de datos para su
        posterior revision.
      </p>
      <RouterLink :to="{ name: 'dashboard' }">
        <Button class="max-w-36"> Volver al libro </Button>
      </RouterLink>
    </div>
  </div>
</template>
