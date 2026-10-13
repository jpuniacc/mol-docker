import { describe, expect, it } from 'vitest'
import {
  accionAlElegirPasoHome,
  accionAlPulsarPaso,
  type AvanceHomeAlumnoInput,
  ctaAvanceHome,
  NOMBRES_PASO_ALUMNO,
  pasoBloqueadoTrasEnvio,
  pasosAvanceHome,
  pasosListosHome,
  rutaSiEnvioFirmaBloquea,
  textoAvisoPasoCerrado,
} from '@/utils/pasoAlumnoRematricula'

describe('rutaSiEnvioFirmaBloquea', () => {
  it('no redirige antes de enviar', () => {
    expect(rutaSiEnvioFirmaBloquea(false, 'matricula-alumno-forma-pago')).toBeNull()
    expect(rutaSiEnvioFirmaBloquea(false, 'matricula-alumno-datos')).toBeNull()
  })

  it('no redirige si la ruta no es un texto', () => {
    expect(rutaSiEnvioFirmaBloquea(true, undefined)).toBeNull()
  })

  it('manda a la firma si el destino es un paso anterior', () => {
    expect(rutaSiEnvioFirmaBloquea(true, 'matricula-alumno-datos')).toBe(
      'matricula-alumno-firma',
    )
    expect(rutaSiEnvioFirmaBloquea(true, 'matricula-alumno-forma-pago')).toBe(
      'matricula-alumno-firma',
    )
  })

  it('deja pasar la firma, el resumen y el retorno de Webpay', () => {
    expect(rutaSiEnvioFirmaBloquea(true, 'matricula-alumno-firma')).toBeNull()
    expect(rutaSiEnvioFirmaBloquea(true, 'matricula-alumno-resumen')).toBeNull()
    expect(rutaSiEnvioFirmaBloquea(true, 'matricula-alumno-webpay-retorno')).toBeNull()
  })
})

describe('pasoBloqueadoTrasEnvio', () => {
  it('antes de enviar solo bloquea pasos todavía no alcanzados', () => {
    const base = { envioFirmaIniciado: false, firmaCompletada: false, pasoMaximo: 3 }
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 1 })).toBe(false)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 2 })).toBe(false)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 3 })).toBe(false)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 4 })).toBe(true)
  })

  it('después de enviar bloquea datos y forma de pago, y deja la firma', () => {
    const base = { envioFirmaIniciado: true, firmaCompletada: false, pasoMaximo: 3 }
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 1 })).toBe(true)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 2 })).toBe(true)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 3 })).toBe(false)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 4 })).toBe(true)
  })

  it('con la firma completa solo deja el resumen', () => {
    const base = { envioFirmaIniciado: true, firmaCompletada: true, pasoMaximo: 4 }
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 1 })).toBe(true)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 2 })).toBe(true)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 3 })).toBe(true)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 4 })).toBe(false)
  })
})

describe('accionAlPulsarPaso', () => {
  it('no hace nada si el paso no viene o si ya es el actual', () => {
    expect(accionAlPulsarPaso({ step: undefined, pasoActual: 2, cerrado: false })).toBe('nada')
    expect(accionAlPulsarPaso({ step: 2, pasoActual: 2, cerrado: false })).toBe('nada')
  })

  it('avisa si el paso está cerrado, aunque coincida con el actual', () => {
    expect(accionAlPulsarPaso({ step: 4, pasoActual: 2, cerrado: true })).toBe('aviso')
    expect(accionAlPulsarPaso({ step: 2, pasoActual: 2, cerrado: true })).toBe('aviso')
  })

  it('navega si el paso está abierto y es otro', () => {
    expect(accionAlPulsarPaso({ step: 1, pasoActual: 2, cerrado: false })).toBe('navegar')
  })
})

function avanceVacio(): AvanceHomeAlumnoInput {
  return {
    tycAccepted: false,
    contactoCorreoValidado: null,
    contactoTelefonoValidado: null,
    apoderadoConfirmado: null,
    discapacidad: null,
    pasoAlcanzado: 1,
    pagoMatricula: null,
    formaPagoSeleccionada: null,
    firmaCompletada: false,
    envioFirmaIniciado: false,
  }
}

