<script setup lang="ts">
import { computed, defineComponent, h, type PropType } from 'vue'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import TextoPortalSolicitudes from '@/components/rematricula/TextoPortalSolicitudes.vue'
import { useErrorRematriculaStore, type EscenaModal } from '@/stores/errorRematricula'

const store = useErrorRematriculaStore()

const mailtoAyuda = computed(() => {
  const correo = store.correoAyuda
  if (!correo) return null
  return `mailto:${correo}?subject=${encodeURIComponent(store.titulo)}`
})

function onOpenChange(abierto: boolean) {
  if (!abierto) store.cerrar()
}

function enfocarPrincipal(event: Event) {
  event.preventDefault()
  document.getElementById('modal-error-accion')?.focus()
}

function trazo(attrs: Record<string, string>) {
  return h('path', {
    fill: 'none',
    stroke: '#1E3A5F',
    'stroke-width': '3',
    'stroke-linecap': 'round',
    ...attrs,
  })
}

function dibujo(escena: EscenaModal) {
  if (escena === 'conexion') {
    return [
      h('circle', { cx: '78', cy: '50', r: '26', fill: '#fff', stroke: '#1E3A5F', 'stroke-width': '3' }),
      h('rect', {
        x: '62',
        y: '34',
        width: '32',
        height: '22',
        rx: '11',
        fill: '#DCEFF7',
        stroke: '#1E3A5F',
        'stroke-width': '3',
      }),
      h('circle', { cx: '72', cy: '45', r: '2.5', fill: '#1E3A5F' }),
      h('circle', { cx: '86', cy: '45', r: '2.5', fill: '#1E3A5F' }),
      trazo({ d: 'M70 54 q8-6 16 0' }),
      h('path', {
        d: 'M118 28c10 8 10 20 0 28',
        fill: 'none',
        stroke: '#3B9EC9',
        'stroke-width': '3',
        'stroke-linecap': 'round',
      }),
      h('path', {
        d: 'M126 20c16 12 16 32 0 44',
        fill: 'none',
        stroke: '#3B9EC9',
        'stroke-width': '3',
        'stroke-linecap': 'round',
      }),
      h('path', { d: 'M112 24l28 36', stroke: '#E8621A', 'stroke-width': '3', 'stroke-linecap': 'round' }),
    ]
  }
  if (escena === 'pago') {
    return [
      h('rect', {
        x: '34',
        y: '28',
        width: '92',
        height: '52',
        rx: '10',
        fill: '#fff',
        stroke: '#1E3A5F',
        'stroke-width': '3',
      }),
      h('rect', { x: '34', y: '40', width: '92', height: '12', fill: '#DCEFF7' }),
      h('circle', { cx: '108', cy: '64', r: '10', fill: '#D91B7A' }),
      h('path', {
        d: 'M103 64 l3 4 7-8',
        fill: 'none',
        stroke: '#fff',
        'stroke-width': '2.5',
        'stroke-linecap': 'round',
      }),
    ]
  }
  if (escena === 'firma') {
    return [
      h('rect', {
        x: '48',
        y: '18',
        width: '64',
        height: '68',
        rx: '6',
        fill: '#fff',
        stroke: '#1E3A5F',
        'stroke-width': '3',
      }),
      h('path', { d: 'M60 36h40M60 48h40M60 60h24', stroke: '#3B9EC9', 'stroke-width': '3', 'stroke-linecap': 'round' }),
      h('path', {
        d: 'M96 62c8 2 14 10 10 16',
        fill: 'none',
        stroke: '#E8621A',
        'stroke-width': '3',
        'stroke-linecap': 'round',
      }),
    ]
  }
  if (escena === 'datos') {
    return [
      h('rect', {
        x: '46',
        y: '16',
        width: '68',
        height: '70',
        rx: '8',
        fill: '#fff',
        stroke: '#1E3A5F',
        'stroke-width': '3',
      }),
      h('circle', { cx: '64', cy: '36', r: '6', fill: 'none', stroke: '#3B9EC9', 'stroke-width': '3' }),
      trazo({ d: 'M78 36h24' }),
      h('rect', {
        x: '58',
        y: '52',
        width: '12',
        height: '12',
        rx: '2',
        fill: 'none',
        stroke: '#D91B7A',
        'stroke-width': '3',
      }),
      trazo({ d: 'M78 58h24' }),
    ]
  }
  return [
    h('rect', {
      x: '58',
      y: '22',
      width: '46',
      height: '58',
      rx: '4',
      fill: '#fff',
      stroke: '#1E3A5F',
      'stroke-width': '3',
    }),
    h('circle', { cx: '92', cy: '52', r: '4', fill: '#D91B7A' }),
    h('path', {
      d: 'M46 30c-14 8-14 28 0 36',
      fill: 'none',
      stroke: '#3B9EC9',
      'stroke-width': '3',
      'stroke-linecap': 'round',
    }),
    h('path', { d: 'M40 24l22 28', stroke: '#E8621A', 'stroke-width': '3', 'stroke-linecap': 'round' }),
  ]
}

