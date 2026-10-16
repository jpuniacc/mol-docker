export type AlcanceCartera =
  | { tipo: 'completo' }
  | { tipo: 'ejecutivo'; email: string }
  | { tipo: 'sin_correo' }

export const AVISO_CARTERA_SIN_CORREO = 'Tu usuario no tiene correo para asociar la cartera.'

/** Perfil 3 ve su cartera. Perfil 1 y 2 ven la cartera completa. */
export function alcanceCartera(perfil: number | null, email: string | null | undefined): AlcanceCartera {
  if (perfil !== 3) return { tipo: 'completo' }
  const limpio = email?.trim().toLowerCase() ?? ''
  if (!limpio) return { tipo: 'sin_correo' }
  return { tipo: 'ejecutivo', email: limpio }
}
