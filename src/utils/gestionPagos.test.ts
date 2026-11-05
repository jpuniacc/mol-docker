import { describe, expect, it } from 'vitest'
import {
  aplicaFiltroAntiguedad,
  bucketAntiguedad,
  diasDesdePago,
  filasGestionPagosACsv,
  filasGestionPagosAMatriz,
  parseFilaGestionPagos,
  porCarreraGestionPagos,
  resumirAntiguedad,
  telefonoWhatsAppUrl,
  type FilaGestionPagos,
} from './gestionPagos'

const ahora = new Date('2026-11-05T18:00:00.000Z')

function fila(parcial: Partial<FilaGestionPagos> & { fechaPagoMatricula: string | null }): FilaGestionPagos {
  return {
    codcli: '1',
    rut: '1-9',
    nombre: 'Ana',
    carrera: 'Periodismo',
    telefono: '',
    email: '',
    ...parcial,
  }
}

describe('gestionPagos', () => {
  it('parsea snake_case del API', () => {
    const f = parseFilaGestionPagos({
      codcli: '1',
      rut: '1-9',
      nombre_alumno: 'Ana',
      nombre_carrera: 'Periodismo',
      telefono: '987654321',
      email: 'a@b.cl',
      fecha_pago_matricula: '2026-11-01T15:00:00.000Z',
    })
    expect(f?.nombre).toBe('Ana')
    expect(f?.fechaPagoMatricula).toBe('2026-11-01T15:00:00.000Z')
  })

  it('diasDesdePago y buckets', () => {
    expect(diasDesdePago('2026-11-05T10:00:00.000Z', ahora)).toBe(0)
    expect(diasDesdePago('2026-11-03T18:00:00.000Z', ahora)).toBe(2)
    expect(diasDesdePago('2026-11-01T18:00:00.000Z', ahora)).toBe(4)
    expect(diasDesdePago('2026-10-20T18:00:00.000Z', ahora)).toBe(16)
    expect(bucketAntiguedad(0)).toBe('0-2')
    expect(bucketAntiguedad(2)).toBe('0-2')
    expect(bucketAntiguedad(3)).toBe('3-7')
    expect(bucketAntiguedad(7)).toBe('3-7')
    expect(bucketAntiguedad(8)).toBe('7+')
  })

  it('resumirAntiguedad', () => {
    const r = resumirAntiguedad(
      [
        fila({ fechaPagoMatricula: '2026-11-05T12:00:00.000Z' }),
        fila({ fechaPagoMatricula: '2026-11-02T12:00:00.000Z' }),
        fila({ fechaPagoMatricula: '2026-10-20T12:00:00.000Z' }),
      ],
      ahora,
    )
    expect(r).toEqual({ total: 3, d0_2: 1, d3_7: 1, d7: 1 })
  })

  it('aplicaFiltroAntiguedad', () => {
    const f = fila({ fechaPagoMatricula: '2026-10-20T12:00:00.000Z' })
    expect(aplicaFiltroAntiguedad(f, 'todas', ahora)).toBe(true)
    expect(aplicaFiltroAntiguedad(f, '7+', ahora)).toBe(true)
    expect(aplicaFiltroAntiguedad(f, '0-2', ahora)).toBe(false)
  })

  it('porCarreraGestionPagos agrupa Otras', () => {
    const filas = [
      fila({ carrera: 'A', fechaPagoMatricula: null }),
      fila({ carrera: 'A', fechaPagoMatricula: null }),
      fila({ carrera: 'B', fechaPagoMatricula: null }),
      fila({ carrera: 'C', fechaPagoMatricula: null }),
      fila({ carrera: 'D', fechaPagoMatricula: null }),
    ]
    const r = porCarreraGestionPagos(filas, 3)
    expect(r[0]).toEqual({ carrera: 'A', n: 2 })
    expect(r.at(-1)?.carrera).toBe('Otras')
  })

  it('telefonoWhatsAppUrl', () => {
    expect(telefonoWhatsAppUrl('987654321')).toBe('https://wa.me/56987654321')
    expect(telefonoWhatsAppUrl('+56 9 8765 4321')).toBe('https://wa.me/56987654321')
    expect(telefonoWhatsAppUrl('123')).toBeNull()
  })

  it('csv incluye header y fila', () => {
    const f = parseFilaGestionPagos({
      codcli: '1',
      rut: '1-9',
      nombre_alumno: 'Ana',
      nombre_carrera: 'P',
      telefono: null,
      email: null,
      fecha_pago_matricula: null,
    })!
    const csv = filasGestionPagosACsv([f])
    expect(csv.split('\n')[0]).toContain('RUT')
    expect(csv).toContain('Ana')
  })

  it('matriz excel tiene header', () => {
    expect(filasGestionPagosAMatriz([])[0][0]).toBe('RUT')
  })
})
