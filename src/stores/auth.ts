import { defineStore } from 'pinia'

import type { MvUsuarioRow } from '@/types/supabase'

import type { LoginSuccess } from '@/services/auth'
import { supabase } from '@/services/supabaseClient'
import { cerrarLogSesion, iniciarLogSesion } from '@/services/sessionLog'
import { useDashboardMenuStore } from './dashboardMenu'
import { useDatosAlumnoMnpStore } from './datosAlumnoMnp'
import { useContactoOtpConfigStore } from './contactoOtpConfig'
import { useMockContactoOtpUiStore } from './mockContactoOtpUi'
import { useMockMatriculaContextStore } from './mockMatriculaContext'

const STORAGE_KEY = 'rematricula-auth-session'

/**
 * Permisos en la app. `rut_usuario` no existe en `mv_usuario` (solo `rut_modifica_usuario` en auditoría);
 * queda null salvo que otro flujo lo rellene.
 */
export type AuthPerfil = {
  codigo_perfil_usuario: number | null
  /** Desde `mv_usuario.codigo_grupo` (1=DVU, 2=Admisión, 3=TI). Null si no hay fila LDAP. */
  codigo_grupo: number | null
  rut_usuario: string | null
}

type StoredSession = {
  username: string
  email: string | null
  nombre_usuario: string | null
  apellido_usuario: string | null
  perfil: AuthPerfil | null
  tipoPixarron: string | null
  authSource: 'mv_ldap' | 'pixarron' | null
  sessionLogId: string | null
}

function parseCodigoGrupo(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    // `toIntReq` en autenticacion_uniacc usa fallback 0 si la columna viene null → tratar como «sin dato».
    if (raw === 0) return null
    return raw
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw)
    if (!Number.isFinite(n) || n === 0) return null
    return n
  }
  return null
}

function perfilFromMvUsuario(row: MvUsuarioRow | null): AuthPerfil | null {
  if (!row) return null
  return {
    codigo_perfil_usuario: row.codigo_perfil_usuario,
    codigo_grupo: parseCodigoGrupo(row.codigo_grupo),
    rut_usuario: null,
  }
}

