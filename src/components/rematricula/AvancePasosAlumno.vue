<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CheckCircle2, Circle, CircleDot } from 'lucide-vue-next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useMatriculaAlumnoContextStore } from '@/stores/matriculaAlumnoContext'
import {
  accionAlElegirPasoHome,
  pasosAvanceHome,
  type AvanceHomeAlumnoInput,
  type EstadoPasoHome,
  type PasoAvanceHome,
} from '@/utils/pasoAlumnoRematricula'

const router = useRouter()
const alumnoCtx = useMatriculaAlumnoContextStore()

const avisoAbierto = ref(false)
const avisoTexto = ref('')

const entrada = computed((): AvanceHomeAlumnoInput => ({
  tycAccepted: alumnoCtx.tycAccepted,
  contactoCorreoValidado: alumnoCtx.contactoCorreoValidado,
  contactoTelefonoValidado: alumnoCtx.contactoTelefonoValidado,
  apoderadoConfirmado: alumnoCtx.apoderadoConfirmado,
  discapacidad: alumnoCtx.discapacidad,
  pasoAlcanzado: alumnoCtx.pasoAlcanzado,
  pagoMatricula: alumnoCtx.pagoMatricula,
  formaPagoSeleccionada: alumnoCtx.formaPagoSeleccionada,
  firmaCompletada: alumnoCtx.firmaCompletada,
  envioFirmaIniciado: alumnoCtx.envioFirmaIniciado,
  medioMatricula: alumnoCtx.medioMatricula,
  medioArancel: alumnoCtx.medioArancel,
  webpayMatriculaEstado: alumnoCtx.webpayMatriculaEstado,
  webpayArancelEstado: alumnoCtx.webpayArancelEstado,
}))

const pasos = computed(() => pasosAvanceHome(entrada.value))

const etiquetaEstado: Record<EstadoPasoHome, string> = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  listo: 'Listo',
}

const claseEstado: Record<EstadoPasoHome, string> = {
  pendiente: 'text-zinc-500',
  en_curso: 'text-uniacc-orange',
  listo: 'text-emerald-700',
}

function elegir(id: PasoAvanceHome['id']): void {
  const accion = accionAlElegirPasoHome(entrada.value, id)
  if (accion.tipo === 'navegar') {
    void router.push({ name: accion.routeName })
    return
  }
  avisoTexto.value = accion.texto
  avisoAbierto.value = true
}
</script>

<template>
  <div>
  <ol class="space-y-3">
    <li v-for="paso in pasos" :key="paso.id">
      <button
        type="button"
        class="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2.5 text-left transition-colors duration-200 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uniacc-orange"
        @click="elegir(paso.id)"
      >
        <CheckCircle2
          v-if="paso.estado === 'listo'"
          class="h-5 w-5 shrink-0 text-emerald-600"
          aria-hidden="true"
        />
        <CircleDot
          v-else-if="paso.estado === 'en_curso'"
          class="h-5 w-5 shrink-0 text-uniacc-orange"
          aria-hidden="true"
        />
        <Circle v-else class="h-5 w-5 shrink-0 text-zinc-300" aria-hidden="true" />
        <span
          :class="[
            'text-sm font-medium',
            paso.estado === 'pendiente' ? 'text-zinc-600' : 'text-zinc-900',
          ]"
        >
          {{ paso.label }}
        </span>
        <span class="ml-auto text-xs font-semibold" :class="claseEstado[paso.estado]">
          {{ etiquetaEstado[paso.estado] }}
        </span>
      </button>
    </li>
  </ol>

  <AlertDialog v-model:open="avisoAbierto">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Paso no disponible</AlertDialogTitle>
        <AlertDialogDescription class="text-left">
          {{ avisoTexto }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogAction class="bg-uniacc-orange hover:bg-uniacc-orange/90">
          Entendido
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  </div>
</template>
