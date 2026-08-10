<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'

import RichTextContent from '@/components/rich-text/RichTextContent.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  TYC_RECHAZO_SONNER_CANCELAR,
  TYC_RECHAZO_SONNER_CONFIRMAR,
  TYC_RECHAZO_SONNER_MENSAJE,
} from '@/constants/terminosCondicionesMol'
import { useMockAlumnoFuente } from '@/composables/useMockAlumnoFuente'
import { contextoMolAuditoria } from '@/services/molAuditContext'
import { registrarLogTyCRespuesta, type TyCAccionLog } from '@/services/tycAuditLog'
import { useAuthStore } from '@/stores/auth'
import { useMockMatriculaContextStore } from '@/stores/mockMatriculaContext'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import { useTerminosCondicionesStore } from '@/stores/terminosCondiciones'

const emit = defineEmits<{
  aceptado: []
}>()

const router = useRouter()
const auth = useAuthStore()
const mockCtx = useMockMatriculaContextStore()
const tycStore = useTerminosCondicionesStore()
const periodoActivo = usePeriodoActivoStore()
const fuente = useMockAlumnoFuente()
const { loading, error, disponible, documento } = storeToRefs(tycStore)

const registrando = ref(false)

const titulo = computed(() => tycStore.tituloDisplay ?? 'Términos y condiciones')
const contenido = computed(() => tycStore.contenidoHtml)

const puedeAceptar = computed(() => disponible.value && !loading.value && !registrando.value)

onMounted(() => {
  void Promise.all([tycStore.ensureLoaded(), periodoActivo.ensureLoaded()])
})

function pickCampoAlumno(val: string): string | null {
  const t = val.trim()
  if (!t || t === '—') return null
  return t
}

async function registrarAccionTyC(accion: TyCAccionLog): Promise<boolean> {
  const doc = documento.value
  if (!doc?.updated_at || !doc.titulo?.trim()) {
    console.warn('[tycAudit] Sin documento TyC cargado; no se registra log.')
    return false
  }

  const ctx = contextoMolAuditoria({
    rutAlumno: pickCampoAlumno(fuente.rutMostrado.value),
    codcli: pickCampoAlumno(fuente.codcliMostrado.value),
    nombreAlumno: pickCampoAlumno(fuente.nombreMostrado.value),
    anioPeriodo: periodoActivo.anio,
    semestrePeriodo: periodoActivo.semestre,
    esMock: mockCtx.tieneAlumnoSeleccionado,
  })

  const err = await registrarLogTyCRespuesta({
    accion,
    tycUpdatedAt: doc.updated_at,
    tycTitulo: doc.titulo.trim(),
    rutAlumno: ctx.rutAlumno,
    codcli: ctx.codcli,
    nombreAlumno: ctx.nombreAlumno,
    anioPeriodo: ctx.anioPeriodo,
    semestrePeriodo: ctx.semestrePeriodo,
    periodoLabel: ctx.periodoLabel,
    esMock: ctx.esMock,
    sesionId: ctx.sesionId,
    urlOrigen: ctx.urlOrigen,
  })

  if (err) {
    console.warn('[tycAudit]', err)
    toast.error('No se pudo registrar la respuesta de TyC en auditoría.')
    return false
  }
  return true
}

async function aceptar() {
  if (!puedeAceptar.value) return
  registrando.value = true
  try {
    await registrarAccionTyC('acepta')
    mockCtx.acceptTyc()
    emit('aceptado')
  } finally {
    registrando.value = false
  }
}

async function confirmarRechazo() {
  if (registrando.value) return
  registrando.value = true
  try {
    await registrarAccionTyC('rechaza')
    mockCtx.rejectTyc()
    mockCtx.clearAlumno()
    auth.logout()
    await router.replace({ name: 'login', query: { tycRechazado: '1' } })
  } finally {
    registrando.value = false
  }
}

function solicitarRechazo() {
  if (registrando.value) return
  toast.warning(TYC_RECHAZO_SONNER_MENSAJE, {
    duration: Infinity,
    action: {
      label: TYC_RECHAZO_SONNER_CONFIRMAR,
      onClick: () => {
        void confirmarRechazo()
      },
    },
    cancel: {
      label: TYC_RECHAZO_SONNER_CANCELAR,
    },
  })
}
</script>

<template>
  <div class="space-y-6">
    <p class="text-muted-foreground">
      Vista 02 — Debes leer y aceptar los términos y condiciones para continuar con la rematrícula en línea.
    </p>

    <Card class="shadow-md">
      <CardHeader>
        <CardTitle>{{ titulo }}</CardTitle>
        <CardDescription>
          UNIACC – Universidad de Artes, Ciencias y Comunicación · DVU – Dirección Vida Universitaria
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div
          v-if="loading"
          class="max-h-[min(28rem,60vh)] rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-muted-foreground"
        >
          Cargando términos y condiciones…
        </div>

        <div
          v-else-if="!disponible"
          class="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          <p class="font-medium">Términos y condiciones no disponibles</p>
          <p v-if="error" class="mt-1">{{ error }}</p>
          <p v-else class="mt-1">
            El documento no está configurado. Un administrador DVU/TI debe cargarlo en Mantenedores →
            Términos y condiciones.
          </p>
        </div>

        <div
          v-else
          class="max-h-[min(28rem,60vh)] overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-4"
        >
          <RichTextContent :html="contenido" />
        </div>

        <div class="flex flex-wrap gap-3">
          <Button
            type="button"
            class="bg-uniacc-orange hover:bg-uniacc-orange/90"
            :disabled="!puedeAceptar"
            @click="aceptar"
          >
            {{ registrando ? 'Registrando…' : 'Acepto términos y condiciones' }}
          </Button>
          <Button type="button" variant="outline" :disabled="registrando" @click="solicitarRechazo">
            No acepto
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
