<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Home } from 'lucide-vue-next'

const router = useRouter()

const volverAlInicio = () => {
  router.push({ name: 'dashboard-home' })
}
</script>

<template>
  <div class="flex min-h-svh flex-col items-center justify-center px-4">
    <div class="text-center">
      <h1 class="text-9xl font-bold text-gray-200">404</h1>
      <h2 class="mt-4 text-2xl font-semibold text-gray-800">Página no encontrada</h2>
      <p class="mt-2 text-gray-600">Lo sentimos, la página que buscas no existe.</p>
      <Button class="mt-6" @click="volverAlInicio">
        <Home class="mr-2 h-4 w-4" />
        Volver al inicio
      </Button>
    </div>
  </div>
</template>
