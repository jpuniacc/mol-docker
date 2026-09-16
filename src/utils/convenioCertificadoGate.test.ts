import { describe, expect, it } from 'vitest'
import type { MnpCasoRematriculaRow } from '@/types/supabase'
import {
  evaluarGateMatriculaConvenios,
  matchCasoConvenioCertificado,
  estadoCertificadoConvenio,
} from './convenioCertificadoGate'

function caso(partial: Partial<MnpCasoRematriculaRow> & Pick<MnpCasoRematriculaRow, 'estado'>): MnpCasoRematriculaRow {
  return {
    id: 'c1',
    periodo: '2027-01',
    tipo: 'CONVENIO_CERTIFICADO',
    rut_alumno: null,
    codcli: 'X',
    nombre_alumno: null,
    carrera: null,
    jornada: null,
    titulo: 't',
    detalle: null,
    ref_tipo: 'convenio_documento',
    ref_id: null,
    payload: {},
    resuelto_por: null,
    resuelto_en: null,
    motivo: null,
    created_at: '',
    updated_at: '',
    ...partial,
  } as MnpCasoRematriculaRow
}

describe('matchCasoConvenioCertificado', () => {
  it('prioriza payload.convenio_id', () => {
    expect(
      matchCasoConvenioCertificado(
        caso({ payload: { convenio_id: 'conv-1' }, ref_id: 'other' }),
        { id: 'conv-1', codigoBeneficio: '1552' },
      ),
    ).toBe(true)
  })

  it('usa codigo_beneficio si no hay convenio_id', () => {
    expect(
      matchCasoConvenioCertificado(
        caso({ payload: { codigo_beneficio: '1552' } }),
        { id: 'conv-1', codigoBeneficio: '1552' },
      ),
    ).toBe(true)
  })

  it('usa ref_id vs storagePath del doc local', () => {
    expect(
      matchCasoConvenioCertificado(
        caso({ ref_id: 'path/a.pdf', payload: {} }),
        { id: 'conv-1', codigoBeneficio: null },
        'path/a.pdf',
      ),
    ).toBe(true)
  })
})

describe('evaluarGateMatriculaConvenios', () => {
  const vigente = { id: 'conv-1', codigoBeneficio: '1552' }

  it('sin vigentes → ok', () => {
    const r = evaluarGateMatriculaConvenios({ vigentes: [], casos: [], docsByConvenioId: {} })
    expect(r.puedePagarPorConvenio).toBe(true)
    expect(r.motivo).toBe('ok')
  })

  it('vigente sin doc → sin_documento', () => {
    const r = evaluarGateMatriculaConvenios({
      vigentes: [vigente],
      casos: [],
      docsByConvenioId: {},
    })
    expect(r.puedePagarPorConvenio).toBe(false)
    expect(r.motivo).toBe('sin_documento')
    expect(r.mensaje).toContain('Sube el documento')
  })

  it('doc sin caso → sin_caso (fail closed)', () => {
    const r = evaluarGateMatriculaConvenios({
      vigentes: [vigente],
      casos: [],
      docsByConvenioId: { 'conv-1': { storagePath: 'p', nombreArchivo: 'a.pdf' } },
    })
    expect(r.puedePagarPorConvenio).toBe(false)
    expect(r.motivo).toBe('sin_caso')
  })

  it('EN_REVISION → bloquea', () => {
    const r = evaluarGateMatriculaConvenios({
      vigentes: [vigente],
      casos: [caso({ estado: 'EN_REVISION', payload: { convenio_id: 'conv-1' } })],
      docsByConvenioId: { 'conv-1': { storagePath: 'p', nombreArchivo: 'a.pdf' } },
    })
    expect(r.puedePagarPorConvenio).toBe(false)
    expect(r.motivo).toBe('en_revision')
    expect(r.mensaje).toContain('en revisión')
  })

  it('RECHAZADO → bloquea con motivo', () => {
    const r = evaluarGateMatriculaConvenios({
      vigentes: [vigente],
      casos: [
        caso({
          estado: 'RECHAZADO',
          motivo: 'PDF ilegible',
          payload: { convenio_id: 'conv-1' },
        }),
      ],
      docsByConvenioId: { 'conv-1': { storagePath: 'p', nombreArchivo: 'a.pdf' } },
    })
    expect(r.puedePagarPorConvenio).toBe(false)
    expect(r.motivo).toBe('rechazado')
    expect(r.motivoRechazo).toBe('PDF ilegible')
    expect(r.mensaje).toContain('Vuelve a subir')
  })

  it('APROBADO → ok', () => {
    const r = evaluarGateMatriculaConvenios({
      vigentes: [vigente],
      casos: [caso({ estado: 'APROBADO', payload: { convenio_id: 'conv-1' } })],
      docsByConvenioId: { 'conv-1': { storagePath: 'p', nombreArchivo: 'a.pdf' } },
    })
    expect(r.puedePagarPorConvenio).toBe(true)
    expect(r.motivo).toBe('ok')
  })

  it('dos vigentes: uno APROBADO y otro EN_REVISION → bloquea', () => {
    const r = evaluarGateMatriculaConvenios({
      vigentes: [
        { id: 'conv-1', codigoBeneficio: '1552' },
        { id: 'conv-2', codigoBeneficio: '89' },
      ],
      casos: [
        caso({ id: 'a', estado: 'APROBADO', payload: { convenio_id: 'conv-1' } }),
        caso({ id: 'b', estado: 'EN_REVISION', payload: { convenio_id: 'conv-2' } }),
      ],
      docsByConvenioId: {
        'conv-1': { storagePath: 'p1', nombreArchivo: 'a.pdf' },
        'conv-2': { storagePath: 'p2', nombreArchivo: 'b.pdf' },
      },
    })
    expect(r.puedePagarPorConvenio).toBe(false)
    expect(r.motivo).toBe('en_revision')
  })
})
