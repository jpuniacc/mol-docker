import { describe, expect, it } from 'vitest'
import {
  estadoFirmaDual,
  FRASE_DESPUES_APODERADO,
  FRASE_FALTA_APODERADO,
} from '@/utils/firmaDual'

describe('estadoFirmaDual', () => {
  it('sin apoderado y con el alumno pendiente solo muestra Firmar ahora', () => {
    expect(
      estadoFirmaDual({ hayApoderado: false, alumnoFirmado: false, apoderadoFirmado: false }),
    ).toEqual({
      mostrarFirmarAlumno: true,
      mostrarFirmarApoderado: false,
      habilitarFirmarApoderado: false,
      frase: null,
    })
  })

  it('con los dos pendientes muestra los dos botones y la frase de después', () => {
    expect(
      estadoFirmaDual({ hayApoderado: true, alumnoFirmado: false, apoderadoFirmado: false }),
    ).toEqual({
      mostrarFirmarAlumno: true,
      mostrarFirmarApoderado: true,
      habilitarFirmarApoderado: false,
      frase: FRASE_DESPUES_APODERADO,
    })
  })

  it('con el alumno firmado solo deja el botón del apoderado', () => {
    expect(
      estadoFirmaDual({ hayApoderado: true, alumnoFirmado: true, apoderadoFirmado: false }),
    ).toEqual({
      mostrarFirmarAlumno: false,
      mostrarFirmarApoderado: true,
      habilitarFirmarApoderado: true,
      frase: FRASE_FALTA_APODERADO,
    })
  })

  it('si el apoderado ya firmó solo queda Firmar ahora, sin frase', () => {
    expect(
      estadoFirmaDual({ hayApoderado: true, alumnoFirmado: false, apoderadoFirmado: true }),
    ).toEqual({
      mostrarFirmarAlumno: true,
      mostrarFirmarApoderado: false,
      habilitarFirmarApoderado: false,
      frase: null,
    })
  })

  it('con los dos firmados no muestra botones ni frase', () => {
    expect(
      estadoFirmaDual({ hayApoderado: true, alumnoFirmado: true, apoderadoFirmado: true }),
    ).toEqual({
      mostrarFirmarAlumno: false,
      mostrarFirmarApoderado: false,
      habilitarFirmarApoderado: false,
      frase: null,
    })
  })
})
