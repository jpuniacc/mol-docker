import { describe, expect, it } from 'vitest'

import type { PlanPagosMvRow } from '@/types/supabase'
import {
  buildDefaultForm,
  calcDescuentoCatalogo,
  calcularSimulacion,
} from '@/utils/simuladorPlanPago'

const baseRow: PlanPagosMvRow = {
  codcli: 'TEST001',
  rut: '11111111-1',
  nombre_alumno: 'Juan',
  apellido_paterno_alumno: 'Pérez',
  apellido_materno_alumno: null,
  rut_apoder: null,
  nombre_apoderado: null,
  apellido_paterno_apoderado: null,
  apellido_materno_apoderado: null,
  estado_academico: 'VIGENTE',
  ano_ingreso: 2025,
  periodo_ingreso: 1,
  categoria_alumno: null,
  jornada_carrera: 'AD',
  cod_carrera: 'PSIC1',
  carrera: 'PSICOLOGÍA',
  codigo_planestudio: null,
  nombre_planestudios: null,
  direccion: null,
  comuna: null,
  ciudad: null,
  mail: null,
  telefono: null,
  telefono_apoderado: null,
  discapacidad: null,
  ramos_aprobados: null,
  ramos_reprobados: null,
  ult_matricula: null,
  prom_ultimo_periodo: null,
  prom_anio: null,
  precio_matricula: 250000,
  cuotas_matricula: 10,
  doc_pago_matricula: null,
  precio_arancel: 3810000,
  cuotas_arancel: 10,
  doc_pago_arancel: null,
  monto_beneficio_matricula: 0,
  monto_beneficio_arancel: 0,
  beneficios_detalle: [],
  anio_matricula: 2026,
  periodo_matricula: 1,
  periodo: '2026-1',
  synced_at: new Date().toISOString(),
  nombre_carrera: 'PSICOLOGÍA',
  monto_matricula: 250000,
  monto_arancel: 3810000,
  cuota_matricula: 10,
  cuota_arancel: 10,
  beca_matricula: 0,
  beca_arancel: 0,
  valor_total_matricula: 250000,
  valor_total_arancel: 3810000,
  alumno_cae: 'No',
  tiene_beneficio: 'No',
}

const catalogos = {
  tiposPago: [
    {
      id: 'tp-m',
      codigo: 'MANDATO',
      nombre: 'Mandato',
      concepto: 'MATRICULA' as const,
      cuotas_max: 12,
      activo: true,
      orden: 10,
      created_at: '',
    },
    {
      id: 'tp-a',
      codigo: 'MANDATO',
      nombre: 'Mandato',
      concepto: 'ARANCEL' as const,
      cuotas_max: 12,
      activo: true,
      orden: 10,
      created_at: '',
    },
  ],
  convenios: [
    {
      id: 'c0',
      codigo: '0',
      nombre: 'Sin',
      concepto: 'AMBOS' as const,
      tipo_descuento: 'MONTO' as const,
      valor_descuento: 0,
      activo: true,
      orden: 0,
      created_at: '',
    },
  ],
  becasEstado: [
    {
      id: 'b0',
      codigo: 'SIN_BECA',
      nombre: 'Sin',
      concepto: 'AMBOS' as const,
      tipo_descuento: 'MONTO' as const,
      valor_descuento: 0,
      activo: true,
      orden: 0,
      created_at: '',
    },
  ],
}

describe('calcDescuentoCatalogo', () => {
  it('aplica porcentaje', () => {
    expect(calcDescuentoCatalogo(1000, 'PORCENTAJE', 10)).toBe(100)
  })
  it('aplica monto fijo', () => {
    expect(calcDescuentoCatalogo(1000, 'MONTO', 200)).toBe(200)
  })
})

describe('calcularSimulacion', () => {
  it('calcula valor cuota neto / cuotas', () => {
    const form = buildDefaultForm(baseRow, {
      diasValidez: 30,
      tiposPago: catalogos.tiposPago,
      convenios: catalogos.convenios,
      becas: catalogos.becasEstado,
    })
    form.tipo_pago_matricula_id = 'tp-m'
    form.tipo_pago_arancel_id = 'tp-a'
    const r = calcularSimulacion(baseRow, form, catalogos)
    expect(r.matricula.neto).toBe(250000)
    expect(r.matricula.valor_cuota).toBe(25000)
    expect(r.arancel.neto).toBe(3810000)
    expect(r.arancel.valor_cuota).toBe(381000)
    expect(r.totales.monto_neto_financiar).toBe(4060000)
  })

  it('aplica descuento por convenio porcentaje en arancel', () => {
    const convenios = [
      ...catalogos.convenios,
      {
        id: 'c10',
        codigo: '10',
        nombre: 'Empresa 10%',
        concepto: 'ARANCEL' as const,
        tipo_descuento: 'PORCENTAJE' as const,
        valor_descuento: 10,
        activo: true,
        orden: 10,
        created_at: '',
      },
    ]
    const form = buildDefaultForm(baseRow, {
      diasValidez: 30,
      tiposPago: catalogos.tiposPago,
      convenios,
      becas: catalogos.becasEstado,
    })
    form.tipo_pago_matricula_id = 'tp-m'
    form.tipo_pago_arancel_id = 'tp-a'
    form.convenio_id = 'c10'
    const r = calcularSimulacion(baseRow, form, { ...catalogos, convenios })
    expect(r.arancel.convenio).toBe(381000)
    expect(r.arancel.neto).toBe(3429000)
  })

  it('aplica el convenio solo al arancel aunque el concepto sea MATRICULA', () => {
    const convenios = [
      ...catalogos.convenios,
      {
        id: 'cm',
        codigo: '20',
        nombre: 'Convenio matrícula 10%',
        concepto: 'MATRICULA' as const,
        tipo_descuento: 'PORCENTAJE' as const,
        valor_descuento: 10,
        activo: true,
        orden: 20,
        created_at: '',
      },
    ]
    const form = buildDefaultForm(baseRow, {
      diasValidez: 30,
      tiposPago: catalogos.tiposPago,
      convenios,
      becas: catalogos.becasEstado,
    })
    form.tipo_pago_matricula_id = 'tp-m'
    form.tipo_pago_arancel_id = 'tp-a'
    form.convenio_id = 'cm'
    const r = calcularSimulacion(baseRow, form, { ...catalogos, convenios })
    expect(r.matricula.convenio).toBe(0)
    expect(r.matricula.neto).toBe(250000)
    expect(r.arancel.convenio).toBe(381000)
    expect(r.arancel.neto).toBe(3429000)
  })

  it('descuenta beneficio ERP de matrícula', () => {
    const row = {
      ...baseRow,
      beca_matricula: 50000,
      valor_total_matricula: 200000,
    }
    const form = buildDefaultForm(row, {
      diasValidez: 30,
      tiposPago: catalogos.tiposPago,
      convenios: catalogos.convenios,
      becas: catalogos.becasEstado,
    })
    form.tipo_pago_matricula_id = 'tp-m'
    form.tipo_pago_arancel_id = 'tp-a'
    const r = calcularSimulacion(row, form, catalogos)
    expect(r.matricula.beneficio_erp).toBe(50000)
    expect(r.matricula.neto).toBe(200000)
  })
})
