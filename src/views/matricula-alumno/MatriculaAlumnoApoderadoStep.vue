<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AlertTriangle, Info } from 'lucide-vue-next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAlumnoRematriculaFuente } from '@/composables/useAlumnoRematriculaFuente'
import { abrirCasoRematricula, consultarCasosAlumno } from '@/services/casoRematriculaApi'
import { registrarApoderadoAudit } from '@/services/apoderadoAuditLog'
import { fetchPlanPagosMvByCodcli } from '@/services/fetchPlanPagosMv'
import { periodoCatalogoLabel } from '@/utils/periodoCatalogo'
import { contextoMolAuditoria } from '@/services/molAuditContext'
import { useMatriculaAlumnoContextStore } from '@/stores/matriculaAlumnoContext'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import type { PlanPagosMvRow } from '@/types/supabase'
import {
  mailApoderadoDisplay,
  nombreCompletoApoderado,
  telefonoApoderadoDisplay,
} from '@/utils/apoderadoResponsable'

const emit = defineEmits<{
  continuar: []
}>()

const alumnoCtx = useMatriculaAlumnoContextStore()
const periodoActivo = usePeriodoActivoStore()
const fuente = useAlumnoRematriculaFuente()

const procesando = ref(false)
const rehidratando = ref(false)

const planPagosRow = ref<PlanPagosMvRow | null>(null)

const nombreApoderado = computed(() =>
  planPagosRow.value ? nombreCompletoApoderado(planPagosRow.value) : pickCampoAlumno(fuente.nombreApoderadoMostrado.value) ?? 'Sin información',
)
const telefonoApoderado = computed(() =>
  planPagosRow.value ? telefonoApoderadoDisplay(planPagosRow.value) : 'Sin información',
)
const emailApoderado = computed(() =>
  planPagosRow.value ? mailApoderadoDisplay(planPagosRow.value) : 'Sin información',
)

const bloqueado = computed(() => alumnoCtx.apoderadoBloqueo === true)
const mostrarFichaAcciones = computed(() => !bloqueado.value)

async function rehidratarSiCasoResuelto(): Promise<void> {
  if (!alumnoCtx.apoderadoBloqueo || rehidratando.value) return
  const codcli = pickCampoAlumno(fuente.codcliMostrado.value)
  const anio = periodoActivo.anio
  const sem = periodoActivo.semestre
  if (!codcli || anio == null || sem == null) return

  rehidratando.value = true
  try {
    const periodo = periodoCatalogoLabel(anio, sem)
    const { data, error } = await consultarCasosAlumno(codcli, periodo)
    if (error) return
    const abierto = data.some(
      (c) =>
        c.tipo === 'APODERADO_DATOS' &&
        (c.estado === 'EN_REVISION' || c.estado === 'ABIERTO'),
    )
    if (abierto) return

    await cargarPlanPagosAlumno()
    alumnoCtx.confirmarApoderadoOk()
  } finally {
    rehidratando.value = false
  }
}

async function cargarPlanPagosAlumno(): Promise<void> {
  const codcli = pickCampoAlumno(fuente.codcliMostrado.value)
  const anio = periodoActivo.anio
  const sem = periodoActivo.semestre
  if (!codcli || anio == null || sem == null) return
  const { data: planRow } = await fetchPlanPagosMvByCodcli({
    codcli,
    anioMatricula: anio,
    periodoMatricula: sem,
  })
  if (planRow) planPagosRow.value = planRow
}

onMounted(() => {
  void periodoActivo.ensureLoaded().then(async () => {
    await cargarPlanPagosAlumno()
    void rehidratarSiCasoResuelto()
  })
})

function pickCampoAlumno(val: string): string | null {
  const t = val.trim()
  if (!t || t === '—') return null
  return t
}

function contextoAudit() {
  return contextoMolAuditoria({
    rutAlumno: pickCampoAlumno(fuente.rutMostrado.value),
    codcli: pickCampoAlumno(fuente.codcliMostrado.value),
    nombreAlumno: pickCampoAlumno(fuente.nombreMostrado.value),
    anioPeriodo: periodoActivo.anio,
    semestrePeriodo: periodoActivo.semestre,
    esMock: false,
  })
}

async function confirmarOk(): Promise<void> {
  if (procesando.value || bloqueado.value) return
  procesando.value = true
  try {
    const ctx = contextoAudit()
    await registrarApoderadoAudit({
      accion: 'confirma_ok',
      rutAlumno: ctx.rutAlumno,
      codcli: ctx.codcli,
      nombreAlumno: ctx.nombreAlumno,
      anioPeriodo: ctx.anioPeriodo,
      semestrePeriodo: ctx.semestrePeriodo,
      esMock: ctx.esMock,
      urlOrigen: ctx.urlOrigen,
      payload: {
        apoderadoNombre: nombreApoderado.value,
        apoderadoTelefono: telefonoApoderado.value,
        apoderadoEmail: emailApoderado.value,
      },
    })
    alumnoCtx.confirmarApoderadoOk()
    emit('continuar')
  } finally {
    procesando.value = false
  }
}

