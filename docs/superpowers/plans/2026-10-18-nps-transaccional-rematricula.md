# NPS transaccional de rematrícula — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar una encuesta opcional de facilidad 1–5 al finalizar la rematrícula, persistirla con contexto académico y exponer un reporte administrativo.

**Architecture:** El alumno responde desde una tarjeta en `ResumenAlumnoView` vía RPC Supabase `SECURITY DEFINER` (mismo patrón que discapacidad). El backoffice lee agregados y comentarios por `GET /api/rematricula/nps` en uniacc-api. La lógica de promedio, distribución y tasa vive en utilidades puras del front.

**Tech Stack:** Vue 3 + TypeScript + Vitest, Supabase/Postgres, Express (uniacc-api), shadcn-vue.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-18-nps-transaccional-rematricula-design.md`
- Pregunta fija: «¿Qué tan fácil fue completar tu proceso de rematrícula?»
- Escala 1–5; comentario opcional solo si calificación ∈ {1,2,3}; máximo 500 caracteres
- Omitir no persiste; una respuesta por `codcli` + periodo
- Persistencia obligatoria: `rut`, `codcli`, `codigo_carrera`, `jornada`, `anio`, `semestre`, calificación
- Solo flujo alumno real (sin mock en la primera entrega)
- Composition API; tipos explícitos; sin `any`
- No commit salvo que el usuario lo pida

## File map

| Archivo | Rol |
|---------|-----|
| `src/utils/npsRematricula.ts` | Validación, comentario, agregados |
| `src/utils/npsRematricula.test.ts` | Vitest |
| `supabase/migrations/20261018180000_mnp_nps_rematricula.sql` | Tabla, RPCs, menú BO |
| `src/types/supabase.ts` | Tipos fila + Functions |
| `src/services/npsRematriculaApi.ts` | Cliente RPC estado/guardar |
| `src/components/rematricula/NpsRematriculaCard.vue` | UI alumno |
| `src/views/matricula-alumno/ResumenAlumnoView.vue` | Monta la tarjeta |
| `/opt/uniacc-api-docker/src/services/nps-rematricula.service.ts` | Listado + finalizados |
| `/opt/uniacc-api-docker/src/services/nps-rematricula.service.test.ts` | Tests API |
| `/opt/uniacc-api-docker/src/controllers/rematricula-nps.controller.ts` | HTTP |
| `/opt/uniacc-api-docker/src/routes/rematricula-nps.routes.ts` | Ruta |
| `/opt/uniacc-api-docker/src/index.ts` | Mount |
| `src/services/npsRematriculaAdminApi.ts` | Cliente admin MOL |
| `src/views/dashboard/rematricula/NpsRematriculaView.vue` | Reporte |
| `src/router/index.ts` | Ruta dashboard |
| `src/constants/dashboardRouteNames.ts` | Nombre de ruta |
| `src/views/dashboard/layout/menuIcons.ts` | Icono menú |

---

### Task 1: Utilidades puras + tests

**Files:**
- Create: `src/utils/npsRematricula.ts`
- Create: `src/utils/npsRematricula.test.ts`

**Interfaces:**
- Produces:
  - `export type CalificacionNps = 1 | 2 | 3 | 4 | 5`
  - `export function esCalificacionNps(n: number): n is CalificacionNps`
  - `export function normalizarComentarioNps(calificacion: CalificacionNps, comentario: string | null | undefined): string | null`
  - `export function promedioNps(calificaciones: CalificacionNps[]): number | null`
  - `export function distribucionNps(calificaciones: CalificacionNps[]): Record<CalificacionNps, number>`
  - `export function tasaRespuestaNps(respuestas: number, finalizados: number): number | null`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  distribucionNps,
  esCalificacionNps,
  normalizarComentarioNps,
  promedioNps,
  tasaRespuestaNps,
} from './npsRematricula'

describe('esCalificacionNps', () => {
  it('acepta 1..5 enteros', () => {
    expect(esCalificacionNps(1)).toBe(true)
    expect(esCalificacionNps(5)).toBe(true)
    expect(esCalificacionNps(0)).toBe(false)
    expect(esCalificacionNps(6)).toBe(false)
    expect(esCalificacionNps(3.5)).toBe(false)
  })
})

describe('normalizarComentarioNps', () => {
  it('4 y 5 siempre null', () => {
    expect(normalizarComentarioNps(4, 'hola')).toBeNull()
    expect(normalizarComentarioNps(5, '  x  ')).toBeNull()
  })

  it('1-3 recorta y limita a 500', () => {
    expect(normalizarComentarioNps(2, '  mal  ')).toBe('mal')
    expect(normalizarComentarioNps(1, '   ')).toBeNull()
    expect(normalizarComentarioNps(3, 'a'.repeat(600))?.length).toBe(500)
  })
})

describe('agregados', () => {
  it('promedio y distribución', () => {
    expect(promedioNps([])).toBeNull()
    expect(promedioNps([5, 3])).toBe(4)
    expect(distribucionNps([1, 5, 5])).toEqual({ 1: 1, 2: 0, 3: 0, 4: 0, 5: 2 })
  })

  it('tasa null si no hay finalizados', () => {
    expect(tasaRespuestaNps(0, 0)).toBeNull()
    expect(tasaRespuestaNps(2, 10)).toBe(0.2)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm run test:unit -- src/utils/npsRematricula.test.ts`  
