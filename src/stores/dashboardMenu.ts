import { defineStore } from 'pinia'

import { supabase } from '@/services/supabaseClient'
import type { BoMenuItemGrupoRow, BoMenuItemRow } from '@/types/supabase'
import {
  boMenuDebugEnabled,
  boMenuGroup,
  boMenuJson,
  boMenuLog,
  boMenuTable,
} from '@/utils/boMenuDebug'

function sc(raw: Record<string, unknown>, snake: string, camel: string): unknown {
  if (raw[snake] !== undefined && raw[snake] !== null) return raw[snake]
  if (raw[camel] !== undefined && raw[camel] !== null) return raw[camel]
  return undefined
}

/** Alinea filas PostgREST / supabase-js (snake vs camel, tipos sueltos). */
function normalizeMenuItem(raw: Record<string, unknown>): BoMenuItemRow {
  const id = String(raw.id ?? '')
  const parentRaw = sc(raw, 'parent_id', 'parentId')
  const parent_id =
    parentRaw === undefined || parentRaw === null || parentRaw === ''
      ? null
      : String(parentRaw)

  const tipoRaw = String(raw.tipo ?? '').trim().toLowerCase()
  const tipo: 'link' | 'group' = tipoRaw === 'group' ? 'group' : 'link'

  const routeRaw = sc(raw, 'route_name', 'routeName')
  const route_name =
    routeRaw === undefined || routeRaw === null || routeRaw === '' ? null : String(routeRaw).trim()

  const iconRaw = sc(raw, 'icon_key', 'iconKey')
  const icon_key =
    iconRaw === undefined || iconRaw === null || iconRaw === '' ? null : String(iconRaw).trim()

  const ordenRaw = sc(raw, 'orden', 'orden')
  const orden = typeof ordenRaw === 'number' && Number.isFinite(ordenRaw) ? ordenRaw : Number(ordenRaw ?? 0) || 0

  const activoRaw = sc(raw, 'activo', 'activo')
  const activo =
    activoRaw === true ||
    activoRaw === 'true' ||
    activoRaw === 't' ||
    activoRaw === 1 ||
    activoRaw === '1'

  const createdRaw = sc(raw, 'created_at', 'createdAt')
  const updatedRaw = sc(raw, 'updated_at', 'updatedAt')
  const created_at = createdRaw != null ? String(createdRaw) : new Date().toISOString()
  const updated_at = updatedRaw != null ? String(updatedRaw) : created_at

  return {
    id,
    parent_id,
    tipo,
    label: String(raw.label ?? '').trim(),
    route_name,
    icon_key,
    orden,
    activo,
    created_at,
    updated_at,
  }
}

function normalizeGrupoRow(raw: Record<string, unknown>): BoMenuItemGrupoRow {
  const menu_item_id = String(raw.menu_item_id ?? raw.menuItemId ?? '')
  const cg = raw.codigo_grupo ?? raw.codigoGrupo
  const n = typeof cg === 'number' ? cg : Number(String(cg))
  return {
    menu_item_id,
    codigo_grupo: Number.isFinite(n) ? n : 0,
  }
}

export const useDashboardMenuStore = defineStore('dashboardMenu', {
  state: () => ({
    items: [] as BoMenuItemRow[],
    grupoRows: [] as BoMenuItemGrupoRow[],
    loadError: null as string | null,
    fetched: false,
  }),
  actions: {
    /** Carga única en sesión salvo `refetch` / `clear`. */
    async ensureLoaded() {
      if (this.fetched) return
      await this.refetch()
    },

    async refetch() {
      this.loadError = null
      const t0 = typeof performance !== 'undefined' ? performance.now() : 0

      if (boMenuDebugEnabled) {
        const u = import.meta.env.VITE_SUPABASE_URL as string | undefined
        boMenuLog(`refetch() inicio t=${new Date().toISOString()}`)
        boMenuLog('VITE_SUPABASE_URL (origen datos):', u ?? '(undefined)')
        boMenuLog('VITE_DEBUG_BO_MENU:', import.meta.env.VITE_DEBUG_BO_MENU ?? '(no definido)')
      }

      const [rItems, rGrupos] = await Promise.all([
        supabase.from('bo_menu_item').select('*'),
        supabase.from('bo_menu_item_grupo').select('*'),
      ])

      boMenuGroup('respuesta cruda PostgREST', () => {
        boMenuLog('bo_menu_item.status', rItems.status, 'error:', rItems.error ?? null)
        boMenuLog('bo_menu_item_grupo.status', rGrupos.status, 'error:', rGrupos.error ?? null)
        boMenuJson('bo_menu_item.data (array completo)', rItems.data ?? [])
        boMenuJson('bo_menu_item_grupo.data (array completo)', rGrupos.data ?? [])
        const rawItems = (rItems.data ?? []) as Record<string, unknown>[]
        for (let i = 0; i < rawItems.length; i++) {
          const row = rawItems[i]
          boMenuLog(`fila ítem[${i}] claves:`, Object.keys(row))
          boMenuJson(`fila ítem[${i}] objeto`, row)
        }
        const rawG = (rGrupos.data ?? []) as Record<string, unknown>[]
        for (let i = 0; i < rawG.length; i++) {
          boMenuJson(`fila grupo[${i}]`, rawG[i])
        }
      })

      if (rItems.error) {
        this.loadError = rItems.error.message
        this.items = []
        this.fetched = false
        boMenuLog('ABORT: error bo_menu_item', rItems.error)
        return
      }
      if (rGrupos.error) {
        this.loadError = rGrupos.error.message
        this.grupoRows = []
        this.fetched = false
        boMenuLog('ABORT: error bo_menu_item_grupo', rGrupos.error)
        return
      }

      const rawItemRows = (rItems.data ?? []) as Record<string, unknown>[]
      const normalizedItems = rawItemRows.map((r) => normalizeMenuItem(r))
      const rawGrupoRows = (rGrupos.data ?? []) as Record<string, unknown>[]
      const normalizedGrupos = rawGrupoRows.map((r) => normalizeGrupoRow(r))

      boMenuGroup('después de normalizeMenuItem / normalizeGrupoRow', () => {
        boMenuTable(
          'items normalizados',
          normalizedItems.map((it) => ({
            id: it.id,
            parent_id: it.parent_id,
            tipo: it.tipo,
            label: it.label,
            route_name: it.route_name,
            icon_key: it.icon_key,
            orden: it.orden,
            activo: it.activo,
          })) as Record<string, unknown>[],
        )
        boMenuTable(
          'grupoRows normalizados',
          normalizedGrupos.map((g) => ({
            menu_item_id: g.menu_item_id,
            codigo_grupo: g.codigo_grupo,
          })) as Record<string, unknown>[],
        )
        for (let i = 0; i < rawItemRows.length; i++) {
          const raw = rawItemRows[i]
          const norm = normalizedItems[i]
          if (!norm) continue
          const rawParent = raw.parent_id ?? raw.parentId
          if (String(rawParent ?? '') !== String(norm.parent_id ?? '')) {
            boMenuLog(`diff parent_id fila[${i}] raw→norm:`, rawParent, '→', norm.parent_id)
          }
        }
      })

      this.items = normalizedItems
      this.grupoRows = normalizedGrupos
      this.fetched = true

      const t1 = typeof performance !== 'undefined' ? performance.now() : 0
      boMenuLog(
        `refetch() fin items=${this.items.length} grupos=${this.grupoRows.length} ms=${(t1 - t0).toFixed(1)}`,
      )
    },

    clear() {
      this.items = []
      this.grupoRows = []
      this.loadError = null
      this.fetched = false
    },
  },
})