async function marcarDesactualizado(): Promise<void> {
  if (procesando.value || bloqueado.value) return
  procesando.value = true
  try {
    alumnoCtx.marcarApoderadoDesactualizado()
    const ctx = contextoAudit()
    const carrera =
      pickCampoAlumno(fuente.carreraMostrada.value) ||
      (planPagosRow.value?.carrera ?? planPagosRow.value?.nombre_carrera ?? '').trim() ||
      'Sin información'
    const jornada =
      pickCampoAlumno(fuente.jornadaMostrada.value) ||
      (planPagosRow.value?.jornada_carrera ?? '').trim() ||
      'Sin información'
    const anio = ctx.anioPeriodo
    const sem = ctx.semestrePeriodo
    if (ctx.codcli && anio != null && sem != null) {
      await abrirCasoRematricula({
        periodo: periodoCatalogoLabel(anio, sem),
        tipo: 'APODERADO_DATOS',
        estado: 'EN_REVISION',
        codcli: ctx.codcli,
        rutAlumno: ctx.rutAlumno,
        nombreAlumno: ctx.nombreAlumno,
        carrera,
        jornada,
        titulo: 'Datos de apoderado desactualizados',
        detalle: 'El alumno indicó que nombre, teléfono o email del apoderado no están vigentes.',
        refTipo: 'log_evento',
        esMock: ctx.esMock,
        payload: {
          apoderadoNombre: nombreApoderado.value,
          apoderadoTelefono: telefonoApoderado.value,
          apoderadoEmail: emailApoderado.value,
        },
      })
    }
    await registrarApoderadoAudit({
      accion: 'confirma_desactualizado',
      rutAlumno: ctx.rutAlumno,
      codcli: ctx.codcli,
      nombreAlumno: ctx.nombreAlumno,
      anioPeriodo: ctx.anioPeriodo,
      semestrePeriodo: ctx.semestrePeriodo,
      esMock: ctx.esMock,
      urlOrigen: ctx.urlOrigen,
      payload: {
        apoderadoNombre: nombreApoderado.value,
        apoderadoTelefono: telefonoApoderado.value,
        apoderadoEmail: emailApoderado.value,
      },
    })
  } finally {
    procesando.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <Alert
      v-if="bloqueado"
      variant="destructive"
      class="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/50 dark:bg-amber-950/30 dark:text-amber-50"
    >
      <AlertTriangle class="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
      <AlertTitle class="text-base font-semibold">Datos del apoderado desactualizados</AlertTitle>
      <AlertDescription class="mt-2 text-sm leading-relaxed">
        Debes comunicarte con tu consejero para actualizar los datos de tu apoderado. También
        informamos al área para gestionar la actualización.
        <span v-if="rehidratando" class="mt-2 block text-amber-800">Comprobando estado…</span>
      </AlertDescription>
    </Alert>

    <template v-if="mostrarFichaAcciones">
      <Alert
        variant="default"
        class="border-uniacc-orange/40 bg-uniacc-orange/10 text-zinc-900 shadow-sm ring-1 ring-uniacc-orange/15 dark:border-uniacc-orange/45 dark:bg-uniacc-orange/15 dark:text-zinc-50 dark:ring-uniacc-orange/25 [&>svg]:text-uniacc-orange"
      >
        <Info class="h-5 w-5 shrink-0" aria-hidden="true" />
        <AlertTitle class="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Confirmación de apoderado
        </AlertTitle>
        <AlertDescription class="mt-2 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
          Revisa que el nombre, teléfono y correo de tu apoderado / sostenedor sigan vigentes antes
          de continuar.
        </AlertDescription>
      </Alert>

      <Card class="shadow-md">
        <CardHeader>
          <CardTitle>Confirma los datos de tu apoderado / sostenedor</CardTitle>
          <CardDescription>
            Estos datos se usarán en el proceso de rematrícula. Si están incorrectos, no podrás
            continuar hasta actualizarlos con tu consejero.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <dl class="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 text-sm">
            <div class="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <dt class="font-medium text-muted-foreground">Nombre completo</dt>
              <dd class="text-foreground sm:text-right">{{ nombreApoderado }}</dd>
            </div>
            <div class="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <dt class="font-medium text-muted-foreground">Teléfono</dt>
              <dd class="text-foreground sm:text-right">{{ telefonoApoderado }}</dd>
            </div>
            <div class="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <dt class="font-medium text-muted-foreground">Email</dt>
              <dd class="text-foreground sm:text-right">{{ emailApoderado }}</dd>
            </div>
          </dl>

          <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              class="w-full bg-uniacc-orange hover:bg-uniacc-orange/90 sm:w-auto"
              :disabled="procesando"
              @click="confirmarOk"
            >
              {{ procesando ? 'Procesando…' : 'Sí, estos datos son correctos' }}
            </Button>
            <Button
              type="button"
              variant="outline"
              class="w-full sm:w-auto"
              :disabled="procesando"
              @click="marcarDesactualizado"
            >
              No, necesito actualizarlos
            </Button>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