describe('pasosAvanceHome', () => {
  it('deja todo pendiente si no hay avance', () => {
    const pasos = pasosAvanceHome(avanceVacio())
    expect(pasos.map((paso) => paso.estado)).toEqual([
      'pendiente',
      'pendiente',
      'pendiente',
      'pendiente',
    ])
    expect(pasosListosHome(pasos)).toBe(0)
    expect(ctaAvanceHome(pasos)).toEqual({
      label: 'Iniciar rematrícula',
      routeName: 'matricula-alumno-datos',
    })
  })

  it('con solo los términos el paso 1 queda en curso y el botón vuelve a datos', () => {
    const pasos = pasosAvanceHome({ ...avanceVacio(), tycAccepted: true })
    expect(pasos[0]).toMatchObject({ id: 'datos', estado: 'en_curso' })
    expect(pasos[1]?.estado).toBe('pendiente')
    expect(pasosListosHome(pasos)).toBe(0)
    expect(ctaAvanceHome(pasos)).toEqual({
      label: 'Continuar rematrícula',
      routeName: 'matricula-alumno-datos',
    })
  })

  it('no marca listo el paso 1 si falta la encuesta, aunque haya contacto o apoderado', () => {
    const pasos = pasosAvanceHome({
      ...avanceVacio(),
      tycAccepted: true,
      contactoCorreoValidado: 'ana@uniacc.cl',
      contactoTelefonoValidado: '987654321',
      apoderadoConfirmado: true,
    })
    expect(pasos[0]?.estado).toBe('en_curso')
    expect(pasosListosHome(pasos)).toBe(0)
    expect(ctaAvanceHome(pasos).routeName).toBe('matricula-alumno-datos')
  })

  it('marca listo el paso 1 cuando la encuesta ya abre forma de pago', () => {
    const pasos = pasosAvanceHome({
      ...avanceVacio(),
      tycAccepted: true,
      discapacidad: { contesta: false },
    })
    expect(pasos[0]?.estado).toBe('listo')
    expect(pasos[1]?.estado).toBe('en_curso')
    expect(pasosListosHome(pasos)).toBe(1)
    expect(ctaAvanceHome(pasos)).toEqual({
      label: 'Continuar rematrícula',
      routeName: 'matricula-alumno-forma-pago',
    })
  })

  it('sigue a la firma cuando la forma de pago ya está elegida', () => {
    const pasos = pasosAvanceHome({
      ...avanceVacio(),
      tycAccepted: true,
      discapacidad: { contesta: true, tipo: 'visual' },
      formaPagoSeleccionada: 'webpay',
    })
    expect(pasos.map((paso) => paso.estado)).toEqual(['listo', 'listo', 'en_curso', 'pendiente'])
    expect(ctaAvanceHome(pasos)).toEqual({
      label: 'Continuar a firma',
      routeName: 'matricula-alumno-firma',
    })
  })

  it('abre el resumen cuando la firma está completa', () => {
    const pasos = pasosAvanceHome({
      ...avanceVacio(),
      tycAccepted: true,
      discapacidad: { contesta: false },
      formaPagoSeleccionada: 'pagare',
      firmaCompletada: true,
      pasoAlcanzado: 4,
    })
    expect(pasos.map((paso) => paso.estado)).toEqual(['listo', 'listo', 'listo', 'listo'])
    expect(pasosListosHome(pasos)).toBe(4)
    expect(ctaAvanceHome(pasos)).toEqual({
      label: 'Ver resumen',
      routeName: 'matricula-alumno-resumen',
    })
  })

  it('marca la forma de pago lista cuando las dos Webpay ya están autorizadas y la firma también', () => {
    const pasos = pasosAvanceHome({
      ...avanceVacio(),
      tycAccepted: true,
      discapacidad: { contesta: false },
      firmaCompletada: true,
      envioFirmaIniciado: true,
      pasoAlcanzado: 3,
      medioMatricula: 'webpay',
      medioArancel: 'webpay',
      webpayMatriculaEstado: 'autorizada',
      webpayArancelEstado: 'autorizada',
    })
    expect(pasos.map((paso) => paso.estado)).toEqual(['listo', 'listo', 'listo', 'listo'])
    expect(pasosListosHome(pasos)).toBe(4)
  })
})

describe('accionAlElegirPasoHome', () => {
  it('abre un paso en curso y avisa si el siguiente no está abierto', () => {
    const input = { ...avanceVacio(), tycAccepted: true }
    expect(accionAlElegirPasoHome(input, 'datos')).toEqual({
      tipo: 'navegar',
      routeName: 'matricula-alumno-datos',
    })
    expect(accionAlElegirPasoHome(input, 'pago')).toEqual({
      tipo: 'aviso',
      texto: 'Estás en Datos personales y TyC. Forma de pago no está abierto.',
    })
    expect(accionAlElegirPasoHome(input, 'firma')).toEqual({
      tipo: 'aviso',
      texto: 'Estás en Datos personales y TyC. Firma de contrato no está abierto.',
    })
  })

  it('deja ir a forma de pago cuando el paso 1 está listo, y avisa en la firma', () => {
    const input = {
      ...avanceVacio(),
      tycAccepted: true,
      discapacidad: { contesta: false },
    }
    expect(accionAlElegirPasoHome(input, 'pago')).toEqual({
      tipo: 'navegar',
      routeName: 'matricula-alumno-forma-pago',
    })
    expect(accionAlElegirPasoHome(input, 'firma').tipo).toBe('aviso')
  })

  it('deja ir a la firma cuando la forma de pago ya está elegida', () => {
    const input = {
      ...avanceVacio(),
      tycAccepted: true,
      discapacidad: { contesta: false },
      formaPagoSeleccionada: 'webpay',
    }
    expect(accionAlElegirPasoHome(input, 'firma')).toEqual({
      tipo: 'navegar',
      routeName: 'matricula-alumno-firma',
    })
  })

  it('avisa si se pulsa un paso ya recorrido después de enviar a firmar', () => {
    const input = {
      ...avanceVacio(),
      tycAccepted: true,
      discapacidad: { contesta: false },
      formaPagoSeleccionada: 'pagare',
      envioFirmaIniciado: true,
      pasoAlcanzado: 3,
    }
    expect(accionAlElegirPasoHome(input, 'pago')).toEqual({
      tipo: 'aviso',
      texto: 'Estás en Firma de contrato. Forma de pago no está abierto.',
    })
  })
})

describe('textoAvisoPasoCerrado', () => {
  it('nombra el paso actual y el pulsado, sin decir todavía', () => {
    expect(NOMBRES_PASO_ALUMNO).toEqual([
      'Datos personales',
      'Forma de pago',
      'Firma de contrato',
      'Resumen final',
    ])
    expect(textoAvisoPasoCerrado('Forma de pago', 'Resumen final')).toBe(
      'Estás en Forma de pago. Resumen final no está abierto.',
    )
    expect(textoAvisoPasoCerrado('Forma de pago', 'Resumen final')).not.toContain('todavía')
  })
})
