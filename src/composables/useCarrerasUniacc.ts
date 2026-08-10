import { ref } from 'vue'

import { supabaseSimuladorClient } from '@/services/supabaseSimuladorClient'
import type { CarreraUniacc } from '@/types/carrera'

export type CarreraOperativaInput = {
  anio: number
  codigo_carrera: string | null
  nombre_programa: string
  nivel_academico: string | null
  modalidad_programa: string | null
  duracion_programa: string
  facultad: string
  matricula: number
  arancel: number
  arancel_referencia: number
  anio_arancel_referencia: number
  version_simulador: number
}

function trimOrNull(value: string): string | null {
  const v = value.trim()
  return v.length > 0 ? v : null
}

export function useCarrerasUniacc() {
  const loading = ref(false)

  async function fetchCarreras(): Promise<{ data: CarreraUniacc[]; error: Error | null }> {
    loading.value = true
    try {
      const { data, error } = await supabaseSimuladorClient
        .from('carreras_uniacc')
        .select('*')
        .gte('version_simulador', 10)
        .order('anio', { ascending: false })
        .order('nombre_programa', { ascending: true })
        

      if (error) throw error
      return { data: (data ?? []) as CarreraUniacc[], error: null }
    } catch (error) {
      return {
        data: [],
        error: error instanceof Error ? error : new Error('Error al cargar carreras'),
      }
    } finally {
      loading.value = false
    }
  }

  async function createCarrera(input: CarreraOperativaInput): Promise<{ error: Error | null }> {
    const payload = {
      anio: Number(input.anio),
      codigo_carrera: trimOrNull(input.codigo_carrera ?? ''),
      nombre_programa: input.nombre_programa.trim(),
      nivel_academico: trimOrNull(input.nivel_academico ?? ''),
      modalidad_programa: trimOrNull(input.modalidad_programa ?? ''),
      duracion_programa: input.duracion_programa.trim(),
      facultad: input.facultad.trim(),
      matricula: Number(input.matricula),
      arancel: Number(input.arancel),
      arancel_referencia: Number(input.arancel_referencia),
      anio_arancel_referencia: Number(input.anio_arancel_referencia),
      version_simulador: Number(input.version_simulador),
      // Campos no operativos: mantener valores mínimos para cumplir esquema
      descripcion_programa: '',
      requisitos_ingreso: '',
      malla: '',
    }

    const { error } = await supabaseSimuladorClient.from('carreras_uniacc').insert(payload)
    return {
      error: error ? (error instanceof Error ? error : new Error(error.message)) : null,
    }
  }

  async function updateCarrera(
    id: number,
    input: CarreraOperativaInput,
  ): Promise<{ error: Error | null }> {
    const payload = {
      anio: Number(input.anio),
      codigo_carrera: trimOrNull(input.codigo_carrera ?? ''),
      nombre_programa: input.nombre_programa.trim(),
      nivel_academico: trimOrNull(input.nivel_academico ?? ''),
      modalidad_programa: trimOrNull(input.modalidad_programa ?? ''),
      duracion_programa: input.duracion_programa.trim(),
      facultad: input.facultad.trim(),
      matricula: Number(input.matricula),
      arancel: Number(input.arancel),
      arancel_referencia: Number(input.arancel_referencia),
      anio_arancel_referencia: Number(input.anio_arancel_referencia),
      version_simulador: Number(input.version_simulador),
    }

    const { error } = await supabaseSimuladorClient.from('carreras_uniacc').update(payload).eq('id', id)
    return {
      error: error ? (error instanceof Error ? error : new Error(error.message)) : null,
    }
  }

  async function deleteCarrera(id: number): Promise<{ error: Error | null }> {
    const { error } = await supabaseSimuladorClient.from('carreras_uniacc').delete().eq('id', id)
    return {
      error: error ? (error instanceof Error ? error : new Error(error.message)) : null,
    }
  }

  return {
    loading,
    fetchCarreras,
    createCarrera,
    updateCarrera,
    deleteCarrera,
  }
}
