# KPI Rematrícula + seguimiento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backoffice ve embudo KPI del periodo y, por alumno (`codcli+año+semestre`), etapa actual + última actividad + timeline de logs MOL.

**Architecture:** Tabla materializada `mnp_progreso_rematricula` recalculada por `refresh_mnp_progreso_rematricula`. Universo = `mnp_cartera_oficial` ⋈ consolidado. Lectura vía RPCs SECURITY DEFINER. Dos vistas Vue bajo Rematrícula + menú `bo_menu_item`.

**Tech Stack:** Postgres/Supabase, Vue 3 + Pinia + TypeScript, Vitest, shadcn-vue, vue-sonner.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-15-rematricula-kpi-seguimiento-design.md`
- Llave: `codcli + anio_periodo + semestre_periodo`
- Sentinel sin match: `codcli = 'SIN_MATCH:' || rut_norm`
- Etapas: `sin_ingreso` | `ingreso` | `tyc` | `datos` | `forma_pago` | `firma` | `matriculado` (+ flags `excluido_mol` / `sin_match_mol` fuera del denominador KPI)
- Composition API; tipos explícitos; sin `any`
- No commit salvo que el usuario lo pida
- Reutilizar patrones de `CasosRematriculaView.vue` + `casoRematriculaApi.ts`

## File map

| Archivo | Rol |
|---------|-----|
| `src/utils/etapaProgresoRematricula.ts` | Pure: flags → `etapa_actual` + labels |
| `src/utils/etapaProgresoRematricula.test.ts` | Vitest |
| `supabase/migrations/20260915140000_mnp_progreso_rematricula.sql` | Tabla, refresh, RPCs, menú |
| `src/types/supabase.ts` | Tipos fila + Functions |
| `src/services/progresoRematriculaApi.ts` | Client RPC |
| `src/constants/dashboardRouteNames.ts` | Rutas nuevas |
| `src/router/index.ts` | Lazy routes |
| `src/views/dashboard/rematricula/RematriculaKpiView.vue` | Dashboard KPI |
| `src/views/dashboard/rematricula/RematriculaSeguimientoView.vue` | Listado + timeline dialog |

---

### Task 1: Util etapa (pure) + tests

**Files:**
- Create: `src/utils/etapaProgresoRematricula.ts`
- Create: `src/utils/etapaProgresoRematricula.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `export type EtapaProgresoRematricula = 'sin_ingreso' | 'ingreso' | 'tyc' | 'datos' | 'forma_pago' | 'firma' | 'matriculado'`
  - `export type HitosProgresoRematricula = { tieneIngreso: boolean; tycAcepta: boolean; datosOk: boolean; formaPagoOk: boolean; firmaOk: boolean; matriculadoOk: boolean }`
  - `export function resolverEtapaProgreso(hitos: HitosProgresoRematricula): EtapaProgresoRematricula`
  - `export function etiquetaEtapaProgreso(etapa: EtapaProgresoRematricula): string`
  - `export function etiquetaActividadLog(categoria: string, accion: string): string`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  etiquetaEtapaProgreso,
  resolverEtapaProgreso,
} from './etapaProgresoRematricula'

