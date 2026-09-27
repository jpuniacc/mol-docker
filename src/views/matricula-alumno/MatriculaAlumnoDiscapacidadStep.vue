<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Check, Info } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useAlumnoRematriculaFuente } from '@/composables/useAlumnoRematriculaFuente'
import {
  DISCAPACIDAD_AFIRMACIONES,
  DISCAPACIDAD_ENCUESTA_UI,
  DISCAPACIDAD_TIPOS,
} from '@/constants/discapacidadEncuesta'
import { actualizarDiscapacidadMolErp } from '@/services/actualizarDiscapacidadMolApi'
import { codcliMtClientDesdeRut } from '@/services/alumnoDeudaNetApi'
import { contextoMolAuditoria } from '@/services/molAuditContext'
import { guardarDiscapacidadEncuesta } from '@/services/discapacidadEncuesta'
import { useMatriculaAlumnoContextStore } from '@/stores/matriculaAlumnoContext'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'

const ui = DISCAPACIDAD_ENCUESTA_UI

const router = useRouter()
const alumnoCtx = useMatriculaAlumnoContextStore()
const periodoActivo = usePeriodoActivoStore()
const fuente = useAlumnoRematriculaFuente()

const quiereContestar = ref<boolean | null>(null)
const tipoDiscapacidad = ref<string | null>(null)
const afirmaciones = ref<string[]>([])
const guardando = ref(false)
const dialogOmitirAbierto = ref(false)

const tipos = DISCAPACIDAD_TIPOS
const afirmacionesOpciones = DISCAPACIDAD_AFIRMACIONES

const puedeGuardar = () => quiereContestar.value === true && !!tipoDiscapacidad.value && !guardando.value

onMounted(() => {
  void periodoActivo.ensureLoaded()
})

function pickCampoAlumno(val: string): string | null {
  const t = val.trim()
  if (!t || t === '—') return null
  return t
}

function contextoEncuesta() {
  return contextoMolAuditoria({
    rutAlumno: pickCampoAlumno(fuente.rutMostrado.value),
    codcli: pickCampoAlumno(fuente.codcliMostrado.value),
    nombreAlumno: pickCampoAlumno(fuente.nombreMostrado.value),
    anioPeriodo: periodoActivo.anio,
    semestrePeriodo: periodoActivo.semestre,
    esMock: false,
  })
}

