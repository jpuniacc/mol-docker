import { describe, expect, it } from 'vitest'
import type { ContratoFirmaListRow } from '@/services/contratoFirmaApi'
import {
  aplicaFiltrosFirma,
  esPendiente48h,
  horasDesdeGenerado,
  resumirGestionFirmas,
  serieDiariaFirmas,
} from './gestionFirmas'

const ahora = new Date('2026-11-05T18:00:00.000Z')

function row(parcial: Partial<ContratoFirmaListRow> & { created_at: string; ready: boolean }): ContratoFirmaListRow {
  return {
    num_operacion: '1',
    document_id: 'd',
    rut: '1-9',
    codcli: 'c1',
    nombre: 'Ana',
    carrera: 'Psicología',
    periodo: '2027-1',
    firmantes: [],
    ...parcial,
  }
}

describe('gestionFirmas', () => {
  it('horasDesdeGenerado y +48h', () => {
    expect(horasDesdeGenerado('2026-11-05T16:00:00.000Z', ahora)).toBe(2)
    expect(esPendiente48h(row({ ready: false, created_at: '2026-11-03T17:00:00.000Z' }), ahora)).toBe(true)
    expect(esPendiente48h(row({ ready: false, created_at: '2026-11-05T10:00:00.000Z' }), ahora)).toBe(false)
    expect(esPendiente48h(row({ ready: true, created_at: '2026-11-01T10:00:00.000Z' }), ahora)).toBe(false)
  })

  it('resumirGestionFirmas', () => {
    const r = resumirGestionFirmas(
      [
        row({ ready: true, created_at: '2026-11-01T12:00:00.000Z' }),
        row({
          ready: false,
          created_at: '2026-11-01T12:00:00.000Z',
          firmantes: [
            { email: 'a@x.cl', nombre: 'A', rol: 'alumno', ready: false },
            { email: 'b@x.cl', nombre: 'B', rol: 'apoderado', ready: false },
          ],
        }),
        row({ ready: false, created_at: '2026-11-05T12:00:00.000Z' }),
      ],
      ahora,
    )
    expect(r.enviados).toBe(3)
    expect(r.firmados).toBe(1)
    expect(r.pendientes).toBe(2)
    expect(r.pendientes48h).toBe(1)
    expect(r.faltaAlumno).toBe(1)
    expect(r.faltaSostenedor).toBe(1)
  })

  it('aplicaFiltrosFirma', () => {
    const f = row({
      ready: false,
      created_at: '2026-11-01T12:00:00.000Z',
      medio_matricula: 'webpay',
      carrera: 'Derecho',
    })
    expect(
      aplicaFiltrosFirma(f, {
        estado: 'pendiente',
        busqueda: '',
        carrera: '',
        medio: 'webpay',
        antiguedad: '48h',
        ahora,
      }),
    ).toBe(true)
    expect(
      aplicaFiltrosFirma(f, {
        estado: 'firmado',
        busqueda: '',
        carrera: '',
        medio: 'todos',
        antiguedad: 'todas',
        ahora,
      }),
    ).toBe(false)
  })

  it('serieDiariaFirmas tiene largo dias', () => {
    const s = serieDiariaFirmas(
      [row({ ready: true, created_at: ahora.toISOString() })],
      14,
      ahora,
    )
    expect(s).toHaveLength(14)
    expect(s.at(-1)?.enviados).toBeGreaterThanOrEqual(1)
  })
})
