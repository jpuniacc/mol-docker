<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/composables/utils'
import { useSidebar } from './utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()

const { toggleSidebar, state, isMobile, widthPx, setWidthPx, setIsResizing } = useSidebar()

const DRAG_THRESHOLD_PX = 4

let dragged = false
let startX = 0
let startWidth = 0

function onPointerDown(event: PointerEvent) {
  if (isMobile.value || state.value !== 'expanded' || event.button !== 0) return

  const target = event.currentTarget as HTMLElement
  dragged = false
  startX = event.clientX
  startWidth = widthPx.value
  // side=right invierte el sentido del arrastre
  const dir = target.closest('[data-side]')?.getAttribute('data-side') === 'right' ? -1 : 1

  target.setPointerCapture(event.pointerId)

  function onMove(e: PointerEvent) {
    const dx = (e.clientX - startX) * dir
    if (!dragged) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX) return
      dragged = true
      setIsResizing(true)
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
    }
    setWidthPx(startWidth + dx)
  }

  function onUp(e: PointerEvent) {
    target.releasePointerCapture(e.pointerId)
    target.removeEventListener('pointermove', onMove)
    target.removeEventListener('pointerup', onUp)
    target.removeEventListener('pointercancel', onUp)
    setIsResizing(false)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }

  target.addEventListener('pointermove', onMove)
  target.addEventListener('pointerup', onUp)
  target.addEventListener('pointercancel', onUp)
}

function onClick() {
  // Si hubo arrastre, el clic que lo acompaña no debe colapsar el sidebar.
  if (dragged) {
    dragged = false
    return
  }
  toggleSidebar()
}
</script>

<template>
  <button
    data-sidebar="rail"
    aria-label="Ajustar o colapsar el menú"
    :tabindex="-1"
    title="Arrastra para ajustar el ancho · Clic para colapsar"
    :class="cn(
      'absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-sidebar-border group-data-[side=left]:-right-4 group-data-[side=right]:left-0 sm:flex',
      '[[data-side=left][data-state=expanded]_&]:cursor-col-resize [[data-side=right][data-state=expanded]_&]:cursor-col-resize',
      '[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
      'group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full group-data-[collapsible=offcanvas]:hover:bg-sidebar',
      '[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
      '[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
      props.class,
    )"
    @pointerdown="onPointerDown"
    @click="onClick"
  >
    <slot />
  </button>
</template>
