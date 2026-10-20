# KPI Forma de pago espera CAE/Ministerial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En el KPI Rematrícula, bajo Forma de pago, mostrar desglose CAE / Ministerial / ambos / resto y badges+filtro en el listado, según bloqueo activo.

**Architecture:** Flags `espera_cae` y `espera_ministerial` en `mnp_progreso_rematricula`, calculados en `refresh_mnp_progreso_rematricula` desde casos abiertos (+ fallback verificación CAE). El RPC KPI agrega 4 subconteos; el front filtra en cliente.

**Tech Stack:** Postgres/Supabase, Vue 3 Composition API + TypeScript, Vitest, shadcn-vue.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-20-kpi-forma-pago-espera-cae-ministerial-design.md`
- Caso abierto = `estado IN ('ABIERTO', 'EN_REVISION')`
- Tipos caso: `CAE_RESOLUCION`, `ESTATAL_MINEDUC`
- Periodo caso: texto `YYYY-01` / `YYYY-02` (= `anio || '-0' || semestre`)
- Total `forma_pago` no cambia; suma de 4 subconteos = ese total
- Filtro de espera en cliente (v1); sin etapa nueva
- Composition API; tipos explícitos; sin `any`
- Commits por tarea al cerrar cada task

## File map

| Archivo | Rol |
|---------|-----|
| `src/utils/esperaFormaPagoKpi.ts` | Pure: buckets, filtro, etiquetas |
| `src/utils/esperaFormaPagoKpi.test.ts` | Vitest |
| `src/types/supabase.ts` | Campos en fila + KPI |
| `supabase/migrations/20261020120000_kpi_forma_pago_espera_cae_ministerial.sql` | Columnas, refresh, KPI |
| `src/views/dashboard/rematricula/RematriculaKpiView.vue` | Desglose + badges + filtro |

---

### Task 1: Util pure + tests (buckets y filtro)

**Files:**
- Create: `src/utils/esperaFormaPagoKpi.ts`
- Create: `src/utils/esperaFormaPagoKpi.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `export type FiltroEsperaFormaPago = 'todos' | 'cae' | 'ministerial' | 'ambos' | 'resto'`
  - `export type BucketEsperaFormaPago = 'cae' | 'ministerial' | 'ambos' | 'resto'`
  - `export function bucketEsperaFormaPago(esperaCae: boolean | null | undefined, esperaMinisterial: boolean | null | undefined): BucketEsperaFormaPago`
  - `export function coincideFiltroEspera(bucket: BucketEsperaFormaPago, filtro: FiltroEsperaFormaPago): boolean`
  - `export function etiquetaFiltroEsperaFormaPago(filtro: FiltroEsperaFormaPago): string`
  - `export function etiquetaBucketEsperaFormaPago(bucket: BucketEsperaFormaPago): string`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  bucketEsperaFormaPago,
  coincideFiltroEspera,
  etiquetaBucketEsperaFormaPago,
  etiquetaFiltroEsperaFormaPago,
} from './esperaFormaPagoKpi'

describe('bucketEsperaFormaPago', () => {
  it('null/undefined → resto', () => {
    expect(bucketEsperaFormaPago(null, undefined)).toBe('resto')
  })
  it('solo cae', () => {
    expect(bucketEsperaFormaPago(true, false)).toBe('cae')
  })
  it('solo ministerial', () => {
    expect(bucketEsperaFormaPago(false, true)).toBe('ministerial')
  })
  it('ambos', () => {
    expect(bucketEsperaFormaPago(true, true)).toBe('ambos')
  })
  it('ninguno → resto', () => {
    expect(bucketEsperaFormaPago(false, false)).toBe('resto')
  })
})

describe('coincideFiltroEspera', () => {
  it('todos acepta cualquier bucket', () => {
    for (const b of ['cae', 'ministerial', 'ambos', 'resto'] as const) {
      expect(coincideFiltroEspera(b, 'todos')).toBe(true)
    }
  })
  it('cae incluye ambos', () => {
    expect(coincideFiltroEspera('cae', 'cae')).toBe(true)
    expect(coincideFiltroEspera('ambos', 'cae')).toBe(true)
    expect(coincideFiltroEspera('ministerial', 'cae')).toBe(false)
    expect(coincideFiltroEspera('resto', 'cae')).toBe(false)
  })
  it('ministerial incluye ambos', () => {
    expect(coincideFiltroEspera('ministerial', 'ministerial')).toBe(true)
    expect(coincideFiltroEspera('ambos', 'ministerial')).toBe(true)
    expect(coincideFiltroEspera('cae', 'ministerial')).toBe(false)
  })
  it('ambos solo ambos', () => {
    expect(coincideFiltroEspera('ambos', 'ambos')).toBe(true)
    expect(coincideFiltroEspera('cae', 'ambos')).toBe(false)
  })
  it('resto solo resto', () => {
    expect(coincideFiltroEspera('resto', 'resto')).toBe(true)
    expect(coincideFiltroEspera('cae', 'resto')).toBe(false)
  })
})

