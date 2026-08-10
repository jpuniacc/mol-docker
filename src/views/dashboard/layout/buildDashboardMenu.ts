import type { Component } from 'vue'

import type { BoMenuItemGrupoRow, BoMenuItemRow } from '@/types/supabase'
import { boMenuGroup, boMenuJson, boMenuLog, boMenuTable } from '@/utils/boMenuDebug'

import { menuIconFromKey } from './menuIcons'

export type DashboardNavLinkResolved = {
  kind: 'link'
  routeName: string
  label: string
  icon: Component
}

export type DashboardNavSubgroupResolved = {
  kind: 'group'
  id: string
  label: string
  icon: Component
  children: DashboardNavLinkResolved[]
}

export type DashboardNavGroupChildResolved = DashboardNavLinkResolved | DashboardNavSubgroupResolved

export type DashboardNavGroupResolved = {
  id: string
  label: string
  children: DashboardNavGroupChildResolved[]
}

export type DashboardNavPlanResolved = {
  topLinks: DashboardNavLinkResolved[]
  groups: DashboardNavGroupResolved[]
}

const MOCK_ROUTE_PREFIX = 'matricula-mock'

/** Rutas hijas del flujo mock cuando el usuario ve el ítem «Mock matrícula». */
const MOCK_CHILD_ROUTE_NAMES = [
  'matricula-mock-seleccion-alumno',
  'matricula-mock-datos',
  'matricula-mock-forma-pago',
  'matricula-mock-firma',
  'matricula-mock-resumen',
] as const

function itemVisibleForGrupo(
  item: BoMenuItemRow,
  grupo: number | null,
  grupoRows: BoMenuItemGrupoRow[],
): boolean {
  if (!item.activo) return false
  if (grupo === 3) return true
  if (grupo == null) return false
  const itemKey = uuidNorm(item.id)
  return grupoRows.some((g) => uuidNorm(g.menu_item_id) === itemKey && g.codigo_grupo === grupo)
}

function pixarronDefaultPlan(): DashboardNavPlanResolved {
  return {
    topLinks: [
      {
        kind: 'link',
        routeName: 'dashboard-home',
        label: 'Inicio',
        icon: menuIconFromKey('Home'),
      },
      {
        kind: 'link',
        routeName: 'matricula-mock-seleccion-alumno',
        label: 'Mock matrícula',
        icon: menuIconFromKey('GraduationCap'),
      },
    ],
    groups: [],
  }
}

function sortByOrden(a: BoMenuItemRow, b: BoMenuItemRow): number {
  return a.orden - b.orden
}

/** PostgREST a veces serializa UUID en mayúsculas; sin normalizar `parent_id === id` falla y no hay submenús. */
function uuidNorm(id: string | null | undefined): string | null {
  if (id == null || id === '') return null
  return String(id).toLowerCase()
}

function tipoEsLink(tipo: string | null | undefined): boolean {
  return String(tipo ?? '').toLowerCase() === 'link'
}

function tipoEsGroup(tipo: string | null | undefined): boolean {
  return String(tipo ?? '').toLowerCase() === 'group'
}

/**
 * Árbol de menú lateral filtrado por `codigo_grupo` y regla TI (3 = todo).
 * Usuarios Pixarron sin `mv_usuario` solo ven Inicio + mock (comportamiento previo).
 */
function grupoNumerico(codigoGrupo: number | null): number | null {
  if (codigoGrupo == null) return null
  const n = Number(codigoGrupo)
  return Number.isFinite(n) ? n : null
}

