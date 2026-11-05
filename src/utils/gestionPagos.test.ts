import { describe, expect, it } from 'vitest'
import {
  filasGestionPagosACsv,
  filasGestionPagosAMatriz,
  parseFilaGestionPagos,
} from './gestionPagos'

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