Expected: FAIL (módulo no existe)

- [ ] **Step 3: Implement**

```ts
export type CalificacionNps = 1 | 2 | 3 | 4 | 5

export function esCalificacionNps(n: number): n is CalificacionNps {
  return Number.isInteger(n) && n >= 1 && n <= 5
}

export function normalizarComentarioNps(
  calificacion: CalificacionNps,
  comentario: string | null | undefined,
): string | null {
  if (calificacion >= 4) return null
  const t = (comentario ?? '').trim()
  if (!t) return null
  return t.length > 500 ? t.slice(0, 500) : t
}

export function promedioNps(calificaciones: CalificacionNps[]): number | null {
  if (calificaciones.length === 0) return null
  const sum = calificaciones.reduce((a, b) => a + b, 0)
  return sum / calificaciones.length
}

export function distribucionNps(
  calificaciones: CalificacionNps[],
): Record<CalificacionNps, number> {
  const out: Record<CalificacionNps, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const c of calificaciones) out[c] += 1
  return out
}

export function tasaRespuestaNps(respuestas: number, finalizados: number): number | null {
  if (finalizados <= 0) return null
  return respuestas / finalizados
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm run test:unit -- src/utils/npsRematricula.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit** (solo si el usuario lo pide)

```bash
git add src/utils/npsRematricula.ts src/utils/npsRematricula.test.ts
git commit -m "feat(nps): utilidades de facilidad 1-5 para rematrícula"
```

---

### Task 2: Migración Postgres (tabla, RPCs, menú)

**Files:**
- Create: `supabase/migrations/20261018180000_mnp_nps_rematricula.sql`
- Modify: `src/types/supabase.ts` (fila `MnpNpsRematricula` + Functions)

**Interfaces:**
- Produces RPC:
  - `guardar_mnp_nps_rematricula(...) RETURNS uuid`
  - `estado_mnp_nps_rematricula(p_codcli text, p_anio integer, p_semestre integer) RETURNS jsonb` → `{ "respondio": boolean, "calificacion": number|null }`
- Tabla `public.mnp_nps_rematricula`
- Menú: id `b0000001-0001-4000-8000-000000000048`, route `dashboard-nps-rematricula`, label `NPS rematrícula`, icon `Star`, parent Rematrícula `...000020`, grupo DVU `1`, orden `30`

- [ ] **Step 1: Crear migración** con este contenido (ajustar solo si el linter SQL del repo exige otro estilo):

```sql
-- NPS transaccional de facilidad al finalizar rematrícula.

CREATE TABLE IF NOT EXISTS public.mnp_nps_rematricula (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creado_en timestamptz NOT NULL DEFAULT now(),
    rut_alumno text NOT NULL,
    codcli text NOT NULL,
    codigo_carrera text NOT NULL,
    jornada text NOT NULL,
    anio_periodo integer NOT NULL,
    semestre_periodo integer NOT NULL,
    periodo_label text NULL,
    calificacion smallint NOT NULL,
    comentario text NULL,
    sesion_id uuid NULL
        REFERENCES public.log_sesion_usuario (id) ON DELETE SET NULL,
    url_origen text NULL,
    CONSTRAINT mnp_nps_rematricula_calificacion_chk
        CHECK (calificacion BETWEEN 1 AND 5),
    CONSTRAINT mnp_nps_rematricula_comentario_chk
        CHECK (
            comentario IS NULL
            OR (
                length(comentario) <= 500
                AND calificacion BETWEEN 1 AND 3
            )
        ),
    CONSTRAINT mnp_nps_rematricula_codcli_periodo_uq
        UNIQUE (codcli, anio_periodo, semestre_periodo)
);

