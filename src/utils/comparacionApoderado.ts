export type DatoApoderado = {
  nombre: string
  telefono: string
  email: string
}

export function datoVisible(value: string | null | undefined): string {
  const texto = value?.trim() ?? ''
  return texto.length > 0 ? texto : '—'
}

export function antiguoDesdePayload(
  payload: Record<string, unknown> | null | undefined,
): DatoApoderado {
  const texto = (key: string): string => {
    const value = payload?.[key]
    return typeof value === 'string' ? value : ''
  }
  return {
    nombre: texto('apoderadoNombre'),
    telefono: texto('apoderadoTelefono'),
    email: texto('apoderadoEmail'),
  }
}

export function cierraCasoTrasConfirmar(result: {
  ok: boolean
  avisoId?: string | null
}): boolean {
  return result.ok && typeof result.avisoId === 'string' && result.avisoId.length > 0
}
