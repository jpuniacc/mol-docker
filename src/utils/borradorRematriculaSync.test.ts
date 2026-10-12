import { describe, expect, it } from 'vitest'
import { claveBorradorValida, decidirBorrador } from '@/utils/borradorRematriculaSync'

describe('decidirBorrador', () => {
  it('usa el servidor si la sesión no tiene avance', () => {
    expect(
      decidirBorrador({
        sesionTieneAvance: false,
        pendienteDeSubir: false,
        sesionActualizadoEn: null,
        servidorActualizadoEn: '2026-10-11T12:00:00.000Z',
      }),
    ).toBe('usar-servidor')
  })

  it('sube la sesión si todavía no hay fila', () => {
    expect(
      decidirBorrador({
        sesionTieneAvance: true,
        pendienteDeSubir: false,
        sesionActualizadoEn: null,
        servidorActualizadoEn: null,
      }),
    ).toBe('subir-sesion')
  })

  it('no hace nada si no hay avance ni fila', () => {
    expect(
      decidirBorrador({
        sesionTieneAvance: false,
        pendienteDeSubir: false,
        sesionActualizadoEn: null,
        servidorActualizadoEn: null,
      }),
    ).toBe('nada')
  })

  it('el servidor gana si es más reciente y la sesión ya estaba confirmada', () => {
    expect(
      decidirBorrador({
        sesionTieneAvance: true,
        pendienteDeSubir: false,
        sesionActualizadoEn: '2026-10-11T12:00:00.000Z',
        servidorActualizadoEn: '2026-10-11T13:00:00.000Z',
      }),
    ).toBe('usar-servidor')
  })

  it('una sesión sin fecha confirmada cede ante el servidor', () => {
    expect(
      decidirBorrador({
        sesionTieneAvance: true,
        pendienteDeSubir: false,
        sesionActualizadoEn: null,
        servidorActualizadoEn: '2026-10-11T13:00:00.000Z',
      }),
    ).toBe('usar-servidor')
  })

  it('los cambios locales sin confirmar se suben aunque el servidor sea más nuevo', () => {
    expect(
      decidirBorrador({
        sesionTieneAvance: true,
        pendienteDeSubir: true,
        sesionActualizadoEn: '2026-10-11T12:00:00.000Z',
        servidorActualizadoEn: '2026-10-11T13:00:00.000Z',
      }),
    ).toBe('subir-sesion')
  })

  it('no toca nada si ambas copias tienen la misma fecha', () => {
    expect(
      decidirBorrador({
        sesionTieneAvance: true,
        pendienteDeSubir: false,
        sesionActualizadoEn: '2026-10-11T12:00:00.000Z',
        servidorActualizadoEn: '2026-10-11T12:00:00.000Z',
      }),
    ).toBe('nada')
  })
})

describe('claveBorradorValida', () => {
  it('rechaza codcli vacío o el guion de pantalla', () => {
    expect(claveBorradorValida('—', 2027, 1)).toBeNull()
    expect(claveBorradorValida('  ', 2027, 1)).toBeNull()
    expect(claveBorradorValida('20261', null, 1)).toBeNull()
  })

  it('acepta codcli y periodo', () => {
    expect(claveBorradorValida(' 20261 ', 2027, 1)).toEqual({
      codcli: '20261',
      anio: 2027,
      semestre: 1,
    })
  })
})
