### Task 3: Cliente alumno (estado + guardar)

**Files:**
- Create: `src/services/npsRematriculaApi.ts`
- Create: `src/services/npsRematriculaApi.test.ts` (mock de `supabase.rpc` si el repo ya mockea en otros services; si no hay patrón de mock, omitir este test y cubrir vía util + smoke manual)

**Interfaces:**
- Produces:
  - `export type EstadoNpsRematricula = { respondio: boolean; calificacion: CalificacionNps | null }`
  - `export type GuardarNpsRematriculaPayload = { rutAlumno: string; codcli: string; codigoCarrera: string; jornada: string; anioPeriodo: number; semestrePeriodo: number; calificacion: CalificacionNps; comentario?: string | null; periodoLabel?: string | null; sesionId?: string | null }`
  - `export async function estadoNpsRematricula(codcli, anio, semestre): Promise<EstadoNpsRematricula | { error: string }>`
  - `export async function guardarNpsRematricula(payload): Promise<null | string>` → `null` ok, `string` mensaje error

- [ ] **Step 1: Implementar** siguiendo `src/services/discapacidadEncuesta.ts`:

```ts
import { supabase } from '@/services/supabaseClient'
import {
  esCalificacionNps,
  normalizarComentarioNps,
  type CalificacionNps,
} from '@/utils/npsRematricula'

export type EstadoNpsRematricula = {
  respondio: boolean
  calificacion: CalificacionNps | null
}

export type GuardarNpsRematriculaPayload = {
  rutAlumno: string
  codcli: string
  codigoCarrera: string
  jornada: string
  anioPeriodo: number
  semestrePeriodo: number
  calificacion: CalificacionNps
  comentario?: string | null
  periodoLabel?: string | null
  sesionId?: string | null
}

export async function estadoNpsRematricula(
  codcli: string,
  anioPeriodo: number,
  semestrePeriodo: number,
): Promise<EstadoNpsRematricula | { error: string }> {
  const { data, error } = await supabase.rpc('estado_mnp_nps_rematricula', {
    p_codcli: codcli,
    p_anio_periodo: anioPeriodo,
    p_semestre_periodo: semestrePeriodo,
  })
  if (error) return { error: error.message }
  const rec = (data ?? {}) as { respondio?: unknown; calificacion?: unknown }
  const cal =
    typeof rec.calificacion === 'number' && esCalificacionNps(rec.calificacion)
      ? rec.calificacion
      : null
  return { respondio: rec.respondio === true, calificacion: cal }
}

export async function guardarNpsRematricula(
  payload: GuardarNpsRematriculaPayload,
): Promise<string | null> {
  const comentario = normalizarComentarioNps(payload.calificacion, payload.comentario)
  const { error } = await supabase.rpc('guardar_mnp_nps_rematricula', {
    p_rut_alumno: payload.rutAlumno,
    p_codcli: payload.codcli,
    p_codigo_carrera: payload.codigoCarrera,
    p_jornada: payload.jornada,
    p_anio_periodo: payload.anioPeriodo,
    p_semestre_periodo: payload.semestrePeriodo,
    p_calificacion: payload.calificacion,
    p_comentario: comentario,
    p_periodo_label: payload.periodoLabel ?? null,
    p_sesion_id: payload.sesionId ?? null,
    p_url_origen: typeof window !== 'undefined' ? window.location.href : null,
  })
  if (error) return error.message
  return null
}
```

- [ ] **Step 2: Smoke manual** tras Task 4 (guardar dos veces el mismo codcli/periodo debe fallar con mensaje de unicidad).

- [ ] **Step 3: Commit** (solo si el usuario lo pide)

---

