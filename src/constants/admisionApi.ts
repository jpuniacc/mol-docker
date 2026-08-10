/**
 * Base URL de uniacc-api (postulantes, matriculados, firma-acepta, refresh, etc.).
 *
 * - Con `VITE_API_URL` absoluto (sin barra final), p. ej. `http://172.16.0.206:3001`: el navegador llama ahí.
 * - Cadena vacía: rutas relativas `/api/...` al mismo host/puerto que el front (9501).
 *   En `npm run dev`, Vite hace proxy de `/api/*` a `VITE_ADMISION_API_TARGET`.
 *   En `dist` **no hay proxy**: si la API corre en otro puerto/host, debes definir `VITE_API_URL`
 *   en el build o poner nginx que enrute `/api` a uniacc-api.
 */
export function admisionApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined
  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.replace(/\/$/, '')
  }
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return ''
  }
  return ''
}