describe('resolverEtapaProgreso', () => {
  it('sin hitos → sin_ingreso', () => {
    expect(
      resolverEtapaProgreso({
        tieneIngreso: false,
        tycAcepta: false,
        datosOk: false,
        formaPagoOk: false,
        firmaOk: false,
        matriculadoOk: false,
      }),
    ).toBe('sin_ingreso')
  })

  it('solo ingreso → ingreso', () => {
    expect(
      resolverEtapaProgreso({
        tieneIngreso: true,
        tycAcepta: false,
        datosOk: false,
        formaPagoOk: false,
        firmaOk: false,
        matriculadoOk: false,
      }),
    ).toBe('ingreso')
  })

  it('tyc sin datos → tyc', () => {
    expect(
      resolverEtapaProgreso({
        tieneIngreso: true,
        tycAcepta: true,
        datosOk: false,
        formaPagoOk: false,
        firmaOk: false,
        matriculadoOk: false,
      }),
    ).toBe('tyc')
  })

  it('matriculado gana aunque falten flags intermedios', () => {
    expect(
      resolverEtapaProgreso({
        tieneIngreso: false,
        tycAcepta: false,
        datosOk: false,
        formaPagoOk: false,
        firmaOk: false,
        matriculadoOk: true,
      }),
    ).toBe('matriculado')
  })

  it('etiqueta legible', () => {
    expect(etiquetaEtapaProgreso('forma_pago')).toMatch(/pago/i)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd /opt/mol-docker && npx vitest run src/utils/etapaProgresoRematricula.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement util**

```ts
export type EtapaProgresoRematricula =
  | 'sin_ingreso'
  | 'ingreso'
  | 'tyc'
  | 'datos'
  | 'forma_pago'
  | 'firma'
  | 'matriculado'

export type HitosProgresoRematricula = {
  tieneIngreso: boolean
  tycAcepta: boolean
  datosOk: boolean
  formaPagoOk: boolean
  firmaOk: boolean
  matriculadoOk: boolean
}

const ORDEN: EtapaProgresoRematricula[] = [
  'matriculado',
  'firma',
  'forma_pago',
  'datos',
  'tyc',
  'ingreso',
  'sin_ingreso',
]

export function resolverEtapaProgreso(h: HitosProgresoRematricula): EtapaProgresoRematricula {
  if (h.matriculadoOk) return 'matriculado'
  if (h.firmaOk) return 'firma'
  if (h.formaPagoOk) return 'forma_pago'
  if (h.datosOk) return 'datos'
  if (h.tycAcepta) return 'tyc'
  if (h.tieneIngreso) return 'ingreso'
  return 'sin_ingreso'
}

export function etiquetaEtapaProgreso(etapa: EtapaProgresoRematricula): string {
  const map: Record<EtapaProgresoRematricula, string> = {
    sin_ingreso: 'Sin ingreso',
    ingreso: 'Ingresó',
    tyc: 'TyC aceptados',
    datos: 'Datos OK',
    forma_pago: 'Forma de pago',
    firma: 'Contrato firmado',
    matriculado: 'Matriculado',
  }
  return map[etapa]
}

export function etiquetaActividadLog(categoria: string, accion: string): string {
  const c = categoria.trim().toLowerCase()
  const a = accion.trim().toLowerCase()
  if (c === 'tyc' && a === 'acepta') return 'Aceptó TyC'
  if (c === 'tyc' && a === 'rechaza') return 'Rechazó TyC'
  if (c === 'sesion' && a === 'inicio') return 'Inicio de sesión'
  if (c === 'contacto' || c === 'contacto_otp') return `Contacto OTP: ${a}`
  if (c === 'apoderado') return `Apoderado: ${a}`
  if (c === 'discapacidad') return `Discapacidad: ${a}`
  return `${categoria}: ${accion}`
}

export { ORDEN as ORDEN_ETAPAS_PROGRESO }
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd /opt/mol-docker && npx vitest run src/utils/etapaProgresoRematricula.test.ts`  
Expected: PASS

---

### Task 2: Migración SQL — tabla + refresh + RPCs + menú

**Files:**
- Create: `supabase/migrations/20260915140000_mnp_progreso_rematricula.sql`
- Modify: `src/types/supabase.ts` (tipos al final de Task 2 o con Task 3)

**Interfaces:**
- Consumes: `mnp_cartera_oficial`, `mnp_mv_plan_pagos_consolidado`, `log_mol_evento`, `log_mol_tyc_respuesta`, `log_mol_contacto_otp`, `mv_matriculados_sync`
- Produces RPCs:
  - `refresh_mnp_progreso_rematricula(p_anio int, p_semestre int) returns integer` — filas upsertadas
  - `kpi_mnp_progreso_rematricula(p_anio int, p_semestre int) returns table(...)`
  - `listar_mnp_progreso_rematricula(p_anio int, p_semestre int, p_etapa text, p_q text) returns setof mnp_progreso_rematricula`
  - `listar_timeline_mol_alumno(p_codcli text, p_anio int, p_semestre int) returns setof v_log_mol_sesion_timeline-like`

- [ ] **Step 1: Add column `excluido_mol` on cartera (default false)**

```sql
ALTER TABLE public.mnp_cartera_oficial
  ADD COLUMN IF NOT EXISTS excluido_mol boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.mnp_cartera_oficial.excluido_mol IS
  'true = fuera del flujo MOL (ej. SUBDERE). Sigue en cartera; fuera del denominador KPI.';
```

- [ ] **Step 2: Create `mnp_progreso_rematricula`**

```sql
CREATE TABLE IF NOT EXISTS public.mnp_progreso_rematricula (
  codcli text NOT NULL,
  anio_periodo integer NOT NULL,
  semestre_periodo integer NOT NULL,
  rut text,
  rut_norm text,
  nombre_alumno text,
  codigo_carrera text,
  nombre_carrera text,
  jornada_carrera text,
  etapa_actual text NOT NULL,
  ultima_actividad_en timestamptz,
  ultima_actividad_label text,
  es_mock boolean NOT NULL DEFAULT false,
  excluido_mol boolean NOT NULL DEFAULT false,
  rematriculable boolean NOT NULL DEFAULT false,
  sin_match_mol boolean NOT NULL DEFAULT false,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (codcli, anio_periodo, semestre_periodo),
  CONSTRAINT mnp_progreso_etapa_chk CHECK (etapa_actual IN (
    'sin_ingreso','ingreso','tyc','datos','forma_pago','firma','matriculado'
  ))
);

CREATE INDEX IF NOT EXISTS idx_mnp_progreso_periodo_etapa
  ON public.mnp_progreso_rematricula (anio_periodo, semestre_periodo, etapa_actual);

CREATE INDEX IF NOT EXISTS idx_mnp_progreso_rut_norm
  ON public.mnp_progreso_rematricula (rut_norm);

ALTER TABLE public.mnp_progreso_rematricula ENABLE ROW LEVEL SECURITY;

-- Sin SELECT directo para anon/authenticated (igual que logs); solo RPCs.
DROP POLICY IF EXISTS mnp_progreso_no_select_anon ON public.mnp_progreso_rematricula;
CREATE POLICY mnp_progreso_no_select_anon ON public.mnp_progreso_rematricula
  FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS mnp_progreso_no_select_auth ON public.mnp_progreso_rematricula;
CREATE POLICY mnp_progreso_no_select_auth ON public.mnp_progreso_rematricula
  FOR SELECT TO authenticated USING (false);
```

- [ ] **Step 3: Implement `refresh_mnp_progreso_rematricula` (SECURITY DEFINER)**

Reglas de hitos (deben coincidir con `resolverEtapaProgreso`):

| Flag | SQL |
|------|-----|
| `tieneIngreso` | EXISTS evento/`tyc`/`otp` con mismo `codcli` + periodo **o** (para sentinel: cualquier log con `rut_norm` match y periodo) |
| `tycAcepta` | última fila `log_mol_tyc_respuesta` para `codcli`+periodo con `accion='acepta'` (DISTINCT ON / ORDER BY creado_en DESC) |
| `datosOk` | EXISTS `log_mol_contacto_otp` `evento='verificar_ok'` **o** `log_mol_evento.categoria IN ('apoderado','discapacidad')` para llave |
| `formaPagoOk` | EXISTS `log_mol_evento` con `categoria IN ('forma_pago','plan_pago','plan_pagos')` para llave |
| `firmaOk` | EXISTS `mv_matriculados_sync` misma `codcli` + `ano_mat`/`periodo_mat` con `estado_firma` no nulo y no vacío y `upper(estado_firma) NOT LIKE '%PEND%'` |
| `matriculadoOk` | EXISTS `mv_matriculados_sync` misma `codcli` + `ano_mat=p_anio` + `periodo_mat=p_semestre` |

Universo matched:

```sql
-- Pseudocódigo del CTE principal
WITH cartera AS (
  SELECT rut_norm, rematriculable, excluido_mol FROM mnp_cartera_oficial
),
consol AS (
  SELECT c.*,
    regexp_replace(upper(replace(replace(coalesce(c.rut_alumno,''),'.',''),'-','')), '[^0-9K]', '', 'g') AS rut_norm
  FROM mnp_mv_plan_pagos_consolidado c
),
matched AS (
  SELECT
    consol.codcli,
    p_anio AS anio_periodo,
    p_semestre AS semestre_periodo,
    consol.rut_alumno AS rut,
    cartera.rut_norm,
    trim(concat_ws(' ', consol.nombre_alumno, consol.apellido_paterno_alumno, consol.apellido_materno_alumno)) AS nombre_alumno,
    consol.codigo_carrera,
    consol.nombre_carrera,
    consol.jornada_carrera,
    cartera.excluido_mol,
    cartera.rematriculable,
    false AS sin_match_mol
  FROM cartera
  INNER JOIN consol ON consol.rut_norm = cartera.rut_norm
  WHERE consol.codcli IS NOT NULL AND length(trim(consol.codcli)) > 0
),
sin_match AS (
  SELECT
    ('SIN_MATCH:' || cartera.rut_norm) AS codcli,
    ...
    true AS sin_match_mol
  FROM cartera
  WHERE NOT EXISTS (SELECT 1 FROM consol WHERE consol.rut_norm = cartera.rut_norm)
)
-- DELETE periodo + INSERT matched ∪ sin_match con etapa calculada + ultima actividad
```

Última actividad: `MAX(creado_en)` de `log_mol_evento` (+ fallback TyC/OTP) por `codcli`+periodo; label vía CASE categoría/acción (misma semántica que `etiquetaActividadLog`).

Si `excluido_mol` o `sin_match_mol`: igual calcular etapa si hay señales, pero KPI las excluye del embudo.

Al final: `RETURN` count de filas del periodo.

- [ ] **Step 4: RPCs de lectura**

`kpi_mnp_progreso_rematricula`:

```sql
-- returns:
-- total_cartera int,
-- excluidos_mol int,
-- sin_match int,
-- sin_ingreso int, ingreso int, tyc int, datos int, forma_pago int, firma int, matriculado int
-- Contar etapa_* SOLO WHERE excluido_mol = false AND sin_match_mol = false
-- total_cartera = count(*) del periodo
-- excluidos_mol / sin_match = counts de flags
```

`listar_mnp_progreso_rematricula`: filtro opcional `p_etapa` (null=todas), `p_q` ILIKE sobre rut/nombre/codcli; ORDER BY ultima_actividad_en DESC NULLS LAST; LIMIT 5000.

`listar_timeline_mol_alumno`:

```sql
SELECT * FROM v_log_mol_sesion_timeline
WHERE codcli = p_codcli
  AND anio_periodo = p_anio
  AND semestre_periodo = p_semestre
ORDER BY creado_en DESC
LIMIT 200;
```

Si `p_codcli` empieza con `SIN_MATCH:`, filtrar por `rut_alumno` normalizado = substring tras prefijo (y periodo).

GRANT EXECUTE de las 4 funciones a `anon, authenticated, service_role`.

- [ ] **Step 5: Menú bo**

Parent Rematrícula: `b0000001-0001-4000-8000-000000000024` (igual que casos).

```sql
-- KPI orden 28
INSERT INTO public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo)
VALUES (
  'b0000001-0001-4000-8000-000000000041',
  'b0000001-0001-4000-8000-000000000024',
  'link', 'KPI rematrícula', 'dashboard-rematricula-kpi', 'LayoutDashboard', 28, true
) ON CONFLICT (id) DO UPDATE SET ...;

-- Seguimiento orden 29
INSERT ... VALUES (
  'b0000001-0001-4000-8000-000000000042',
  ...,
  'Seguimiento alumnos', 'dashboard-rematricula-seguimiento', 'ListOrdered', 29, true
);

INSERT INTO public.bo_menu_item_grupo (menu_item_id, codigo_grupo)
VALUES
  ('b0000001-0001-4000-8000-000000000041', 1),
  ('b0000001-0001-4000-8000-000000000042', 1)
ON CONFLICT DO NOTHING;
```

- [ ] **Step 6: Apply migration locally**

Run: aplicar migración en el entorno Supabase del proyecto (mismo flujo que migraciones `mnp_caso_*`).  
Verify: `\df refresh_mnp_progreso_rematricula` / `SELECT refresh_mnp_progreso_rematricula(2027,1);`

---

### Task 3: Tipos + API front

**Files:**
- Modify: `src/types/supabase.ts`
- Create: `src/services/progresoRematriculaApi.ts`
- Modify: `src/constants/dashboardRouteNames.ts`

**Interfaces:**
- Consumes: RPCs Task 2
- Produces:
  - `MnpProgresoRematriculaRow`
  - `KpiProgresoRematricula`
  - `refreshProgresoRematricula(anio, semestre): Promise<{ count: number | null; error: string | null }>`
  - `fetchKpiProgresoRematricula(anio, semestre): Promise<{ data: KpiProgresoRematricula | null; error: string | null }>`
  - `listarProgresoRematricula(...): Promise<{ data: MnpProgresoRematriculaRow[]; error: string | null }>`
  - `listarTimelineMolAlumno(...): Promise<{ data: VLogMolSesionTimelineRow[]; error: string | null }>`

- [ ] **Step 1: Add types** (junto a otros `Mnp*` rows)

```ts
export type EtapaProgresoRematricula =
  | 'sin_ingreso' | 'ingreso' | 'tyc' | 'datos'
  | 'forma_pago' | 'firma' | 'matriculado'

export type MnpProgresoRematriculaRow = {
  codcli: string
  anio_periodo: number
  semestre_periodo: number
  rut: string | null
  rut_norm: string | null
  nombre_alumno: string | null
  codigo_carrera: string | null
  nombre_carrera: string | null
  jornada_carrera: string | null
  etapa_actual: EtapaProgresoRematricula
  ultima_actividad_en: string | null
  ultima_actividad_label: string | null
  es_mock: boolean
  excluido_mol: boolean
  rematriculable: boolean
  sin_match_mol: boolean
  actualizado_en: string
}

export type KpiProgresoRematricula = {
  total_cartera: number
  excluidos_mol: number
  sin_match: number
  sin_ingreso: number
  ingreso: number
  tyc: number
  datos: number
  forma_pago: number
  firma: number
  matriculado: number
}
```

Registrar Functions en el typings de Database igual que `listar_mnp_casos_rematricula`.

- [ ] **Step 2: Create `progresoRematriculaApi.ts`** (mismo estilo que `casoRematriculaApi.ts`: rpc + `error?.message`)

- [ ] **Step 3: Append route names**

```ts
  'dashboard-rematricula-kpi',
  'dashboard-rematricula-seguimiento',
```

---

### Task 4: Vista KPI

**Files:**
- Create: `src/views/dashboard/rematricula/RematriculaKpiView.vue`
- Modify: `src/router/index.ts`

**Interfaces:**
- Consumes: `usePeriodoActivoStore`, `fetchKpiProgresoRematricula`, `refreshProgresoRematricula`, `etiquetaEtapaProgreso`
- Produces: ruta `dashboard-rematricula-kpi`

- [ ] **Step 1: Add route** (meta igual que `dashboard-casos-rematricula`)

```ts
{
  path: '/dashboard/rematricula-kpi',
  name: 'dashboard-rematricula-kpi',
  meta: {
    requiresAdminAdmision: true,
    requiresSoloGrupoDvU: true,
    requiresPerfilUsuarioIn: [1, 2, 3],
  },
  component: () =>
    import('../views/dashboard/rematricula/RematriculaKpiView.vue'),
},
```

- [ ] **Step 2: Implement view**

- `onMounted`: `periodoActivo.ensureLoaded()`; si falta periodo → mensaje + link mental a mantenedor; no llamar KPI.
- Tarjetas: Total cartera / Excluidos MOL / Sin match MOL.
- Embudo: una fila o lista de etapas con count (solo embudo; no incluir excluidos en esas barras).
- Botón **Actualizar progreso** → `refresh` → toast ok/error → re-fetch KPI. Si refresh falla, toast.error y **no** limpiar `kpi` previo.
- Loading con estado `loading` / `refreshing`.

- [ ] **Step 3: Smoke manual**

Abrir `/dashboard/rematricula-kpi` logueado DVU; refresh; ver números ≥ 0.

---

### Task 5: Vista seguimiento + timeline

**Files:**
- Create: `src/views/dashboard/rematricula/RematriculaSeguimientoView.vue`
- Modify: `src/router/index.ts`

**Interfaces:**
- Consumes: `listarProgresoRematricula`, `listarTimelineMolAlumno`, `etiquetaEtapaProgreso`
- Produces: ruta `dashboard-rematricula-seguimiento`

- [ ] **Step 1: Add route** `dashboard-rematricula-seguimiento` (mismo meta)

- [ ] **Step 2: Implement listado**

Patrón UI de `CasosRematriculaView.vue`:
- Filtro etapa (`Select`: todas + cada etapa)
- Input búsqueda RUT / nombre / codcli (pasar `p_q` al RPC; no filtrar solo en cliente si el set es grande)
- Tabla columnas: RUT, Nombre, CODCLI, Carrera, Etapa (Badge), Última actividad (fecha Chile corta + label), badges Excluido / Sin match / Mock
- Botón fila **Ver timeline**

- [ ] **Step 3: Dialog/Sheet timeline**

- Al abrir: `listarTimelineMolAlumno(codcli, anio, semestre)`
- Lista cronológica: `creado_en_chile_txt`, categoría, acción, label (`etiquetaActividadLog`), payload resumido
- Vacío: texto exacto `Sin actividad en MOL`
- Error: toast; no cerrar dialog vacío sin mensaje

- [ ] **Step 4: Smoke**

Buscar un `codcli` conocido con TyC; etapa ≥ `tyc`; timeline no vacío.

---

### Task 6: Verificación de reglas + gaps de logging

**Files:**
- Possibly modify: puntos del mock que confirman forma de pago (solo si al probar `forma_pago` nunca sube)

- [ ] **Step 1: Tras refresh, muestrear**

```sql
SELECT etapa_actual, count(*) FROM mnp_progreso_rematricula
WHERE anio_periodo = 2027 AND semestre_periodo = 1
  AND NOT excluido_mol AND NOT sin_match_mol
GROUP BY 1 ORDER BY 1;
```

- [ ] **Step 2: Si nadie llega a `forma_pago`**

Buscar en código el click de “continuar” en forma de pago y, si no registra `log_mol_evento`, añadir `registrar_log_mol_evento` con `categoria='forma_pago'`, `accion='confirmado'` (mismo patrón que `apoderadoAuditLog.ts`). Un commit/cambio acotado solo si el gap es real.

- [ ] **Step 3: Checklist spec**

- [ ] Cartera sin ingreso → `sin_ingreso`
- [ ] TyC acepta → ≥ `tyc`
- [ ] Dos codcli mismo RUT → dos filas
- [ ] `excluido_mol` fuera de counts de embudo
- [ ] Timeline lee logs existentes

---

## Spec coverage (self-review)

| Spec | Task |
|------|------|
| Tabla progreso + refresh | 2 |
| Llave + sentinel SIN_MATCH | 2 |
| Embudo 7 etapas | 1 (pure) + 2 (SQL) |
| KPI pantalla | 4 |
| Seguimiento + timeline | 5 |
| Errores refresh/periodo/timeline vacío | 4, 5 |
| Menú Rematrícula | 2 |
| Fuera v1 (CSV, alertas…) | no implementado ✓ |

**Nota:** `forma_pago` depende de eventos `log_mol_evento`; Task 6 cierra el gap si no existen hoy. `firma`/`matriculado` dependen de sync `mv_matriculados_sync` actualizado en el entorno.
