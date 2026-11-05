<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuthStore } from '@/stores/auth'
import { useDatosAlumnoMnpStore } from '@/stores/datosAlumnoMnp'
import { conciliarRetencionAlumno } from '@/composables/useConciliarRetencion'
import { emitirRetencionAudit } from '@/services/retencionAuditLog'

const router = useRouter()
const auth = useAuthStore()
const datosMnp = useDatosAlumnoMnpStore()

const cargando = ref(true)
const error = ref('')

onMounted(async () => {
  emitirRetencionAudit({ accion: 'retomar' })
  const codcli = (datosMnp.primeraFila?.codcli ?? '').trim()
  const rut = (datosMnp.primeraFila?.rut ?? auth.username ?? '').trim()
  if (!codcli || !rut) {
    error.value = 'No encontramos tu ficha de rematrícula. Inicia sesión de nuevo.'
    cargando.value = false
    return
  }
  const r = await conciliarRetencionAlumno({ rut, codcli })
  if (!r.ok && !r.ruta) {
    error.value = 'No pudimos recuperar tu avance. Reintenta en unos minutos.'
    cargando.value = false
    return
  }
  if (r.ruta) {
    await router.replace({ name: r.ruta })
    return
  }
  await router.replace({ name: 'dashboard-home' })
})
</script>

<template>
  <div class="mx-auto flex min-h-[50vh] max-w-lg items-center justify-center p-6">
    <Card class="w-full border-orange-100 shadow-lg">
      <CardContent class="space-y-4 py-10 text-center">
        <Loader2 v-if="cargando" class="mx-auto h-8 w-8 animate-spin text-[#FF5B00]" aria-hidden="true" />
        <p v-if="cargando" class="text-zinc-600">Te estamos llevando al paso pendiente…</p>
        <template v-else-if="error">
          <p class="text-zinc-800">{{ error }}</p>
          <Button
            type="button"
            class="cursor-pointer rounded-full bg-[#FF5B00] hover:bg-[#FF5B00]/90"
            @click="$router.push({ name: 'dashboard-home' })"
          >
            Ir al inicio
          </Button>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
