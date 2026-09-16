<script setup lang="ts">
import { computed, ref } from 'vue'
import { Clock, FileUp, Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CONVENIO_DOC_ACCEPT,
  subirDocumentoConvenio,
} from '@/services/convenioDocumento'
import type { ContextoMolAuditoriaOpciones } from '@/services/molAuditContext'
import type { MockConvenioDocumento } from '@/stores/mockMatriculaContext'
import {
  textoTipoCertificado,
  type CertificadoRequerido,
} from '@/utils/convenioCertificado'

const props = defineProps<{
  certificado: CertificadoRequerido
  convenioId: string
  documento: MockConvenioDocumento | null
  contexto: ContextoMolAuditoriaOpciones
  enRevision: boolean
  motivoRechazo: string | null
}>()

const emit = defineEmits<{
  subido: [
    payload: {
      codigoBeneficio: string
      convenioId: string
      doc: MockConvenioDocumento
      documentoId: string | null
    },
  ]
}>()

const inputEl = ref<HTMLInputElement | null>(null)
const archivoSeleccionado = ref<File | null>(null)
const subiendo = ref(false)
const error = ref<string | null>(null)

const tipoLabel = computed(() => textoTipoCertificado(props.certificado.tipoCertificado))

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
      convenioId: props.convenioId,
      codigoBeneficio: props.certificado.codigoBeneficio,
      codBeneficioAlumno: props.certificado.codigoBeneficio,
      estadoConvenio: 'VIGENTE',
    })
    if (res.error || !res.storagePath) {
      error.value = res.error ?? 'No se pudo subir el documento.'
      toast.error(error.value)
      return
    }
    emit('subido', {
      codigoBeneficio: props.certificado.codigoBeneficio,
      convenioId: props.convenioId,
      documentoId: res.id,
      doc: {
        storagePath: res.storagePath,
        nombreArchivo: archivoSeleccionado.value.name,
      },
    })
    toast.success('Documento enviado a revisión.')
    archivoSeleccionado.value = null
    if (inputEl.value) inputEl.value.value = ''
  } finally {
    subiendo.value = false
  }
}
</script>

<template>
  <div class="rounded-lg border border-uniacc-orange/30 bg-white p-4 shadow-sm">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p class="font-semibold text-zinc-800">{{ certificado.beneficio }}</p>
        <p class="text-sm text-muted-foreground">
          Código {{ certificado.codigoBeneficio }} · {{ tipoLabel }}
        </p>
      </div>
      <Badge variant="outline">{{ enRevision ? 'En revisión' : 'Requiere certificado' }}</Badge>
    </div>

    <div
      v-if="enRevision"
      class="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      <Clock class="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p>Tu {{ tipoLabel }} está en revisión. Un consejero debe aceptarlo para continuar.</p>
        <p v-if="documento" class="mt-1 text-xs">Archivo: {{ documento.nombreArchivo }}</p>
      </div>
    </div>

    <div v-else class="mt-3 space-y-2">
      <p v-if="motivoRechazo" class="text-sm text-red-700">
        Rechazado: {{ motivoRechazo }}. Sube un nuevo documento.
      </p>
      <p v-else class="text-sm text-zinc-700">
        Sube el {{ tipoLabel }} (PDF, PNG o JPG, máx. 10 MB).
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
          {{ subiendo ? 'Subiendo…' : 'Subir certificado' }}
        </Button>
      </div>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    </div>
  </div>
</template>
