import type { BecaUniacc } from './beca'
import type { CarreraUniacc } from './carrera'
import type { Prospecto } from './prospecto'

/**
 * Esquema público del proyecto Supabase del simulador de becas (distinto del Supabase local de rematrícula).
 * Solo lo usa `supabaseSimuladorClient` y `useProspectos`.
 */
export type DatabaseSimulador = {
  public: {
    Tables: {
      prospectos: {
        Row: Prospecto
        Insert: Partial<Prospecto>
        Update: Partial<Prospecto>
        Relationships: []
      }
      carreras_uniacc: {
        Row: CarreraUniacc
        Insert: Partial<CarreraUniacc>
        Update: Partial<CarreraUniacc>
        Relationships: []
      }
      becas_uniacc: {
        Row: BecaUniacc
        Insert: Partial<BecaUniacc>
        Update: Partial<BecaUniacc>
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