describe('etiquetas', () => {
  it('filtro', () => {
    expect(etiquetaFiltroEsperaFormaPago('todos')).toBe('Todos')
    expect(etiquetaFiltroEsperaFormaPago('cae')).toBe('En espera CAE')
    expect(etiquetaFiltroEsperaFormaPago('ministerial')).toBe('En espera Ministerial')
    expect(etiquetaFiltroEsperaFormaPago('ambos')).toBe('Solo ambos')
    expect(etiquetaFiltroEsperaFormaPago('resto')).toBe('Resto (pueden avanzar)')
  })
  it('bucket (desglose embudo)', () => {
    expect(etiquetaBucketEsperaFormaPago('cae')).toBe('En espera CAE')
    expect(etiquetaBucketEsperaFormaPago('ministerial')).toBe('En espera Ministerial')
    expect(etiquetaBucketEsperaFormaPago('ambos')).toBe('En espera ambos')
    expect(etiquetaBucketEsperaFormaPago('resto')).toBe('Resto (pueden avanzar)')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/utils/esperaFormaPagoKpi.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
export type FiltroEsperaFormaPago = 'todos' | 'cae' | 'ministerial' | 'ambos' | 'resto'
export type BucketEsperaFormaPago = 'cae' | 'ministerial' | 'ambos' | 'resto'

export function bucketEsperaFormaPago(
  esperaCae: boolean | null | undefined,
  esperaMinisterial: boolean | null | undefined,
): BucketEsperaFormaPago {
  const cae = esperaCae === true
  const min = esperaMinisterial === true
  if (cae && min) return 'ambos'
  if (cae) return 'cae'
  if (min) return 'ministerial'
  return 'resto'
}

export function coincideFiltroEspera(
  bucket: BucketEsperaFormaPago,
  filtro: FiltroEsperaFormaPago,
): boolean {
  if (filtro === 'todos') return true
  if (filtro === 'cae') return bucket === 'cae' || bucket === 'ambos'
  if (filtro === 'ministerial') return bucket === 'ministerial' || bucket === 'ambos'
  if (filtro === 'ambos') return bucket === 'ambos'
  return bucket === 'resto'
}

export function etiquetaFiltroEsperaFormaPago(filtro: FiltroEsperaFormaPago): string {
  const map: Record<FiltroEsperaFormaPago, string> = {
    todos: 'Todos',
    cae: 'En espera CAE',
    ministerial: 'En espera Ministerial',
    ambos: 'Solo ambos',
    resto: 'Resto (pueden avanzar)',
  }
  return map[filtro]
}

export function etiquetaBucketEsperaFormaPago(bucket: BucketEsperaFormaPago): string {
  const map: Record<BucketEsperaFormaPago, string> = {
    cae: 'En espera CAE',
    ministerial: 'En espera Ministerial',
    ambos: 'En espera ambos',
    resto: 'Resto (pueden avanzar)',
  }
  return map[bucket]
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/utils/esperaFormaPagoKpi.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/esperaFormaPagoKpi.ts src/utils/esperaFormaPagoKpi.test.ts
git commit -m "feat(kpi): util buckets espera CAE/Ministerial en forma de pago"
```

---

### Task 2: Tipos TypeScript

**Files:**
- Modify: `src/types/supabase.ts` (`MnpProgresoRematriculaRow`, `KpiProgresoRematricula`)

**Interfaces:**
- Consumes: Task 1 (nombres de campos alineados al spec)
- Produces: campos tipados para fila y KPI

- [ ] **Step 1: Extender `MnpProgresoRematriculaRow`**

Agregar (opcionales por compatibilidad con refrescos viejos):

```ts
  /** Bloqueo activo CAE (caso abierto o verificación pendiente). */
  espera_cae?: boolean | null;
  /** Bloqueo activo Beca Ministerial (caso ESTATAL_MINEDUC abierto). */
  espera_ministerial?: boolean | null;
```

- [ ] **Step 2: Extender `KpiProgresoRematricula`**

Agregar (requeridos en el tipo; el UI usa `?? 0` si faltan):

```ts
  forma_pago_espera_cae: number;
  forma_pago_espera_ministerial: number;
  forma_pago_espera_ambos: number;
  forma_pago_resto: number;
```

- [ ] **Step 3: Commit**

```bash
git add src/types/supabase.ts
git commit -m "feat(kpi): tipos espera CAE/Ministerial en progreso y KPI"
```

---

### Task 3: Migración SQL (columnas + refresh + KPI)

**Files:**
- Create: `supabase/migrations/20261020120000_kpi_forma_pago_espera_cae_ministerial.sql`

**Interfaces:**
- Consumes: tabla `mnp_progreso_rematricula`, `mnp_caso_rematricula`, `mnp_verificacion_cae_mol`, refresh actual en `20261015160000_mnp_progreso_etapa_desde.sql`, KPI con ejecutivo en `20261015170000_cartera_ejecutivo_filtro.sql` + campos académicos de `20261008171500_kpi_rematricula_estado_academico.sql`
- Produces: columnas + refresh que las llena + `kpi_mnp_progreso_rematricula(integer,integer,text)` con 4 subconteos **y** restaura campos académicos que `202610151700` dejó fuera

**Importante:** La migración `202610151700` acortó el RETURN de KPI. Esta migración debe devolver el shape completo que usa el front (`rematriculables`, `detalle_dos_carreras`, estados académicos, etc.) **más** los 4 nuevos enteros, con filtro `p_email_ejecutivo`.

- [ ] **Step 1: Crear migración — columnas**

```sql
ALTER TABLE public.mnp_progreso_rematricula
  ADD COLUMN IF NOT EXISTS espera_cae boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS espera_ministerial boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.mnp_progreso_rematricula.espera_cae IS
  'Bloqueo activo CAE: caso CAE_RESOLUCION abierto o verificación pendiente_resolucion.';
COMMENT ON COLUMN public.mnp_progreso_rematricula.espera_ministerial IS
  'Bloqueo activo Beca Ministerial: caso ESTATAL_MINEDUC abierto.';
```

- [ ] **Step 2: Reemplazar `refresh_mnp_progreso_rematricula`**

Partir del cuerpo de `20261015160000_mnp_progreso_etapa_desde.sql`. Cambios mínimos:

1. Tras el CTE `con_etapa` (antes de `ultima_actividad`), agregar CTE `con_espera`:

```sql
  con_espera AS (
    SELECT
      ce.*,
      (
        EXISTS (
          SELECT 1
          FROM public.mnp_caso_rematricula caso
          WHERE caso.codcli = ce.codcli
            AND caso.periodo = (ce.anio_periodo::text || '-0' || ce.semestre_periodo::text)
            AND caso.tipo = 'CAE_RESOLUCION'
            AND caso.estado IN ('ABIERTO', 'EN_REVISION')
        )
        OR EXISTS (
          SELECT 1
          FROM public.mnp_verificacion_cae_mol v
          WHERE v.codcli = ce.codcli
            AND v.anio_periodo = ce.anio_periodo
            AND v.semestre_periodo = ce.semestre_periodo
            AND v.resultado = 'pendiente_resolucion'
        )
      ) AS espera_cae,
      EXISTS (
        SELECT 1
        FROM public.mnp_caso_rematricula caso
        WHERE caso.codcli = ce.codcli
          AND caso.periodo = (ce.anio_periodo::text || '-0' || ce.semestre_periodo::text)
          AND caso.tipo = 'ESTATAL_MINEDUC'
          AND caso.estado IN ('ABIERTO', 'EN_REVISION')
      ) AS espera_ministerial
    FROM con_etapa ce
  ),
```

2. En `ultima_actividad`, leer desde `con_espera` en lugar de `con_etapa` (mismo alias `ce`).

3. En `INSERT` / `SELECT`, incluir `espera_cae`, `espera_ministerial` desde `ce` (ahora `con_espera`).

Lista de columnas INSERT actualizada:

```sql
  INSERT INTO public.mnp_progreso_rematricula (
    codcli, anio_periodo, semestre_periodo, rut, rut_norm,
    nombre_alumno, codigo_carrera, nombre_carrera, jornada_carrera,
    etapa_actual, etapa_desde, ultima_actividad_en, ultima_actividad_label,
    es_mock, excluido_mol, rematriculable, sin_match_mol,
    espera_cae, espera_ministerial, actualizado_en
  )
```

y en el SELECT, tras `sin_match_mol`:

```sql
    ce.espera_cae,
    ce.espera_ministerial,
    now() AS actualizado_en
```

No tocar la lógica de `etapa_desde` / firma / matriculado.

- [ ] **Step 3: Reemplazar KPI**

```sql
DROP FUNCTION IF EXISTS public.kpi_mnp_progreso_rematricula(integer, integer);
DROP FUNCTION IF EXISTS public.kpi_mnp_progreso_rematricula(integer, integer, text);

CREATE FUNCTION public.kpi_mnp_progreso_rematricula(
  p_anio integer,
  p_semestre integer,
  p_email_ejecutivo text DEFAULT NULL
)
RETURNS TABLE (
  total_cartera integer,
  excluidos_mol integer,
  sin_match integer,
  sin_ingreso integer,
  ingreso integer,
  tyc integer,
  datos integer,
  forma_pago integer,
  firma integer,
  matriculado integer,
  rematriculables integer,
  no_rematriculables integer,
  rut_dos_carreras text,
  detalle_dos_carreras jsonb,
  rematriculable_vigente integer,
  rematriculable_suspendido integer,
  rematriculable_eliminado integer,
  no_rematriculable_vigente integer,
  no_rematriculable_suspendido integer,
  no_rematriculable_eliminado integer,
  forma_pago_espera_cae integer,
  forma_pago_espera_ministerial integer,
  forma_pago_espera_ambos integer,
  forma_pago_resto integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT p.*, c.estado_academico
    FROM public.mnp_progreso_rematricula p
    LEFT JOIN public.mnp_mv_plan_pagos_consolidado c ON c.codcli = p.codcli
    WHERE p.anio_periodo = p_anio
      AND p.semestre_periodo = p_semestre
      AND (
        p_email_ejecutivo IS NULL
        OR btrim(p_email_ejecutivo) = ''
        OR EXISTS (
          SELECT 1
          FROM public.mnp_cartera_oficial co
          WHERE co.rut_norm = p.rut_norm
            AND lower(btrim(co.email_ejecutivo)) = lower(btrim(p_email_ejecutivo))
        )
      )
  ),
  dos_carreras AS (
    SELECT
      c.rut_alumno,
      c.codcli,
      c.nombre_carrera,
      c.codigo_carrera
    FROM public.mnp_mv_plan_pagos_consolidado c
    WHERE upper(btrim(coalesce(c.estado_academico, ''))) = 'VIGENTE'
      AND c.rut_alumno IS NOT NULL
      AND btrim(c.rut_alumno) <> ''
      AND c.rut_alumno IN (
        SELECT c2.rut_alumno
        FROM public.mnp_mv_plan_pagos_consolidado c2
        WHERE upper(btrim(coalesce(c2.estado_academico, ''))) = 'VIGENTE'
          AND c2.rut_alumno IS NOT NULL
          AND btrim(c2.rut_alumno) <> ''
        GROUP BY c2.rut_alumno
        HAVING count(*) > 1
      )
  ),
  embudo AS (
    SELECT *
    FROM base
    WHERE excluido_mol = false AND sin_match_mol = false
  )
  SELECT
    (SELECT count(*)::integer FROM base) AS total_cartera,
    (SELECT count(*) FILTER (WHERE excluido_mol)::integer FROM base) AS excluidos_mol,
    (SELECT count(*) FILTER (WHERE sin_match_mol)::integer FROM base) AS sin_match,
    (SELECT count(*) FILTER (WHERE etapa_actual = 'sin_ingreso')::integer FROM embudo) AS sin_ingreso,
    (SELECT count(*) FILTER (WHERE etapa_actual = 'ingreso')::integer FROM embudo) AS ingreso,
    (SELECT count(*) FILTER (WHERE etapa_actual = 'tyc')::integer FROM embudo) AS tyc,
    (SELECT count(*) FILTER (WHERE etapa_actual = 'datos')::integer FROM embudo) AS datos,
    (SELECT count(*) FILTER (WHERE etapa_actual = 'forma_pago')::integer FROM embudo) AS forma_pago,
    (SELECT count(*) FILTER (WHERE etapa_actual = 'firma')::integer FROM embudo) AS firma,
    (SELECT count(*) FILTER (WHERE etapa_actual = 'matriculado')::integer FROM embudo) AS matriculado,
    (SELECT count(*) FILTER (WHERE rematriculable)::integer FROM base) AS rematriculables,
    (SELECT count(*) FILTER (WHERE NOT rematriculable)::integer FROM base) AS no_rematriculables,
    (SELECT string_agg(DISTINCT d.rut_alumno, ', ' ORDER BY d.rut_alumno) FROM dos_carreras d) AS rut_dos_carreras,
    (SELECT jsonb_agg(
      jsonb_build_object('codcli', d.codcli, 'nombre_carrera', d.nombre_carrera)
      ORDER BY d.rut_alumno, d.codigo_carrera
    ) FROM dos_carreras d) AS detalle_dos_carreras,
    (SELECT count(*) FILTER (WHERE rematriculable AND upper(btrim(coalesce(estado_academico, ''))) = 'VIGENTE')::integer FROM base) AS rematriculable_vigente,
    (SELECT count(*) FILTER (WHERE rematriculable AND upper(btrim(coalesce(estado_academico, ''))) = 'SUSPENDIDO')::integer FROM base) AS rematriculable_suspendido,
    (SELECT count(*) FILTER (WHERE rematriculable AND upper(btrim(coalesce(estado_academico, ''))) = 'ELIMINADO')::integer FROM base) AS rematriculable_eliminado,
    (SELECT count(*) FILTER (WHERE NOT rematriculable AND upper(btrim(coalesce(estado_academico, ''))) = 'VIGENTE')::integer FROM base) AS no_rematriculable_vigente,
    (SELECT count(*) FILTER (WHERE NOT rematriculable AND upper(btrim(coalesce(estado_academico, ''))) = 'SUSPENDIDO')::integer FROM base) AS no_rematriculable_suspendido,
    (SELECT count(*) FILTER (WHERE NOT rematriculable AND upper(btrim(coalesce(estado_academico, ''))) = 'ELIMINADO')::integer FROM base) AS no_rematriculable_eliminado,
    (SELECT count(*) FILTER (
      WHERE etapa_actual = 'forma_pago' AND espera_cae AND NOT espera_ministerial
    )::integer FROM embudo) AS forma_pago_espera_cae,
    (SELECT count(*) FILTER (
      WHERE etapa_actual = 'forma_pago' AND espera_ministerial AND NOT espera_cae
    )::integer FROM embudo) AS forma_pago_espera_ministerial,
    (SELECT count(*) FILTER (
      WHERE etapa_actual = 'forma_pago' AND espera_cae AND espera_ministerial
    )::integer FROM embudo) AS forma_pago_espera_ambos,
    (SELECT count(*) FILTER (
      WHERE etapa_actual = 'forma_pago' AND NOT espera_cae AND NOT espera_ministerial
    )::integer FROM embudo) AS forma_pago_resto;
$$;

GRANT EXECUTE ON FUNCTION public.kpi_mnp_progreso_rematricula(integer, integer, text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.kpi_mnp_progreso_rematricula(integer, integer, text) IS
  'Agregados del embudo + desglose forma_pago espera CAE/Ministerial. Con p_email_ejecutivo, solo cartera de ese ejecutivo.';
```

- [ ] **Step 4: Validar SQL localmente si hay DB**

Si el entorno tiene Supabase local: aplicar migración. Si no, al menos `pg_query` / revisión manual de que el `format($SQL$...`) del refresh sigue con los mismos placeholders `%L` que el archivo base.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261020120000_kpi_forma_pago_espera_cae_ministerial.sql
git commit -m "feat(kpi): flags y subconteos espera CAE/Ministerial en forma de pago"
```

---

### Task 4: UI KPI (desglose + badges + filtro)

**Files:**
- Modify: `src/views/dashboard/rematricula/RematriculaKpiView.vue`

**Interfaces:**
- Consumes: Task 1 utils; Task 2 tipos; KPI con nuevos campos
- Produces: UI según spec § KPI y § Listado

- [ ] **Step 1: Imports y estado**

```ts
import {
  bucketEsperaFormaPago,
  coincideFiltroEspera,
  etiquetaBucketEsperaFormaPago,
  etiquetaFiltroEsperaFormaPago,
  type BucketEsperaFormaPago,
  type FiltroEsperaFormaPago,
} from '@/utils/esperaFormaPagoKpi'

const filtroEspera = ref<FiltroEsperaFormaPago>('todos')

const ORDEN_BUCKETS_ESPERA: BucketEsperaFormaPago[] = [
  'cae',
  'ministerial',
  'ambos',
  'resto',
]

const KPI_KEY_BUCKET: Record<BucketEsperaFormaPago, keyof KpiProgresoRematricula> = {
  cae: 'forma_pago_espera_cae',
  ministerial: 'forma_pago_espera_ministerial',
  ambos: 'forma_pago_espera_ambos',
  resto: 'forma_pago_resto',
}
```

- [ ] **Step 2: Computed desglose y filtro de alumnos**

```ts
const desgloseFormaPago = computed(() => {
  if (!kpi.value) return []
  return ORDEN_BUCKETS_ESPERA.map(bucket => ({
    bucket,
    label: etiquetaBucketEsperaFormaPago(bucket),
    count: Number(kpi.value![KPI_KEY_BUCKET[bucket]] ?? 0),
  }))
})

// En alumnosFiltrados: tras obtener filas y aplicar búsqueda q,
// si etapa === 'forma_pago', filtrar además con:
// coincideFiltroEspera(bucketEsperaFormaPago(fila.espera_cae, fila.espera_ministerial), filtroEspera.value)
```

Al `toggleEtapa` / al abrir etapa distinta de `forma_pago`, resetear `filtroEspera` a `'todos'`.

- [ ] **Step 3: Template — desglose bajo Forma de pago**

Dentro del `v-for="item in embudoEtapas"`, después del botón de la etapa (antes del detalle expandido), si `item.etapa === 'forma_pago'`:

```vue
<div
  v-if="item.etapa === 'forma_pago' && desgloseFormaPago.length"
  class="space-y-1 border-t px-3 py-2"
>
  <button
    v-for="linea in desgloseFormaPago"
    :key="linea.bucket"
    type="button"
    class="flex w-full cursor-pointer items-center justify-between rounded px-2 py-1 text-sm text-muted-foreground hover:bg-muted/40"
    @click.stop="abrirFormaPagoConFiltro(linea.bucket)"
  >
    <span class="pl-7">{{ linea.label }}</span>
    <span class="tabular-nums font-medium text-foreground">{{ linea.count }}</span>
  </button>
</div>
```

Implementar helper limpio (no ternario anidado en template):

```ts
async function abrirFormaPagoConFiltro(filtro: FiltroEsperaFormaPago) {
  filtroEspera.value = filtro
  if (etapaAbierta.value !== 'forma_pago') {
    etapaAbierta.value = 'forma_pago'
    busquedaEtapa.value = ''
    filasVisibles.value = FILAS_POR_PAGINA
    if (!alumnosPorEtapa.value.forma_pago) {
      await cargarEtapa('forma_pago')
    }
  }
}
```

- [ ] **Step 4: Template — chips de filtro + badges**

En el bloque expandido de etapa, si `item.etapa === 'forma_pago'`, debajo del Input de búsqueda:

```vue
<div class="flex flex-wrap gap-2">
  <Button
    v-for="f in (['todos', 'cae', 'ministerial', 'ambos', 'resto'] as const)"
    :key="f"
    type="button"
    size="sm"
    :variant="filtroEspera === f ? 'default' : 'outline'"
    class="cursor-pointer"
    @click="filtroEspera = f"
  >
    {{ etiquetaFiltroEsperaFormaPago(f) }}
  </Button>
</div>
```

En la celda Nombre, junto al badge de permanencia:

```vue
<Badge v-if="fila.espera_cae" variant="outline">CAE</Badge>
<Badge v-if="fila.espera_ministerial" variant="outline">Ministerial</Badge>
```

- [ ] **Step 5: Smoke check**

Run: `npx vitest run src/utils/esperaFormaPagoKpi.test.ts src/utils/etapaProgresoRematricula.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/views/dashboard/rematricula/RematriculaKpiView.vue
git commit -m "feat(kpi): UI desglose y filtro espera CAE/Ministerial"
```

---

## Spec coverage (self-review)

| Spec | Task |
|------|------|
| Columnas `espera_*` | 3 |
| Fuente casos + fallback CAE | 3 |
| Refresh calcula flags | 3 |
| 4 subconteos bajo forma_pago | 3 + 4 |
| Badges + filtro cliente | 1 + 4 |
| Clic desglose abre con filtro | 4 |
| Permanencia intacta | 4 (no tocar) |
| Fuera de alcance (resolver casos, etapa nueva) | no implementado |

## Placeholder scan

Sin TBD. Nombres KPI fijos. Refresh documentado como delta sobre migración base.
