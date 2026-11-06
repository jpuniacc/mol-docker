import type { Ref } from 'vue'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Patrón TanStack Table + refs (shadcn data-table). */
export function valueUpdater<T>(updaterOrValue: T | ((old: T) => T), ref: Ref<T>) {
  ref.value = typeof updaterOrValue === 'function' ? (updaterOrValue as (old: T) => T)(ref.value) : updaterOrValue
}

/**
 * Usuario de login institucional (local-part Pixarrón).
 *
 * Inventario cartera rematrícula (~4686): charset real = `a-z` + `.` + `-` + dígitos.
 * - Guión: 8 (p. ej. thannia.saint-jean, avril-max.diaz, cristobal.ruiz-tagle)
 * - Dígito: 1 (alejandra.valenzuela1)
 * - Sin `_`, sin tildes, sin `@` en el usuario
 *
 * Se permite `A-Z` por si escriben mayúsculas. Se elimina el resto (espacio, ñ, símbolos).
 */
export function sanitizeUsernameInput(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9.-]/g, '')
}
