import type { ComputedRef, Ref } from 'vue'
import { createContext } from 'radix-vue'

export const SIDEBAR_COOKIE_NAME = 'sidebar:state'
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
export const SIDEBAR_WIDTH_MOBILE = '18rem'
export const SIDEBAR_WIDTH_ICON = '3rem'
export const SIDEBAR_KEYBOARD_SHORTCUT = 'b'

export const SIDEBAR_WIDTH_STORAGE_KEY = 'sidebar:width'
export const SIDEBAR_DEFAULT_WIDTH_PX = 256
export const SIDEBAR_MIN_WIDTH_PX = 192
export const SIDEBAR_MAX_WIDTH_PX = 400

export function clampSidebarWidthPx(px: number): number {
  return Math.min(Math.max(Math.round(px), SIDEBAR_MIN_WIDTH_PX), SIDEBAR_MAX_WIDTH_PX)
}

export const [useSidebar, provideSidebarContext] = createContext<{
  state: ComputedRef<'expanded' | 'collapsed'>
  open: Ref<boolean>
  setOpen: (value: boolean) => void
  isMobile: Ref<boolean>
  openMobile: Ref<boolean>
  setOpenMobile: (value: boolean) => void
  toggleSidebar: () => void
  widthPx: Ref<number>
  setWidthPx: (px: number) => void
  isResizing: Ref<boolean>
  setIsResizing: (value: boolean) => void
}>('Sidebar')