CREATE INDEX IF NOT EXISTS idx_mnp_nps_rematricula_periodo
    ON public.mnp_nps_rematricula (anio_periodo, semestre_periodo, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_mnp_nps_rematricula_calificacion
    ON public.mnp_nps_rematricula (calificacion);

COMMENT ON TABLE public.mnp_nps_rematricula IS
    'NPS transaccional de facilidad del flujo de rematrícula (1=muy difícil, 5=muy fácil).';

ALTER TABLE public.mnp_nps_rematricula ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mnp_nps_rematricula_no_select_anon ON public.mnp_nps_rematricula;
CREATE POLICY mnp_nps_rematricula_no_select_anon ON public.mnp_nps_rematricula
    FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS mnp_nps_rematricula_no_insert_anon ON public.mnp_nps_rematricula;
CREATE POLICY mnp_nps_rematricula_no_insert_anon ON public.mnp_nps_rematricula
    FOR INSERT TO anon WITH CHECK (false);

DROP POLICY IF EXISTS mnp_nps_rematricula_no_select_authenticated ON public.mnp_nps_rematricula;
CREATE POLICY mnp_nps_rematricula_no_select_authenticated ON public.mnp_nps_rematricula
    FOR SELECT TO authenticated USING (false);

DROP POLICY IF EXISTS mnp_nps_rematricula_no_insert_authenticated ON public.mnp_nps_rematricula;
CREATE POLICY mnp_nps_rematricula_no_insert_authenticated ON public.mnp_nps_rematricula
    FOR INSERT TO authenticated WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.guardar_mnp_nps_rematricula(
    p_rut_alumno text,
    p_codcli text,
    p_codigo_carrera text,
    p_jornada text,
    p_anio_periodo integer,
    p_semestre_periodo integer,
    p_calificacion integer,
    p_comentario text DEFAULT NULL,
    p_periodo_label text DEFAULT NULL,
    p_sesion_id uuid DEFAULT NULL,
    p_url_origen text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rut text := nullif(trim(coalesce(p_rut_alumno, '')), '');
    v_codcli text := nullif(trim(coalesce(p_codcli, '')), '');
    v_carrera text := nullif(trim(coalesce(p_codigo_carrera, '')), '');
    v_jornada text := nullif(trim(coalesce(p_jornada, '')), '');
    v_comentario text := nullif(trim(coalesce(p_comentario, '')), '');
    v_id uuid;
BEGIN
    IF v_rut IS NULL OR v_codcli IS NULL OR v_carrera IS NULL OR v_jornada IS NULL THEN
        RAISE EXCEPTION 'rut, codcli, codigo_carrera y jornada son obligatorios';
    END IF;
    IF p_anio_periodo IS NULL OR p_semestre_periodo IS NULL THEN
        RAISE EXCEPTION 'periodo inválido';
    END IF;
    IF p_calificacion IS NULL OR p_calificacion < 1 OR p_calificacion > 5 THEN
        RAISE EXCEPTION 'calificacion debe estar entre 1 y 5';
    END IF;
    IF p_calificacion >= 4 THEN
        v_comentario := NULL;
    ELSIF v_comentario IS NOT NULL AND length(v_comentario) > 500 THEN
        v_comentario := left(v_comentario, 500);
    END IF;
    IF p_url_origen IS NOT NULL AND length(p_url_origen) > 2048 THEN
        RAISE EXCEPTION 'url_origen demasiado larga';
    END IF;

    INSERT INTO public.mnp_nps_rematricula (
        rut_alumno, codcli, codigo_carrera, jornada,
        anio_periodo, semestre_periodo, periodo_label,
        calificacion, comentario, sesion_id, url_origen
    ) VALUES (
        v_rut, v_codcli, v_carrera, v_jornada,
        p_anio_periodo, p_semestre_periodo,
        nullif(trim(coalesce(p_periodo_label, '')), ''),
        p_calificacion, v_comentario, p_sesion_id,
        nullif(trim(coalesce(p_url_origen, '')), '')
    )
    RETURNING id INTO v_id;

    PERFORM public.registrar_log_mol_evento(
        p_sesion_id,
        'nps',
        'responde',
        'mnp_nps_rematricula',
        v_id,
        jsonb_build_object('calificacion', p_calificacion),
        v_rut,
        v_codcli,
        NULL,
        p_anio_periodo,
        p_semestre_periodo,
        p_periodo_label,
        p_url_origen,
        false
    );

    RETURN v_id;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'ya existe una respuesta NPS para este alumno y periodo';
END;
$$;

COMMENT ON FUNCTION public.guardar_mnp_nps_rematricula IS
    'Guarda NPS transaccional de rematrícula (una vez por codcli+periodo).';

GRANT EXECUTE ON FUNCTION public.guardar_mnp_nps_rematricula(
    text, text, text, text, integer, integer, integer, text, text, uuid, text
) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.estado_mnp_nps_rematricula(
    p_codcli text,
    p_anio_periodo integer,
    p_semestre_periodo integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_codcli text := nullif(trim(coalesce(p_codcli, '')), '');
    v_cal smallint;
BEGIN
    IF v_codcli IS NULL OR p_anio_periodo IS NULL OR p_semestre_periodo IS NULL THEN
        RETURN jsonb_build_object('respondio', false, 'calificacion', NULL);
    END IF;

    SELECT calificacion INTO v_cal
    FROM public.mnp_nps_rematricula
    WHERE codcli = v_codcli
      AND anio_periodo = p_anio_periodo
      AND semestre_periodo = p_semestre_periodo
    LIMIT 1;

    IF v_cal IS NULL THEN
        RETURN jsonb_build_object('respondio', false, 'calificacion', NULL);
    END IF;

    RETURN jsonb_build_object('respondio', true, 'calificacion', v_cal);
END;
$$;

GRANT EXECUTE ON FUNCTION public.estado_mnp_nps_rematricula(text, integer, integer)
    TO anon, authenticated, service_role;

INSERT INTO public.bo_menu_item (
  id, parent_id, tipo, label, route_name, icon_key, orden, activo
) VALUES (
  'b0000001-0001-4000-8000-000000000048',
  'b0000001-0001-4000-8000-000000000020',
  'link',
  'NPS rematrícula',
  'dashboard-nps-rematricula',
  'Star',
  30,
  true
) ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  tipo = EXCLUDED.tipo,
  label = EXCLUDED.label,
  route_name = EXCLUDED.route_name,
  icon_key = EXCLUDED.icon_key,
  orden = EXCLUDED.orden,
  activo = EXCLUDED.activo;

INSERT INTO public.bo_menu_item_grupo (menu_item_id, codigo_grupo)
VALUES ('b0000001-0001-4000-8000-000000000048', 1)
ON CONFLICT (menu_item_id, codigo_grupo) DO NOTHING;
```

- [ ] **Step 2: Tipar en `src/types/supabase.ts`**

Agregar interfaz fila:

```ts
export type MnpNpsRematricula = {
  id: string
  creado_en: string
  rut_alumno: string
  codcli: string
  codigo_carrera: string
  jornada: string
  anio_periodo: number
  semestre_periodo: number
  periodo_label: string | null
  calificacion: number
  comentario: string | null
  sesion_id: string | null
  url_origen: string | null
}
```

Y en `Functions` del Database tipado (mismo bloque que `guardar_mnp_discapacidad_encuesta`):

```ts
guardar_mnp_nps_rematricula: {
  Args: {
    p_rut_alumno: string
    p_codcli: string
    p_codigo_carrera: string
    p_jornada: string
    p_anio_periodo: number
    p_semestre_periodo: number
    p_calificacion: number
    p_comentario?: string | null
    p_periodo_label?: string | null
    p_sesion_id?: string | null
    p_url_origen?: string | null
  }
  Returns: string
}
estado_mnp_nps_rematricula: {
  Args: {
    p_codcli: string
    p_anio_periodo: number
    p_semestre_periodo: number
  }
  Returns: Json
}
```

- [ ] **Step 3: Aplicar migración** en el entorno local/test del equipo (comando habitual del repo; no inventar reset destructivo).

- [ ] **Step 4: Commit** (solo si el usuario lo pide)

---

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

### Task 4: Tarjeta en resumen del alumno

**Files:**
- Create: `src/components/rematricula/NpsRematriculaCard.vue`
- Modify: `src/views/matricula-alumno/ResumenAlumnoView.vue`

**Interfaces:**
- Consumes: `estadoNpsRematricula`, `guardarNpsRematricula`, `useDatosAlumnoMnpStore().primeraFila`, `usePeriodoActivoStore()`, `useMatriculaAlumnoContextStore().sesionId`
- Produces: UI no bloqueante; descarga del contrato intacta

- [ ] **Step 1: Crear `NpsRematriculaCard.vue`**

Comportamiento:
1. Al montar, si hay `codcli` + periodo, llama `estadoNpsRematricula`.
2. Si `respondio`, muestra «Gracias, ya registramos tu evaluación.» y no el formulario.
3. Si no, muestra título «Evalúa tu experiencia», la pregunta del spec, botones 1–5 (`cursor-pointer`), botón secundario «Ahora no» que solo oculta la tarjeta en la sesión (`omitidoLocal = true` sin POST).
4. Si elige 1–3, muestra `Textarea` opcional (maxlength 500).
5. Botón «Enviar evaluación» llama `guardarNpsRematricula` con `rut_alumno`, `codcli`, `codigo_carrera`, `jornada_carrera` (como `jornada`) desde `primeraFila`, y periodo activo.
6. Si faltan campos obligatorios, no enviar; mostrar mensaje «No pudimos preparar la evaluación. Reintenta más tarde.»
7. Error de guardado: toast/mensaje + permitir reintento manteniendo selección.
8. Éxito: pasar a estado confirmado.

Copy de escala bajo los botones: «1 = muy difícil · 5 = muy fácil».

Usar componentes `Card`, `Button`, `Textarea` de `src/components/ui/`. No usar Options API.

- [ ] **Step 2: Montar en `ResumenAlumnoView.vue`**

Insertar la tarjeta **después** del bloque de datos (RUT/carrera/codcli) y **antes** de la sección de pagos Webpay / plan / botón descargar, para que la descarga siga visible y usable:

```vue
<NpsRematriculaCard />
```

Importar el componente en el `<script setup>`.

- [ ] **Step 3: Verificar manualmente**

1. Resumen sin respuesta → ve tarjeta; «Ahora no» la oculta; refresh la vuelve a mostrar.
2. Respuesta 5 → confirma; refresh → solo gracias.
3. Respuesta 2 con comentario → guarda; admin (Task 6) lo verá.
4. Descargar contrato sigue funcionando con o sin respuesta.

- [ ] **Step 4: Commit** (solo si el usuario lo pide)

---

### Task 5: API admin en uniacc-api

**Files (repo `/opt/uniacc-api-docker`):**
- Create: `src/services/nps-rematricula.service.ts`
- Create: `src/services/nps-rematricula.service.test.ts`
- Create: `src/controllers/rematricula-nps.controller.ts`
- Create: `src/routes/rematricula-nps.routes.ts`
- Modify: `src/index.ts`

**Interfaces:**
- `GET /api/rematricula/nps?anio=&semestre=&emailEjecutivo=`
- Response:

```ts
{
  ok: true
  anio: number
  semestre: number
  totalRespuestas: number
  totalFinalizados: number
  filas: Array<{
    id: string
    creadoEn: string
    rut: string | null
    codcli: string
    codigoCarrera: string
    jornada: string
    calificacion: number
    comentario: string | null
  }>
}
```

`totalFinalizados`: count en `mnp_progreso_rematricula` del periodo con `excluido_mol = false`, `sin_match_mol = false` y `etapa_actual IN ('firma','matriculado')`.

Filtro cartera ejecutivo: mismo patrón que encuesta discapacidad (`emailEjecutivoDeQuery` + `rutsDeEjecutivo` + filtrar por `rut`).

- [ ] **Step 1: Test de mapeo/filtro puro** (extraer helpers si hace falta)

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { filtrarComentariosBajos } from './nps-rematricula.service'

describe('filtrarComentariosBajos', () => {
  it('solo 1-3 con comentario', () => {
    const out = filtrarComentariosBajos([
      { calificacion: 5, comentario: 'ok' },
      { calificacion: 2, comentario: 'lento' },
      { calificacion: 1, comentario: null },
    ])
    assert.equal(out.length, 1)
    assert.equal(out[0]?.comentario, 'lento')
  })
})
```

Exportar `filtrarComentariosBajos` desde el service (el front también puede filtrar; este helper documenta la regla del spec para comentarios del reporte).

- [ ] **Step 2: Implementar service** leyendo Postgres con el cliente que ya usa `encuesta-discapacidad.service.ts` (mismo pool/supabase admin).

Query respuestas:

```sql
SELECT id, creado_en, rut_alumno, codcli, codigo_carrera, jornada,
       calificacion, comentario
FROM public.mnp_nps_rematricula
WHERE anio_periodo = $1 AND semestre_periodo = $2
ORDER BY creado_en DESC
```

Query finalizados:

```sql
SELECT count(*)::int AS n
FROM public.mnp_progreso_rematricula
WHERE anio_periodo = $1 AND semestre_periodo = $2
  AND excluido_mol = false
  AND sin_match_mol = false
  AND etapa_actual IN ('firma', 'matriculado')
```

Si no hay `anio`/`semestre` en query, usar periodo activo igual que otros endpoints de rematrícula (revisar `encuesta-discapacidad` / periodo; si discapacidad no filtra periodo, aceptar query obligatoria `anio`+`semestre` desde el front con `usePeriodoActivoStore`).

- [ ] **Step 3: Controller + route + mount**

```ts
// routes
router.get('/', listarNpsRematriculaHttp)
// index.ts
app.use('/api/rematricula/nps', rematriculaNpsRoutes)
```

- [ ] **Step 4: Run tests**

Run (en uniacc-api): `npm test -- src/services/nps-rematricula.service.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit** en uniacc-api (solo si el usuario lo pide)

---

### Task 6: Vista admin MOL + menú

**Files:**
- Create: `src/services/npsRematriculaAdminApi.ts`
- Create: `src/views/dashboard/rematricula/NpsRematriculaView.vue`
- Modify: `src/router/index.ts`
- Modify: `src/constants/dashboardRouteNames.ts`
- Modify: `src/views/dashboard/layout/menuIcons.ts` (agregar `Star` al mapa si falta)

**Interfaces:**
- Consumes: `GET` admin + `distribucionNps` / `promedioNps` / `tasaRespuestaNps`
- Route name: `dashboard-nps-rematricula`
- Meta: igual que `dashboard-encuesta-discapacidad` (`requiresAdminAdmision`, `requiresSoloGrupoDvU`, `requiresPerfilUsuarioIn: [1,2,3]`)

- [ ] **Step 1: Cliente admin**

```ts
// npsRematriculaAdminApi.ts — patrón encuestaDiscapacidadApi.ts
// destino: `${admisionApiBaseUrl()}/api/rematricula/nps?anio=&semestre=`
// + urlConCarteraEjecutivo
```

- [ ] **Step 2: Vista**

Mostrar:
- Periodo activo (label)
- Cards: promedio (1 decimal), total respuestas, total finalizados, tasa %
- Barras o tabla de distribución 1–5
- Tabla de comentarios solo calificación 1–3 con texto (RUT, codcli, carrera, jornada, nota, comentario, fecha)

Estilo cercano a `EncuestaDiscapacidadView.vue` / `RematriculaKpiView.vue` (Card + Table, sin inventar design system nuevo).

- [ ] **Step 3: Router + constants + icon**

```ts
{
  path: '/dashboard/nps-rematricula',
  name: 'dashboard-nps-rematricula',
  meta: {
    requiresAdminAdmision: true,
    requiresSoloGrupoDvU: true,
    requiresPerfilUsuarioIn: [1, 2, 3],
  },
  component: () => import('../views/dashboard/rematricula/NpsRematriculaView.vue'),
},
```

Añadir `'dashboard-nps-rematricula'` a `DASHBOARD_MENU_ROUTE_NAMES`.

- [ ] **Step 4: Verificar**

1. Ítem «NPS rematrícula» visible para DVU tras migración.
2. Con 0 respuestas: promedio «—», distribución en ceros, tasa según finalizados.
3. Con respuestas de prueba: promedio y comentarios bajos correctos.
4. Ejecutivo (perfil 3) solo ve RUTs de su cartera si aplica el mismo filtro.

- [ ] **Step 5: Commit** (solo si el usuario lo pide)

---

## Spec coverage (self-review)

| Requisito spec | Task |
|----------------|------|
| tNPS facilidad 1–5 en resumen | 4 |
| Omitible sin bloquear contrato | 4 |
| Comentario opcional 1–3 ≤500 | 1, 2, 3, 4 |
| Una respuesta por alumno/periodo | 2 (UNIQUE), 3–4 |
| Persistencia rut, codcli, codigo_carrera, jornada | 2, 3, 4 |
| Reporte promedio, distribución, tasa, comentarios | 1, 5, 6 |
| Acceso admin DVU/TI vía menú | 2, 6 |
| Sin mock en v1 | Global + Task 4 solo alumno |

## Placeholder scan

Sin TBD/TODO en pasos. Rutas, nombres RPC y UUID de menú fijados.

## Type consistency

- `CalificacionNps` / `esCalificacionNps` compartidos entre util, API alumno y card.
- Campos DB: `codigo_carrera`, `jornada` (valor desde `jornada_carrera` MNP).
- Route name idéntico en menú SQL, router y `dashboardRouteNames`.
