<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { ChevronDown, ChevronUp, RefreshCw, Save } from 'lucide-vue-next'

import RichTextContent from '@/components/rich-text/RichTextContent.vue'
import RichTextEditor from '@/components/rich-text/RichTextEditor.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TERMINOS_CONDICIONES_MOL_TITULO_DEFAULT } from '@/constants/terminosCondicionesMol'
import { useTerminosCondicionesStore } from '@/stores/terminosCondiciones'
import { isRichTextHtmlEmpty } from '@/utils/sanitizeRichTextHtml'

const store = useTerminosCondicionesStore()
const { documento, loading, saving, error } = storeToRefs(store)

const tituloDraft = ref('')
const contenidoDraft = ref('')
const previewOpen = ref(false)
const confirmSaveOpen = ref(false)

const ultimaActualizacion = computed(() => {
  const iso = documento.value?.updated_at
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    )
  } catch {
    return iso
  }
})

function syncDraftFromStore() {
  tituloDraft.value = documento.value?.titulo?.trim() || TERMINOS_CONDICIONES_MOL_TITULO_DEFAULT
  contenidoDraft.value = documento.value?.contenido_html ?? ''
}

watch(documento, () => syncDraftFromStore(), { immediate: true })

async function recargar() {
  await store.fetch()
  syncDraftFromStore()
}

function solicitarGuardar() {
  if (!tituloDraft.value.trim()) {
    toast.error('Ingresa un título para el documento.')
    return
  }
  if (isRichTextHtmlEmpty(contenidoDraft.value)) {
    toast.error('El contenido no puede estar vacío.')
    return
  }
  confirmSaveOpen.value = true
}

async function confirmarGuardar() {
  const ok = await store.save(tituloDraft.value, contenidoDraft.value)
  if (ok) {
    toast.success('Términos y condiciones actualizados.')
    confirmSaveOpen.value = false
  } else {
    toast.error(store.error ?? 'No se pudo guardar.')
  }
}

onMounted(() => {
  void recargar()
})
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <Card class="border-zinc-200 shadow-sm">
      <CardHeader class="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle class="text-xl text-zinc-900">Mantenedor de términos y condiciones</CardTitle>
          <CardDescription class="text-zinc-600">
            Documento único MOL (matrícula y rematrícula online). Editable por superadmin y admin de
            DVU o TI. Última actualización: {{ ultimaActualizacion }}
          </CardDescription>
        </div>
        <Button type="button" variant="outline" class="gap-1.5" :disabled="loading" @click="recargar">
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
          Recargar
        </Button>
      </CardHeader>
      <CardContent class="space-y-6">
        <p class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Los cambios aplican de inmediato para todos los alumnos que inicien el flujo de
          rematrícula en línea.
        </p>

        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        <p v-if="loading && !documento" class="text-sm text-muted-foreground">Cargando documento…</p>

        <template v-else>
          <div class="space-y-2">
            <Label for="tyc-titulo">Título del documento</Label>
            <Input id="tyc-titulo" v-model="tituloDraft" :disabled="saving" />
          </div>

          <div class="space-y-2">
            <Label>Contenido (texto enriquecido)</Label>
            <RichTextEditor v-model="contenidoDraft" />
          </div>

          <div class="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              class="gap-1.5"
              @click="previewOpen = !previewOpen"
            >
              <component :is="previewOpen ? ChevronUp : ChevronDown" class="h-4 w-4" />
              {{ previewOpen ? 'Ocultar vista previa' : 'Vista previa' }}
            </Button>
            <Button
              type="button"
              class="gap-1.5 bg-uniacc-orange hover:bg-uniacc-orange/90"
              :disabled="saving || loading"
              @click="solicitarGuardar"
            >
              <Save class="h-4 w-4" />
              {{ saving ? 'Guardando…' : 'Guardar cambios' }}
            </Button>
          </div>

          <div
            v-if="previewOpen"
            class="max-h-[min(28rem,60vh)] overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-4"
          >
            <h2 class="mb-4 text-lg font-semibold text-zinc-900">{{ tituloDraft }}</h2>
            <RichTextContent :html="contenidoDraft" />
          </div>
        </template>
      </CardContent>
    </Card>

    <Dialog :open="confirmSaveOpen" @update:open="(v: boolean) => (confirmSaveOpen = v)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar actualización</DialogTitle>
          <DialogDescription>
            ¿Publicar los cambios en términos y condiciones? El documento vigente será reemplazado
            de inmediato.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" @click="confirmSaveOpen = false">Cancelar</Button>
          <Button
            type="button"
            class="bg-uniacc-orange hover:bg-uniacc-orange/90"
            :disabled="saving"
            @click="confirmarGuardar"
          >
            Confirmar y guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
