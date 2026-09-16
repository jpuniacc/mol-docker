/** RUT chileno sin puntos ni guion, DV en mayúscula. */
export function rutNorm(s: string | null | undefined): string {
  return (s ?? '').toUpperCase().replace(/[^0-9K]/g, '')
}