export function buildDashboardMenuPlan(
  items: BoMenuItemRow[],
  grupoRows: BoMenuItemGrupoRow[],
  codigoGrupo: number | null,
  authSource: 'mv_ldap' | 'pixarron' | null,
): DashboardNavPlanResolved {
  const grupo = grupoNumerico(codigoGrupo)

  boMenuGroup(`buildDashboardMenuPlan() authSource=${String(authSource)} codigoGrupo(raw)=${JSON.stringify(codigoGrupo)} grupo(numeric)=${JSON.stringify(grupo)}`, () => {
    boMenuLog('items.length', items.length, 'grupoRows.length', grupoRows.length)
    boMenuTable(
      'snapshot items (entrada)',
      items.map((r) => ({
        id: r.id,
        parent_id_norm: uuidNorm(r.parent_id),
        tipo: r.tipo,
        label: r.label,
        route_name: r.route_name,
        activo: r.activo,
        activo_typeof: typeof r.activo,
        orden: r.orden,
        orden_typeof: typeof r.orden,
      })) as Record<string, unknown>[],
    )
    boMenuTable(
      'snapshot grupoRows',
      grupoRows.map((g) => ({
        menu_item_id: g.menu_item_id,
        menu_item_id_norm: uuidNorm(g.menu_item_id),
        codigo_grupo: g.codigo_grupo,
      })) as Record<string, unknown>[],
    )
  })

  if (authSource === 'pixarron' && grupo == null) {
    const plan = pixarronDefaultPlan()
    boMenuLog('salida temprana: pixarronDefaultPlan()', plan)
    return plan
  }

  const byId = new Map(
    items.map((r) => {
      const k = uuidNorm(r.id) ?? String(r.id).toLowerCase()
      return [k, r] as const
    }),
  )
  const roots = items.filter((r) => uuidNorm(r.parent_id) === null).sort(sortByOrden)

  boMenuGroup('árbol: raíces (parent_id null)', () => {
    boMenuLog('roots count', roots.length)
    boMenuJson(
      'roots detalle',
      roots.map((r) => ({
        id: r.id,
        id_norm: uuidNorm(r.id),
        label: r.label,
        tipo: r.tipo,
        orden: r.orden,
        visible: itemVisibleForGrupo(r, grupo, grupoRows),
      })),
    )
  })

  const topLinks: DashboardNavLinkResolved[] = []
  const groups: DashboardNavGroupResolved[] = []

  for (const root of roots) {
    const visRoot = itemVisibleForGrupo(root, grupo, grupoRows)
    if (!visRoot) {
      boMenuLog('root OCULTO por grupo/activo:', root.id, root.label, root.tipo)
      continue
    }

    if (tipoEsLink(root.tipo)) {
      const name = root.route_name
      if (!name) {
        boMenuLog('root link sin route_name, skip:', root.id, root.label)
        continue
      }
      topLinks.push({
        kind: 'link',
        routeName: name,
        label: root.label,
        icon: menuIconFromKey(root.icon_key),
      })
      boMenuLog('topLink añadido:', name, root.label)
      continue
    }

    if (!tipoEsGroup(root.tipo)) {
      boMenuLog('root tipo no link ni group, skip:', root.id, root.tipo, root.label)
      continue
    }

    const rootKey = uuidNorm(root.id)
    const byParent = items.filter((r) => uuidNorm(r.parent_id) === rootKey)
    const childrenRows = byParent.filter((c) => itemVisibleForGrupo(c, grupo, grupoRows)).sort(sortByOrden)

    boMenuGroup(`grupo "${root.label}" id=${root.id} rootKey=${rootKey}`, () => {
      boMenuLog('hijos candidatos parent_id===rootKey (antes filtro visibilidad):', byParent.length)
      boMenuJson(
        'byParent',
        byParent.map((r) => ({
          id: r.id,
          parent_id: r.parent_id,
          parent_norm: uuidNorm(r.parent_id),
          label: r.label,
          tipo: r.tipo,
          visible: itemVisibleForGrupo(r, grupo, grupoRows),
        })),
      )
      boMenuLog('childrenRows tras filtro visibilidad:', childrenRows.length)
    })

    const children: DashboardNavGroupChildResolved[] = []
    for (const c of childrenRows) {
      const ck = uuidNorm(c.id)
      if (!ck) {
        boMenuLog('hijo sin id normalizado, skip:', c)
        continue
      }
      if (!byId.has(ck)) {
        boMenuLog('hijo id no está en byId, skip. ck=', ck, 'byId keys sample', [...byId.keys()].slice(0, 3))
        continue
      }

      if (tipoEsLink(c.tipo)) {
        const name = c.route_name
        if (!name) {
          boMenuLog('hijo link sin route_name, skip:', c.id, c.label)
          continue
        }
        children.push({
          kind: 'link',
          routeName: name,
          label: c.label,
          icon: menuIconFromKey(c.icon_key),
        })
        boMenuLog('hijo link añadido al grupo:', root.label, '→', name, c.label)
        continue
      }

      if (tipoEsGroup(c.tipo)) {
        const grandChildrenRows = items
          .filter((r) => uuidNorm(r.parent_id) === ck)
          .filter((r) => itemVisibleForGrupo(r, grupo, grupoRows))
          .sort(sortByOrden)

        const grandChildrenLinks: DashboardNavLinkResolved[] = []
        for (const gc of grandChildrenRows) {
          if (!tipoEsLink(gc.tipo)) continue
          if (!gc.route_name) continue
          grandChildrenLinks.push({
            kind: 'link',
            routeName: gc.route_name,
            label: gc.label,
            icon: menuIconFromKey(gc.icon_key),
          })
        }

        if (grandChildrenLinks.length > 0) {
          children.push({
            kind: 'group',
            id: c.id,
            label: c.label,
            icon: menuIconFromKey(c.icon_key),
            children: grandChildrenLinks,
          })
          boMenuLog('subgrupo añadido:', root.label, '→', c.label, 'children=', grandChildrenLinks.length)
        } else {
          boMenuLog('subgrupo sin links visibles, skip:', c.id, c.label)
        }
        continue
      }

      boMenuLog('hijo tipo no soportado, skip:', c.id, c.tipo, c.label)
    }

    if (children.length > 0) {
      groups.push({
        id: root.id,
        label: root.label,
        children,
      })
    } else {
      boMenuLog('grupo sin hijos visibles (no se empuja a sidebar):', root.label, root.id)
    }
  }

  const out = { topLinks, groups }
  boMenuJson('buildDashboardMenuPlan() resultado final (routeName + labels)', {
    topLinks: topLinks.map((l) => ({ routeName: l.routeName, label: l.label })),
    groups: groups.map((g) => ({
      id: g.id,
      label: g.label,
      children: g.children.map((c) =>
        c.kind === 'link'
          ? { kind: c.kind, routeName: c.routeName, label: c.label }
          : {
              kind: c.kind,
              id: c.id,
              label: c.label,
              children: c.children.map((gc) => ({ routeName: gc.routeName, label: gc.label })),
            },
      ),
    })),
  })
  return out
}