const EscenaIlustracion = defineComponent({
  name: 'EscenaIlustracion',
  props: {
    escena: { type: String as PropType<EscenaModal>, required: true },
  },
  setup(props) {
    return () =>
      h(
        'svg',
        {
          class: 'mx-auto h-24 w-40 motion-safe:animate-pulse',
          viewBox: '0 0 160 96',
          'aria-hidden': 'true',
        },
        dibujo(props.escena),
      )
  },
})
</script>

<template>
  <AlertDialog :open="store.abierto" @update:open="onOpenChange">
    <AlertDialogContent
      class="z-[90] gap-0 overflow-hidden p-0 sm:max-w-md"
      overlay-class="z-[90]"
      @open-auto-focus="enfocarPrincipal"
    >
      <div class="bg-[#fff7f2] px-6 pb-2 pt-6 text-center">
        <EscenaIlustracion :escena="store.escena" />
      </div>
      <AlertDialogHeader class="space-y-2 px-6 pb-2 pt-4 text-center sm:text-center">
        <p v-if="store.saludo" class="text-sm font-bold text-[#D91B7A]">{{ store.saludo }}</p>
        <AlertDialogTitle class="text-xl leading-snug text-[#1E3A5F]">
          {{ store.titulo }}
        </AlertDialogTitle>
        <AlertDialogDescription class="text-left text-sm leading-relaxed text-zinc-700">
          <TextoPortalSolicitudes :texto="store.cuerpo" />
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter class="flex-col gap-2 px-6 pb-6 sm:flex-col sm:space-x-0">
        <Button
          id="modal-error-accion"
          type="button"
          class="h-11 w-full cursor-pointer bg-[#D91B7A] text-white hover:bg-[#D91B7A]/90"
          @click="store.alPrincipal()"
        >
          {{ store.boton === 'entendido' ? 'Entendido' : 'Intentar de nuevo' }}
        </Button>
        <div v-if="store.mostrarEnlaces" class="flex flex-wrap justify-center gap-x-3 text-sm">
          <button
            type="button"
            class="cursor-pointer text-[#3B9EC9] underline-offset-2 hover:underline"
            @click="store.irAlInicio()"
          >
            Ir al inicio
          </button>
          <a
            v-if="mailtoAyuda"
            :href="mailtoAyuda"
            class="cursor-pointer text-[#3B9EC9] underline-offset-2 hover:underline"
          >
            Reportar este bache
          </a>
        </div>
        <a
          v-else-if="mailtoAyuda"
          :href="mailtoAyuda"
          class="cursor-pointer text-center text-sm text-[#3B9EC9] underline-offset-2 hover:underline"
        >
          {{ store.etiquetaAyuda }}
        </a>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
