import { defineStore } from 'pinia'
import { computed } from 'vue'

import { useAuthStore } from '@/stores/auth'
import { alcanceCartera, AVISO_CARTERA_SIN_CORREO } from '@/utils/alcanceCarteraEjecutivo'

export const useCarteraEjecutivoStore = defineStore('carteraEjecutivo', () => {
  const auth = useAuthStore()

  const alcance = computed(() =>
    alcanceCartera(auth.perfil?.codigo_perfil_usuario ?? null, auth.email),
  )

  const bloqueado = computed(() => alcance.value.tipo === 'sin_correo')

  const emailConsulta = computed(() =>
    alcance.value.tipo === 'ejecutivo' ? alcance.value.email : null,
  )

  return { alcance, bloqueado, emailConsulta }
})

/** Agrega el correo del ejecutivo. Si no hay correo de perfil 3, no llama. */
export function urlConCarteraEjecutivo(url: string): string | { error: string } {
  const cartera = useCarteraEjecutivoStore()
  if (cartera.bloqueado) return { error: AVISO_CARTERA_SIN_CORREO }
  if (!cartera.emailConsulta) return url
  const join = url.includes('?') ? '&' : '?'
  return `${url}${join}emailEjecutivo=${encodeURIComponent(cartera.emailConsulta)}`
}
