/**
 * Logs detallados del menú dinámico (`bo_menu_item`).
 * - En desarrollo: activo por defecto.
 * - En build producción: solo si `VITE_DEBUG_BO_MENU=true` o `1` en `.env`.
 */
export const boMenuDebugEnabled =
  import.meta.env.DEV === true ||
  import.meta.env.VITE_DEBUG_BO_MENU === 'true' ||
  import.meta.env.VITE_DEBUG_BO_MENU === '1'

const PREFIX = '[bo-menu]'

export function boMenuLog(...args: unknown[]) {
  if (!boMenuDebugEnabled) return
  console.log(PREFIX, ...args)
}

export function boMenuGroup(label: string, fn: () => void) {
  if (!boMenuDebugEnabled) {
    fn()
    return
  }
  console.groupCollapsed(`${PREFIX} ${label}`)
  try {
    fn()
  } finally {
    console.groupEnd()
  }
}

export function boMenuTable(label: string, rows: Record<string, unknown>[]) {
  if (!boMenuDebugEnabled) return
  console.log(PREFIX, label)
  if (rows.length === 0) console.log(PREFIX, '(sin filas)')
  else console.table(rows)
}

export function boMenuJson(label: string, value: unknown) {
  if (!boMenuDebugEnabled) return
  console.log(PREFIX, label, JSON.stringify(value, null, 2))
}
