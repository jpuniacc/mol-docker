<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { mostrarErrorRematricula } from '@/stores/errorRematricula'
import { RefreshCw, Save } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { MENSAJE_PROXIMAMENTE_INICIAL } from '@/constants/proximamente'
import { useProximamenteStore } from '@/stores/proximamente'
import { mensajeProximamenteGuardable } from '@/utils/proximamenteGate'

const store = useProximamenteStore()
const { config, loading, saving, error } = storeToRefs(store)

const activoDraft = ref(false)
const mensajeDraft = ref(MENSAJE_PROXIMAMENTE_INICIAL)

const ultimaActualizacion = computed(() => {
  const iso = config.value?.actualizado_en
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('es-CL', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
})

function syncDraftFromStore() {
  activoDraft.value = store.config?.activo === true
  const mensaje = store.mensajeVisible
  mensajeDraft.value = mensaje || MENSAJE_PROXIMAMENTE_INICIAL
}

watch(config, () => syncDraftFromStore())

async function recargar() {
  await store.fetch()
  syncDraftFromStore()
}

async function guardar() {
  if (!mensajeProximamenteGuardable(mensajeDraft.value)) {
    mostrarErrorRematricula('Escribe un mensaje.')
    return
  }
  const ok = await store.save({
    activo: activoDraft.value,
    mensaje: mensajeDraft.value,
  })
  if (ok) {
    toast.success(activoDraft.value ? 'Próximamente quedó prendido.' : 'Próximamente quedó apagado.')
    syncDraftFromStore()
  } else {
    mostrarErrorRematricula(store.error ?? 'No se pudo guardar.')
  }
}

onMounted(() => {
  void recargar()
})
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <Card class="border-zinc-200 shadow-sm">
      <CardHeader class="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle class="text-xl text-zinc-900">Próximamente</CardTitle>
          <CardDescription class="text-zinc-600">
            Prende la pantalla de entrada y edita el mensaje. El saludo Hola no cambia.
            Última actualización:
            <span class="font-semibold text-zinc-900">{{ ultimaActualizacion }}</span>
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          class="cursor-pointer gap-1.5"
          :disabled="loading || saving"
          @click="recargar"
        >
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
          Actualizar
        </Button>
      </CardHeader>
      <CardContent class="space-y-6">
        <p v-if="error && !config" class="text-sm text-red-700" role="alert">{{ error }}</p>

        <div class="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 px-4 py-3">
          <div>
            <Label for="proximamente-activo" class="text-zinc-900">Pantalla prendida</Label>
            <p class="text-sm text-zinc-600">
              {{ activoDraft ? 'Quien entra ve Próximamente.' : 'Quien entra ve el login de MOL.' }}
            </p>
          </div>
          <Switch
            id="proximamente-activo"
            :checked="activoDraft"
            :disabled="loading || saving"
            aria-label="Prender o apagar Próximamente"
            @update:checked="(v: boolean) => (activoDraft = v)"
          />
        </div>

        <div class="space-y-2">
          <Label for="proximamente-mensaje" class="text-zinc-900">Mensaje</Label>
          <Textarea
            id="proximamente-mensaje"
            v-model="mensajeDraft"
            rows="5"
            :disabled="loading || saving"
            class="min-h-32 resize-y border-zinc-300 focus-visible:ring-uniacc-orange"
          />
        </div>

        <Button
          type="button"
          class="cursor-pointer gap-1.5 bg-uniacc-orange text-white hover:bg-uniacc-orange/90"
          :disabled="loading || saving"
          @click="guardar"
        >
          <Save class="h-4 w-4" />
          {{ saving ? 'Guardando…' : 'Guardar' }}
        </Button>
      </CardContent>
    </Card>
  </div>
</template>
