<script setup lang="ts">
import { ref } from 'vue'
import { FileUp, Loader2, Trash2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ConvenioAlumnoMatch } from '@/services/convenioAlumno'
import {
  CONVENIO_DOC_ACCEPT,
  eliminarDocumentoConvenio,
  subirDocumentoConvenio,
} from '@/services/convenioDocumento'
import type { ContextoMolAuditoriaOpciones } from '@/services/molAuditContext'
import type { MockConvenioDocumento } from '@/stores/mockMatriculaContext'
import type { MnpCasoRematriculaEstado } from '@/types/supabase'

const props = defineProps<{
  match: ConvenioAlumnoMatch
  documento: MockConvenioDocumento | null
  contexto: ContextoMolAuditoriaOpciones
  /** Estado del caso CONVENIO_CERTIFICADO (badge UI en Task 3). */
  estadoCaso?: MnpCasoRematriculaEstado | null
  /** Motivo de rechazo del caso, si aplica (badge UI en Task 3). */
  motivoRechazo?: string | null
}>()

const emit = defineEmits<{
  subido: [payload: { convenioId: string; doc: MockConvenioDocumento; documentoId?: string | null }]
  eliminado: [payload: { convenioId: string }]
}>()

const inputEl = ref<HTMLInputElement | null>(null)
const archivoSeleccionado = ref<File | null>(null)
const subiendo = ref(false)
const eliminando = ref(false)
const error = ref<string | null>(null)

function onArchivoChange(event: Event) {
  error.value = null
  const target = event.target as HTMLInputElement
  archivoSeleccionado.value = target.files && target.files.length > 0 ? target.files[0] : null
}

async function subir() {
  if (!archivoSeleccionado.value) {
    error.value = 'Selecciona un archivo primero.'
    return
  }
  subiendo.value = true
  error.value = null
  try {
    const res = await subirDocumentoConvenio({
      ...props.contexto,
      file: archivoSeleccionado.value,
      convenioId: props.match.convenio.id,
      codigoBeneficio: props.match.convenio.codigo_beneficio,
      codBeneficioAlumno: props.match.codBeneficioAlumno,
      estadoConvenio: props.match.convenio.estado,
    })

    if (res.error || !res.storagePath) {
      error.value = res.error ?? 'No se pudo subir el documento.'
      toast.error(error.value)
      return
    }

    const doc: MockConvenioDocumento = {
      storagePath: res.storagePath,
      nombreArchivo: archivoSeleccionado.value.name,
    }
    emit('subido', {
      convenioId: props.match.convenio.id,
      doc,
      documentoId: res.id,
    })
    toast.success('Documento de vigencia subido correctamente.')
    archivoSeleccionado.value = null
    if (inputEl.value) inputEl.value.value = ''
  } finally {
    subiendo.value = false
  }
}

async function eliminar() {
  if (!props.documento || eliminando.value) return
  const confirmado = window.confirm(
    '¿Eliminar el documento subido? Deberás volver a cargarlo para continuar.',
  )
  if (!confirmado) return

  eliminando.value = true
  error.value = null
  try {
    const res = await eliminarDocumentoConvenio({
      ...props.contexto,
      storagePath: props.documento.storagePath,
    })

    if (!res.ok) {
      error.value = res.error ?? 'No se pudo eliminar el documento.'
      toast.error(error.value)
      return
    }

    emit('eliminado', { convenioId: props.match.convenio.id })
    toast.success('Documento eliminado. Puedes subir uno nuevo.')
  } finally {
    eliminando.value = false
  }
}
</script>

<template>
  <div class="rounded-lg border border-uniacc-orange/30 bg-white p-4 shadow-sm">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p class="font-semibold text-zinc-800">{{ match.convenio.institucion }}</p>
        <p class="text-sm text-muted-foreground">
          Beneficio: {{ match.descripcionBeneficio ?? match.codBeneficioAlumno }}
          <span v-if="match.convenio.codigo_beneficio" class="text-xs">
            (cód. {{ match.convenio.codigo_beneficio }})
          </span>
        </p>
      </div>
      <Badge :variant="match.esVigente ? 'default' : 'outline'">
        {{ match.esVigente ? 'Vigente' : match.convenio.estado }}
      </Badge>
    </div>

    <!-- Solo los vigentes requieren documento -->
    <template v-if="match.esVigente">
      <div v-if="documento" class="mt-3 space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <Badge v-if="estadoCaso === 'APROBADO'" class="bg-green-700">Aprobado</Badge>
            <Badge v-else-if="estadoCaso === 'RECHAZADO'" variant="destructive">Rechazado</Badge>
            <Badge v-else class="bg-amber-600">En revisión</Badge>
            <span class="text-zinc-700">{{ documento.nombreArchivo }}</span>
          </div>
          <Button
            v-if="estadoCaso !== 'APROBADO'"
            type="button"
            variant="outline"
            size="sm"
            class="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700"
            :disabled="eliminando"
            @click="eliminar"
          >
            <Loader2 v-if="eliminando" class="h-4 w-4 animate-spin" />
            <Trash2 v-else class="h-4 w-4" />
            {{ eliminando ? 'Eliminando…' : 'Eliminar' }}
          </Button>
        </div>
        <p v-if="estadoCaso === 'RECHAZADO'" class="text-sm text-red-700">
          {{ motivoRechazo?.trim() || 'Documento rechazado.' }}
          Vuelve a subir el documento.
        </p>
        <p v-else-if="estadoCaso === 'EN_REVISION' || !estadoCaso" class="text-sm text-amber-800">
          Documento enviado. En revisión por tu consejero.
        </p>
        <p v-if="documento && error && estadoCaso !== 'RECHAZADO'" class="mt-2 text-sm text-red-600">
          {{ error }}
        </p>
      </div>

      <div v-if="!documento || estadoCaso === 'RECHAZADO'" class="mt-3 space-y-2">
        <p class="text-sm text-zinc-700">
          Este convenio está vigente. Sube el documento que acredita que continúa vigente
          (PDF, PNG o JPG, máx. 10 MB).
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <input
            ref="inputEl"
            type="file"
            :accept="CONVENIO_DOC_ACCEPT"
            class="block w-full max-w-xs text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-uniacc-orange/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-uniacc-orange hover:file:bg-uniacc-orange/20"
            :disabled="subiendo"
            @change="onArchivoChange"
          />
          <Button
            type="button"
            class="bg-uniacc-orange hover:bg-uniacc-orange/90"
            :disabled="subiendo || !archivoSeleccionado"
            @click="subir"
          >
            <Loader2 v-if="subiendo" class="mr-2 h-4 w-4 animate-spin" />
            <FileUp v-else class="mr-2 h-4 w-4" />
            {{ subiendo ? 'Subiendo…' : 'Subir documento' }}
          </Button>
        </div>
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      </div>
    </template>

    <p v-else class="mt-3 text-sm text-muted-foreground">
      Convenio informativo (no requiere documento de vigencia).
    </p>
  </div>
</template>
