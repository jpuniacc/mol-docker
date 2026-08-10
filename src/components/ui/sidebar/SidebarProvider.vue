<script setup lang="ts">
import { cn } from '@/composables/utils'
import { useEventListener, useMediaQuery, useVModel } from '@vueuse/core'
import { TooltipProvider } from 'radix-vue'
import { computed, type HTMLAttributes, type Ref, ref } from 'vue'
import { clampSidebarWidthPx, provideSidebarContext, SIDEBAR_COOKIE_MAX_AGE, SIDEBAR_COOKIE_NAME, SIDEBAR_DEFAULT_WIDTH_PX, SIDEBAR_KEYBOARD_SHORTCUT, SIDEBAR_WIDTH_ICON, SIDEBAR_WIDTH_STORAGE_KEY } from './utils'

const props = withDefaults(defineProps<{
  defaultOpen?: boolean
  open?: boolean
  class?: HTMLAttributes['class']
}>(), {
  defaultOpen: true,
  open: undefined,
})

const emits = defineEmits<{
  'update:open': [open: boolean]
}>()

const isMobile = useMediaQuery('(max-width: 768px)')
const openMobile = ref(false)

const open = useVModel(props, 'open', emits, {
  defaultValue: props.defaultOpen ?? false,
  passive: (props.open === undefined) as false,
}) as Ref<boolean>

function setOpen(value: boolean) {
  open.value = value // emits('update:open', value)

  // This sets the cookie to keep the sidebar state.
  document.cookie = `${SIDEBAR_COOKIE_NAME}=${open.value}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
}

function setOpenMobile(value: boolean) {
  openMobile.value = value
}

function loadStoredWidthPx(): number {
  const raw = Number.parseInt(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY) ?? '', 10)
  return Number.isFinite(raw) ? clampSidebarWidthPx(raw) : SIDEBAR_DEFAULT_WIDTH_PX
}

const widthPx = ref(loadStoredWidthPx())
const isResizing = ref(false)

function setWidthPx(px: number) {
  widthPx.value = clampSidebarWidthPx(px)
  localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(widthPx.value))
}

function setIsResizing(value: boolean) {
  isResizing.value = value
}

// Helper to toggle the sidebar.
function toggleSidebar() {
  return isMobile.value ? setOpenMobile(!openMobile.value) : setOpen(!open.value)
}

useEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    toggleSidebar()
  }
})

// We add a state so that we can do data-state="expanded" or "collapsed".
// This makes it easier to style the sidebar with Tailwind classes.
const state = computed(() => open.value ? 'expanded' : 'collapsed')

provideSidebarContext({
  state,
  open,
  setOpen,
  isMobile,
  openMobile,
  setOpenMobile,
  toggleSidebar,
  widthPx,
  setWidthPx,
  isResizing,
  setIsResizing,
})
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <div
      :style="{
        '--sidebar-width': `${widthPx}px`,
        '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
      }"
      :data-resizing="isResizing ? 'true' : undefined"
      :class="cn('group/sidebar-wrapper flex min-h-svh w-full text-sidebar-foreground has-[[data-variant=inset]]:bg-sidebar', props.class)"
      v-bind="$attrs"
    >
      <slot />
    </div>
  </TooltipProvider>
</template>
