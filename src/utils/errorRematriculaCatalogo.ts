export type EscenaErrorRematricula = 'conexion' | 'pago' | 'firma' | 'datos'

export type ErrorRematriculaClasificado = {
  escena: EscenaErrorRematricula
  titulo: string
  cuerpo: string
  enfocarCampo: boolean
}

export const TITULO_CONEXION = 'Houston, tenemos un pequeño problema'
export const CUERPO_CONEXION =
  'No pudimos guardar tus cambios. Al parecer, el internet decidió irse a por café o nuestro servidor está estornudando. No te preocupes, tus datos siguen a salvo.'

export const TITULO_PAGO_ASIENTO = 'Este pago ya tiene asiento'
export const CUERPO_PAGO_ASIENTO =
  'La matrícula o el arancel ya quedaron autorizados. No hace falta pasar la tarjeta otra vez.'

export const TITULO_PAGO_FALLO = 'El cobro no pudo salir'
export const CUERPO_PAGO_FALLO = 'No pudimos completar el pago. Puedes intentarlo de nuevo.'

export const TITULO_FIRMA = 'La firma se quedó en el tintero'
export const CUERPO_FIRMA =
  'No pudimos enviar el contrato. Sigue guardado aquí. Podemos intentarlo de nuevo.'

export const TITULO_DATOS = 'Falta una pieza del formulario'

export const TITULO_INGRESO_CREDENCIAL = 'La puerta no quiso abrir esta vez'
export const CUERPO_INGRESO_CREDENCIAL =
  'No pudimos comprobar tus datos de acceso. Revisa tu usuario y contraseña e inténtalo nuevamente.'

export const TITULO_INGRESO_SERVIDOR = 'La puerta está un poquito atascada'
export const CUERPO_INGRESO_SERVIDOR =
  'No pudimos abrir la puerta en este momento. Inténtalo de nuevo en unos minutos.'

export function cuerpoDescargaFirma(numOperacion: string): string {
  return `No pudimos traer el contrato de la operación ${numOperacion}. El registro sigue aquí.`
}

export function clasificarErrorRematricula(
  mensaje: string,
  extra?: { numOperacion?: string },
): ErrorRematriculaClasificado {
  const texto = mensaje.trim()
  const bajo = texto.toLowerCase()
  const operacion = extra?.numOperacion?.trim()

  if (operacion) {
    return {
      escena: 'firma',
      titulo: TITULO_FIRMA,
      cuerpo: cuerpoDescargaFirma(operacion),
      enfocarCampo: false,
    }
  }

  if (bajo.includes('ya-autorizada') || bajo.includes('ya autorizada')) {
    return {
      escena: 'pago',
      titulo: TITULO_PAGO_ASIENTO,
      cuerpo: CUERPO_PAGO_ASIENTO,
      enfocarCampo: false,
    }
  }

  if (esDatos(bajo)) {
    return {
      escena: 'datos',
      titulo: TITULO_DATOS,
      cuerpo: texto,
      enfocarCampo: true,
    }
  }

  if (esFirma(bajo)) {
    return {
      escena: 'firma',
      titulo: TITULO_FIRMA,
      cuerpo: CUERPO_FIRMA,
      enfocarCampo: false,
    }
  }

  if (esPago(bajo)) {
    return {
      escena: 'pago',
      titulo: TITULO_PAGO_FALLO,
      cuerpo: CUERPO_PAGO_FALLO,
      enfocarCampo: false,
    }
  }

  return {
    escena: 'conexion',
    titulo: TITULO_CONEXION,
    cuerpo: CUERPO_CONEXION,
    enfocarCampo: false,
  }
}

export function clasificarFalloIngreso(mensaje: string): {
  titulo: string
  cuerpo: string
} {
  const bajo = mensaje.toLowerCase()
  if (
    bajo.includes('conectar') ||
    bajo.includes('servicio') ||
    bajo.includes('servidor') ||
    bajo.includes('tiempo') ||
    bajo.includes('verificar')
  ) {
    return { titulo: TITULO_INGRESO_SERVIDOR, cuerpo: CUERPO_INGRESO_SERVIDOR }
  }
  return { titulo: TITULO_INGRESO_CREDENCIAL, cuerpo: CUERPO_INGRESO_CREDENCIAL }
}

/** Vacío no abre modal: devuelve el id del primer campo que falta. */
export function campoLoginVacio(usuario: string, password: string): 'login-username' | 'login-password' | null {
  if (!usuario.trim()) return 'login-username'
  if (!password) return 'login-password'
  return null
}

function esDatos(bajo: string): boolean {
  return (
    bajo.startsWith('selecciona') ||
    bajo.startsWith('ingresa') ||
    bajo.startsWith('indica') ||
    bajo.startsWith('elige') ||
    bajo.startsWith('escribe') ||
    bajo.includes('inválid') ||
    bajo.includes('invalida') ||
    bajo.includes('vacío') ||
    bajo.includes('vacio') ||
    bajo.includes('día ') ||
    bajo.includes('dia ')
  )
}

function esFirma(bajo: string): boolean {
  return bajo.includes('firma') || bajo.includes('tufirma') || bajo.includes('pdf') || bajo.includes('contrato')
}

function esPago(bajo: string): boolean {
  return (
    bajo.includes('webpay') ||
    bajo.includes('monto') ||
    bajo.includes('cobro') ||
    bajo.includes('tarjeta') ||
    bajo.includes('pago')
  )
}
