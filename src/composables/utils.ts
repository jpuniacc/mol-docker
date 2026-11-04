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
 * Usuario de login: solo `a-z`, `A-Z`, `0-9`, `.` y `-` (sin ñ, tildes ni otros caracteres).
 * Guión y dígitos forman parte del local-part institucional
 * (p. ej. thannia.saint-jean, alejandra.valenzuela1).
 */
export function sanitizeUsernameInput(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9.-]/g, '')
}