/** Primera letra mayúscula, resto minúsculas (p. ej. `vidal` → `Vidal`). */
function capitalizarSegmento(s: string): string {
  const t = s.trim()
  if (!t) return ''
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

/**
 * Usuario de conexión tipo `nombre.apellido` → "Nombre Apellido" (cada segmento separado por `.`).
 */
function nombreCompletoDesdeUsuarioConexion(localUser: string): string {
  const segmentos = localUser.split('.').filter((p) => p.length > 0)
  if (segmentos.length === 0) return localUser.trim()
  return segmentos.map((seg) => capitalizarSegmento(seg)).join(' ')
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    username: null as string | null,
    email: null as string | null,
    perfil: null as AuthPerfil | null,
    tipoPixarron: null as string | null,
    authSource: null as 'mv_ldap' | 'pixarron' | null,
    /** Solo en memoria; no se persiste (se reconstruye vía `perfil` tras LDAP). */
    mvUsuario: null as MvUsuarioRow | null,
    /** Desde `mv_usuario` cuando el usuario existe en BD (flujo LDAP). */
    nombre_usuario: null as string | null,
    apellido_usuario: null as string | null,
    sessionLogId: null as string | null,
  }),
  getters: {
    isAuthenticated: (s) => s.username !== null && s.username !== '',
    /**
     * Cabecera: con fila en `mv_usuario` → `nombre_usuario` + `apellido_usuario`;
     * si no (p. ej. Pixarron) → a partir del usuario `nombre.apellido`, capitalizando cada parte.
     */
    displayNombreCompleto: (s) => {
      const desdeBd = [s.nombre_usuario, s.apellido_usuario].filter(
        (x): x is string => typeof x === 'string' && x.trim().length > 0,
      )
      if (desdeBd.length > 0) return desdeBd.join(' ')

      const u = s.username?.trim() ?? ''
      if (!u) return ''
      return nombreCompletoDesdeUsuarioConexion(u)
    },
    /** Super Admin (1) o Admin (2) en `mv_usuario.codigo_perfil_usuario`. */
    esSuperAdminOAdmin: (s) => {
      const c = s.perfil?.codigo_perfil_usuario
      return c === 1 || c === 2
    },
    /** Grupo TI (`mv_usuario.codigo_grupo === 3`), único que edita el mantenedor de menú. */
    esGrupoTI: (s) => s.perfil?.codigo_grupo === 3,
  },
  actions: {
    /** Persiste el estado actual de sesión (misma forma que tras login). */
    persistToSessionStorage() {
      if (!this.username) return
      const payload: StoredSession = {
        username: this.username,
        email: this.email,
        nombre_usuario: this.nombre_usuario,
        apellido_usuario: this.apellido_usuario,
        perfil: this.perfil,
        tipoPixarron: this.tipoPixarron,
        authSource: this.authSource,
        sessionLogId: this.sessionLogId,
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    },

    /**
     * Sesiones guardadas antes de `codigo_grupo` en perfil, o `mvUsuario` con grupo en 0 por fallback del API.
     * Rellena `perfil` (y nombres) desde `mv_usuario` por email y limpia cache del menú.
     */
    async completarPerfilMvUsuarioSiFaltaGrupo() {
      if (this.authSource !== 'mv_ldap' || !this.email?.trim()) return
      const g = this.perfil?.codigo_grupo
      if (g != null && g !== 0) return

      const email = this.email.trim().toLowerCase()
      const { data, error } = await supabase.from('mv_usuario').select('*').eq('email', email).maybeSingle()

      if (error || !data) return

      const row = data as MvUsuarioRow
      this.mvUsuario = row
      this.perfil = perfilFromMvUsuario(row)
      if (typeof row.nombre_usuario === 'string' && row.nombre_usuario) {
        this.nombre_usuario = row.nombre_usuario
      }
      if (typeof row.apellido_usuario === 'string' && row.apellido_usuario) {
        this.apellido_usuario = row.apellido_usuario
      }
      this.persistToSessionStorage()
      useDashboardMenuStore().clear()
    },

    async hydrateFromStorage() {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw) as Partial<StoredSession> & { username?: string }
        if (typeof parsed.username === 'string' && parsed.username) {
          this.username = parsed.username
        }
        if (typeof parsed.email === 'string') {
          this.email = parsed.email
        } else {
          this.email = null
        }
        this.nombre_usuario =
          typeof parsed.nombre_usuario === 'string' ? parsed.nombre_usuario : null
        this.apellido_usuario =
          typeof parsed.apellido_usuario === 'string' ? parsed.apellido_usuario : null

        if (parsed.perfil && typeof parsed.perfil === 'object') {
          const p = parsed.perfil as AuthPerfil
          this.perfil = {
            codigo_perfil_usuario:
              typeof p.codigo_perfil_usuario === 'number' ? p.codigo_perfil_usuario : null,
            codigo_grupo: parseCodigoGrupo(p.codigo_grupo),
            rut_usuario: typeof p.rut_usuario === 'string' ? p.rut_usuario : null,
          }
        } else {
          this.perfil = null
        }
        this.tipoPixarron =
          typeof parsed.tipoPixarron === 'string' ? parsed.tipoPixarron : null
        this.authSource =
          parsed.authSource === 'mv_ldap' || parsed.authSource === 'pixarron'
            ? parsed.authSource
            : null
        this.sessionLogId =
          typeof parsed.sessionLogId === 'string' ? parsed.sessionLogId : null
        this.mvUsuario = null

        const datosMnp = useDatosAlumnoMnpStore()
        if (this.authSource === 'pixarron' && this.username) {
          await datosMnp.fetchSiSinMvUsuario(this.username, false)
          if (datosMnp.filas.length === 0) {
            this.logout()
          }
        } else {
          datosMnp.reset()
        }

        await this.completarPerfilMvUsuarioSiFaltaGrupo()
        if (this.isAuthenticated) {
          await useContactoOtpConfigStore().ensureLoaded(true)
        }
      } catch {
        sessionStorage.removeItem(STORAGE_KEY)
        this.logout()
      }
    },

    /** Flujo unificado post-login (LDAP vía mv_usuario o API Pixarron). */
    async loginFromFlow(result: LoginSuccess, urlOrigen: string | null = null) {
      this.username = result.localPart
      this.email = result.email
      this.authSource = result.authSource
      this.tipoPixarron = result.tipoPixarron
      this.mvUsuario = result.mvUsuario as MvUsuarioRow | null
      this.perfil = perfilFromMvUsuario(this.mvUsuario)
      this.nombre_usuario = result.mvUsuario?.nombre_usuario ?? null
      this.apellido_usuario = result.mvUsuario?.apellido_usuario ?? null

      const mvId =
        typeof result.mvUsuario?.id === 'string' && result.mvUsuario.id.length > 0
          ? result.mvUsuario.id
          : null

      this.sessionLogId = await iniciarLogSesion({
        email: result.email,
        usuarioLocal: result.localPart,
        authSource: result.authSource,
        mvUsuarioId: mvId,
        urlOrigen,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      })

      this.persistToSessionStorage()
      await Promise.all([
        this.completarPerfilMvUsuarioSiFaltaGrupo(),
        useContactoOtpConfigStore().ensureLoaded(true),
      ])
    },

    logout() {
      const sessionId = this.sessionLogId
      if (sessionId) {
        void cerrarLogSesion(sessionId, 'logout')
      }
      this.username = null
      this.email = null
      this.perfil = null
      this.tipoPixarron = null
      this.authSource = null
      this.mvUsuario = null
      this.nombre_usuario = null
      this.apellido_usuario = null
      this.sessionLogId = null
      sessionStorage.removeItem(STORAGE_KEY)
      useDatosAlumnoMnpStore().reset()
      useDashboardMenuStore().clear()
      useContactoOtpConfigStore().reset()
      useMockContactoOtpUiStore().resetAll()
      useMockMatriculaContextStore().clearAlumno()
    },
  },
})
