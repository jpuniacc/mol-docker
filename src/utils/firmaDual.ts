export const FRASE_DESPUES_APODERADO =
  'Después firma el apoderado. Si no está contigo, le llega un correo.'

export const FRASE_FALTA_APODERADO =
  'Falta la firma del apoderado. Si no está contigo, le llega un correo.'

export type EstadoFirmaDual = {
  mostrarFirmarAlumno: boolean
  mostrarFirmarApoderado: boolean
  habilitarFirmarApoderado: boolean
  frase: string | null
}

export function estadoFirmaDual(input: {
  hayApoderado: boolean
  alumnoFirmado: boolean
  apoderadoFirmado: boolean
}): EstadoFirmaDual {
  const alumnoPendiente = !input.alumnoFirmado
  const apoderadoPendiente = input.hayApoderado && !input.apoderadoFirmado
  if (alumnoPendiente && apoderadoPendiente) {
    return {
      mostrarFirmarAlumno: true,
      mostrarFirmarApoderado: true,
      habilitarFirmarApoderado: false,
      frase: FRASE_DESPUES_APODERADO,
    }
  }
  if (!alumnoPendiente && apoderadoPendiente) {
    return {
      mostrarFirmarAlumno: false,
      mostrarFirmarApoderado: true,
      habilitarFirmarApoderado: true,
      frase: FRASE_FALTA_APODERADO,
    }
  }
  if (alumnoPendiente) {
    return {
      mostrarFirmarAlumno: true,
      mostrarFirmarApoderado: false,
      habilitarFirmarApoderado: false,
      frase: null,
    }
  }
  return {
    mostrarFirmarAlumno: false,
    mostrarFirmarApoderado: false,
    habilitarFirmarApoderado: false,
    frase: null,
  }
}