/** Rutas de enlace explícitas permitidas por el menú (sidebar + guard). */
export function allowedRouteNamesFromMenu(
  items: BoMenuItemRow[],
  grupoRows: BoMenuItemGrupoRow[],
  codigoGrupo: number | null,
  authSource: 'mv_ldap' | 'pixarron' | null,
): Set<string> {
  const plan = buildDashboardMenuPlan(items, grupoRows, codigoGrupo, authSource)
  const names = new Set<string>()
  for (const l of plan.topLinks) names.add(l.routeName)
  for (const g of plan.groups) {
    for (const c of g.children) {
      if (c.kind === 'link') {
        names.add(c.routeName)
        continue
      }
      for (const gc of c.children) {
        names.add(gc.routeName)
      }
    }
  }
  if (names.has('matricula-mock-seleccion-alumno') || names.has('matricula-mock-datos')) {
    for (const m of MOCK_CHILD_ROUTE_NAMES) names.add(m)
  }
  boMenuJson('allowedRouteNamesFromMenu() Set como array', [...names])
  return names
}

export function routeNameAllowedByMenu(
  routeName: string | symbol | null | undefined,
  allowed: Set<string>,
): boolean {
  if (routeName == null || typeof routeName !== 'string') return false
  if (allowed.has(routeName)) return true
  if (routeName.startsWith(MOCK_ROUTE_PREFIX) && allowed.has('matricula-mock-seleccion-alumno')) {
    return true
  }
  if (routeName.startsWith(MOCK_ROUTE_PREFIX) && allowed.has('matricula-mock-datos')) return true
  return false
}

export function esLinkActivoDashboard(
  routeName: string,
  nombreRutaActual: string | symbol | null | undefined,
): boolean {
  if (routeName === 'matricula-mock-seleccion-alumno' || routeName === 'matricula-mock-datos') {
    return typeof nombreRutaActual === 'string' && nombreRutaActual.startsWith('matricula-mock')
  }
  return nombreRutaActual === routeName
}
