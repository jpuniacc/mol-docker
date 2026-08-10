export type AuthOrigin = 1 | 2

export type LoginSuccess = {
  ok: true
  authSource: 'mv_ldap' | 'pixarron'
  email: string
  localPart: string
  mvUsuario: Record<string, any> | null
  tipoPixarron: string | null
}

export type LoginFailure = { ok: false; message: string }
export type LoginResult = LoginSuccess | LoginFailure

export async function runLoginFlow(
  username: string,
  passwordB64: string,
  urlOrigen: string | null = null,
  origin: AuthOrigin = (Number(import.meta.env.VITE_AUTH_ORIGIN) as AuthOrigin) || 1
): Promise<LoginResult> {
  let res: Response;
  try {
    res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: '1',
        origin,
        ambiente: Number(import.meta.env.VITE_AUTH_AMBIENTE) || 1,
        credentials: {
          username,
          // La vista pasa btoa(pass) por compatibilidad previa; 
          // la API Objective requiere contraseña_en_claro
          password: atob(passwordB64)
        },
        meta: {
          urlOrigen,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
        }
      })
    });
  } catch (err) {
    return { ok: false, message: 'No se pudo conectar con el servicio de autenticación' };
  }

  try {
    return await res.json();
  } catch (err) {
    return { ok: false, message: 'Respuesta inválida del servicio' };
  }
}