async function persistirEncuesta(payload: {
  contesta: boolean
  tipo: string | null
  afirmaciones: string[]
}): Promise<boolean> {
  const ctx = contextoEncuesta()
  const err = await guardarDiscapacidadEncuesta({
    contesta: payload.contesta,
    tipoDiscapacidad: payload.tipo,
    afirmaciones: payload.afirmaciones,
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
    console.warn('[discapacidadEncuesta]', err)
    return false
  }
  return true
}

function toggleAfirmacion(label: string, checked: boolean) {
  if (label === 'Ninguna de las anteriores' && checked) {
    afirmaciones.value = [label]
    return
  }
  afirmaciones.value = afirmaciones.value.filter((a) => a !== 'Ninguna de las anteriores')
  if (checked) {
    if (!afirmaciones.value.includes(label)) afirmaciones.value.push(label)
  } else {
    afirmaciones.value = afirmaciones.value.filter((a) => a !== label)
  }
}

function seleccionarContestar() {
  if (guardando.value) return
  quiereContestar.value = true
}

function solicitarOmitir() {
  if (guardando.value) return
  dialogOmitirAbierto.value = true
}

async function omitir() {
  if (guardando.value) return
  guardando.value = true
  try {
    if (!(await persistirEncuesta({ contesta: false, tipo: null, afirmaciones: [] }))) {
      toast.error('No se pudo guardar la encuesta. Intenta de nuevo.')
      return
    }
    alumnoCtx.setDiscapacidad({ contesta: false, tipo: null, afirmaciones: [] })
    void router.push({ name: 'matricula-alumno-forma-pago' })
  } finally {
    guardando.value = false
  }
}

async function confirmarOmitir() {
  dialogOmitirAbierto.value = false
  await omitir()
}

async function guardar() {
  if (guardando.value) return
  if (quiereContestar.value !== true) {
    solicitarOmitir()
    return
  }
  if (!tipoDiscapacidad.value) {
    toast.error('Selecciona el tipo de discapacidad.')
    return
  }
  guardando.value = true
  try {
    const respuesta = {
      contesta: true as const,
      tipo: tipoDiscapacidad.value,
      afirmaciones: [...afirmaciones.value],
    }
    if (!(await persistirEncuesta(respuesta))) {
      toast.error('No se pudo guardar la encuesta. Intenta de nuevo.')
      return
    }
    alumnoCtx.setDiscapacidad(respuesta)
    toast.message('Encuesta guardada (mock). En producción se alertaría al CRM institucional.')
    const rut = pickCampoAlumno(fuente.rutMostrado.value)
    const codcliErp = rut ? codcliMtClientDesdeRut(rut) : ''
    if (codcliErp && respuesta.tipo) {
      void actualizarDiscapacidadMolErp({
        codcli: codcliErp,
        discapacidad: respuesta.tipo,
      }).then((r) => {
        if (!r.ok) console.warn('[discapacidadErp]', r.error ?? r.message)
      })
    }
    void router.push({ name: 'matricula-alumno-forma-pago' })
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <Alert
      variant="default"
      class="border-uniacc-orange/40 bg-uniacc-orange/10 text-zinc-900 shadow-sm ring-1 ring-uniacc-orange/15 dark:border-uniacc-orange/45 dark:bg-uniacc-orange/15 dark:text-zinc-50 dark:ring-uniacc-orange/25 [&>svg]:text-uniacc-orange"
    >
      <Info class="h-5 w-5 shrink-0" aria-hidden="true" />
      <AlertTitle class="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        {{ ui.alertTitle }}
      </AlertTitle>
      <AlertDescription class="mt-2 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
        {{ ui.alertDescription }}
      </AlertDescription>
    </Alert>

    <Card class="shadow-md">
      <CardHeader>
        <div class="flex flex-wrap items-center gap-2">
          <CardTitle>{{ ui.cardTitle }}</CardTitle>
          <Badge variant="outline">{{ ui.badgeOpcional }}</Badge>
        </div>
        <CardDescription>{{ ui.cardDescription }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-6">
        <div
          class="grid gap-3 sm:grid-cols-2"
          role="radiogroup"
          aria-label="¿Deseas contestar la encuesta?"
        >
          <button
            type="button"
            role="radio"
            :aria-checked="quiereContestar === true"
            :disabled="guardando"
            class="flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uniacc-orange focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            :class="
              quiereContestar === true
                ? 'border-uniacc-orange bg-uniacc-orange/5 ring-1 ring-uniacc-orange/30'
                : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/80'
            "
            @click="seleccionarContestar"
          >
            <span class="font-medium text-foreground">{{ ui.opcionContestar }}</span>
            <span class="text-sm text-muted-foreground">{{ ui.opcionContestarHint }}</span>
          </button>

          <button
            type="button"
            role="radio"
            :aria-checked="false"
            :disabled="guardando"
            class="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-4 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uniacc-orange focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            @click="solicitarOmitir"
          >
            <span class="font-medium text-foreground">{{ ui.opcionOmitir }}</span>
            <span class="text-sm text-muted-foreground">{{ ui.opcionOmitirHint }}</span>
          </button>
        </div>

        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 -translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <div v-if="quiereContestar === true" class="space-y-4 border-t border-zinc-200 pt-6">
            <p class="rounded-lg border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm leading-relaxed text-zinc-700">
              {{ ui.avisoIndependencia }}
            </p>

            <section
              class="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4"
              aria-labelledby="discapacidad-pregunta-1"
            >
              <div class="space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 id="discapacidad-pregunta-1" class="text-base font-semibold text-foreground">
                    {{ ui.pregunta1Titulo }}
                  </h3>
                  <Badge>{{ ui.pregunta1Badge }}</Badge>
                </div>
                <p class="text-sm text-muted-foreground">{{ ui.pregunta1Subtitulo }}</p>
              </div>

              <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <button
                  v-for="t in tipos"
                  :key="t"
                  type="button"
                  :disabled="guardando"
                  class="relative flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uniacc-orange focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  :class="
                    tipoDiscapacidad === t
                      ? 'border-uniacc-orange bg-uniacc-orange/10 text-foreground ring-1 ring-uniacc-orange/40'
                      : 'border-zinc-200 bg-white text-foreground hover:border-zinc-300 hover:bg-zinc-50'
                  "
                  :aria-pressed="tipoDiscapacidad === t"
                  @click="tipoDiscapacidad = t"
                >
                  <Check
                    v-if="tipoDiscapacidad === t"
                    class="h-4 w-4 shrink-0 text-uniacc-orange"
                    aria-hidden="true"
                  />
                  {{ t }}
                </button>
              </div>
            </section>

            <section
              class="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4"
              aria-labelledby="discapacidad-pregunta-2"
            >
              <div class="space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 id="discapacidad-pregunta-2" class="text-base font-semibold text-foreground">
                    {{ ui.pregunta2Titulo }}
                  </h3>
                  <Badge variant="outline">{{ ui.pregunta2Badge }}</Badge>
                </div>
                <p class="text-sm text-muted-foreground">{{ ui.pregunta2Subtitulo }}</p>
              </div>

              <div class="space-y-2">
                <label
                  v-for="a in afirmacionesOpciones"
                  :key="a"
                  :for="`af-${a}`"
                  class="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3 transition-colors hover:border-zinc-300 hover:bg-zinc-50/50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
                >
                  <Checkbox
                    :id="`af-${a}`"
                    class="mt-0.5"
                    :checked="afirmaciones.includes(a)"
                    :disabled="guardando"
                    @update:checked="(v: boolean) => toggleAfirmacion(a, v)"
                  />
                  <span class="text-sm font-normal leading-snug text-foreground">{{ a }}</span>
                </label>
              </div>
            </section>

            <div class="space-y-2 pt-2">
              <Button
                type="button"
                class="w-full bg-uniacc-orange hover:bg-uniacc-orange/90 sm:w-auto"
                :disabled="!puedeGuardar()"
                @click="guardar"
              >
                {{ guardando ? ui.ctaGuardando : ui.ctaGuardar }}
              </Button>
              <p class="text-xs text-muted-foreground">{{ ui.ctaAyuda }}</p>
            </div>
          </div>
        </Transition>
      </CardContent>
    </Card>

    <AlertDialog v-model:open="dialogOmitirAbierto">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ ui.confirmOmitirTitle }}</AlertDialogTitle>
          <AlertDialogDescription>{{ ui.confirmOmitirMessage }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="guardando">{{ ui.confirmOmitirCancel }}</AlertDialogCancel>
          <AlertDialogAction
            class="bg-uniacc-orange hover:bg-uniacc-orange/90"
            :disabled="guardando"
            @click.prevent="confirmarOmitir"
          >
            {{ guardando ? ui.ctaGuardando : ui.confirmOmitirConfirm }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
