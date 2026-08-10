import { onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'

import { cerrarLogSesionBeacon } from '@/services/sessionLog'
import { useAuthStore } from '@/stores/auth'

const STORAGE_KEY = 'rematricula-auth-session'

function sessionIdFromStorage(): string | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { sessionLogId?: string }
    return typeof parsed.sessionLogId === 'string' ? parsed.sessionLogId : null
  } catch {
    return null
  }
}

/**
 * Registra beacon de cierre de sesión al cerrar pestaña/navegador.
 * Usa sessionStorage porque el store puede no estar disponible en pagehide.
 */
export function useSessionCloseBeacon() {
  const auth = useAuthStore()
  const { sessionLogId } = storeToRefs(auth)

  function onPageHide() {
    const id = sessionLogId.value ?? sessionIdFromStorage()
    if (id) cerrarLogSesionBeacon(id)
  }

  onMounted(() => {
    if (typeof window === 'undefined') return
    window.addEventListener('pagehide', onPageHide)
  })

  onUnmounted(() => {
    if (typeof window === 'undefined') return
    window.removeEventListener('pagehide', onPageHide)
  })
}
