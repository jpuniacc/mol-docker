# SUBDERE fuera de MOL — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Los 62 alumnos SUBDERE del Excel siguen en `mnp_cartera_oficial` pero MOL los bloquea con el mismo aviso que fuera de cartera.

**Architecture:** Reutilizar `excluido_mol` (ya lo añade `20260915140000_mnp_progreso_rematricula.sql`). Marcar esos RUT. `refresh_fuera_cartera_oficial()` pone `fuera_cartera_oficial = true` si el RUT no está en cartera **o** `excluido_mol`. El portal combina `enCartera` + `excluidoMol` con el copy actual. Sin UI nueva, sin bandeja NEDA, sin tocar `prelacionArancel`.

**Tech Stack:** Postgres/Supabase migrations, TypeScript, Pinia, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-15-subdere-fuera-mol-design.md`
- Copy alumno: `TITULO_FUERA_CARTERA_OFICIAL` / `MSG_FUERA_CARTERA_OFICIAL` (no hay mensaje específico)
- No borrar filas de `mnp_cartera_oficial`
- No recrear la columna `excluido_mol` (ya existe o `ADD COLUMN IF NOT EXISTS`)
- Caso de prueba: RUT `17420219-2` → `rut_norm` `174202192`
- Composition API; tipos explícitos; sin `any`
- No commit salvo que el usuario lo pida

## File map

| Archivo | Rol |
|---------|-----|
| `src/constants/carteraOficial.ts` | Helper puro: ¿el alumno queda bloqueado? |
| `src/constants/carteraOficial.test.ts` | Vitest del helper |
| `src/services/carteraOficialApi.ts` | Lee `excluido_mol` de la fila de cartera |
| `src/stores/datosAlumnoMnp.ts` | `fueraCarteraOficial` también si `excluidoMol` |
| `src/types/supabase.ts` | `excluido_mol` en `MnpCarteraOficialRow` |
| `supabase/migrations/20260915150000_mnp_cartera_subdere_excluido_mol.sql` | Refresh + seed 62 RUT |
| `docs/becas-beneficios/subdere-ruts-2027-01.txt` | Lista `rut_norm` (una por línea, 62) |

`HomeView.vue`, `src/router/index.ts` y la selección mock **no cambian**: ya leen `fueraCarteraOficial` / `filaFueraCarteraOficial`. Tras el refresh, el consolidado marca SUBDERE como fuera de cartera.

---

### Task 1: Helper de bloqueo + tests

**Files:**
- Modify: `src/constants/carteraOficial.ts`
- Create: `src/constants/carteraOficial.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `export type EstadoCarteraOficial = { carteraCargada: boolean; enCartera: boolean; excluidoMol: boolean }`
  - `export function fueraCarteraDesdeEstado(estado: EstadoCarteraOficial): boolean`
  - `filaFueraCarteraOficial` sin cambio de firma (sigue leyendo la columna del consolidado)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { fueraCarteraDesdeEstado } from './carteraOficial'

describe('fueraCarteraDesdeEstado', () => {
  it('fail-open si la cartera no está cargada', () => {
    expect(
      fueraCarteraDesdeEstado({ carteraCargada: false, enCartera: false, excluidoMol: true }),
    ).toBe(false)
  })

  it('bloquea si el RUT no está en la tabla', () => {
    expect(
      fueraCarteraDesdeEstado({ carteraCargada: true, enCartera: false, excluidoMol: false }),
    ).toBe(true)
  })

  it('bloquea SUBDERE aunque el RUT esté en cartera (174202192)', () => {
    expect(
      fueraCarteraDesdeEstado({ carteraCargada: true, enCartera: true, excluidoMol: true }),
    ).toBe(true)
  })

  it('deja pasar un RUT en cartera y no excluido', () => {
    expect(
      fueraCarteraDesdeEstado({ carteraCargada: true, enCartera: true, excluidoMol: false }),
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/constants/carteraOficial.test.ts`
Expected: FAIL — `fueraCarteraDesdeEstado` is not exported

- [ ] **Step 3: Write minimal implementation**

En `src/constants/carteraOficial.ts` agregar (dejar título/mensaje/`filaFueraCarteraOficial` iguales):

```ts
export type EstadoCarteraOficial = {
  carteraCargada: boolean
  enCartera: boolean
  excluidoMol: boolean
}

export function fueraCarteraDesdeEstado(estado: EstadoCarteraOficial): boolean {
  return estado.carteraCargada && (!estado.enCartera || estado.excluidoMol)
}
```

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run src/constants/carteraOficial.test.ts`
Expected: PASS (4 tests)

---

### Task 2: API, store y tipos

**Files:**
- Modify: `src/services/carteraOficialApi.ts`
- Modify: `src/stores/datosAlumnoMnp.ts`
- Modify: `src/types/supabase.ts` (`MnpCarteraOficialRow`)

**Interfaces:**
- Consumes: `fueraCarteraDesdeEstado`, `EstadoCarteraOficial` de Task 1
- Produces: `estadoCarteraOficial(rut)` devuelve `EstadoCarteraOficial` (con `excluidoMol`); el store setea `fueraCarteraOficial` vía el helper

- [ ] **Step 1: Tipos**

En `MnpCarteraOficialRow` agregar:

```ts
excluido_mol?: boolean
```

- [ ] **Step 2: API**

Reemplazar el cuerpo de `src/services/carteraOficialApi.ts` por:

```ts
import { supabase } from '@/services/supabaseClient'
import type { EstadoCarteraOficial } from '@/constants/carteraOficial'
import { rutNorm } from '@/utils/rutNorm'

export type { EstadoCarteraOficial }

/**
 * Cruce contra `mnp_cartera_oficial` (Excel BASE PARA PRUEBA).
 * Si no hay cartera cargada, no bloquea (fail-open).
 */
export async function estadoCarteraOficial(
  rut: string | null | undefined,
): Promise<EstadoCarteraOficial> {
  const { count, error: countError } = await supabase
    .from('mnp_cartera_oficial')
    .select('rut_norm', { count: 'exact', head: true })

  if (countError || !count) {
    return { carteraCargada: false, enCartera: true, excluidoMol: false }
  }

  const norm = rutNorm(rut)
  if (!norm) {
    return { carteraCargada: true, enCartera: false, excluidoMol: false }
  }

  const { data, error } = await supabase
    .from('mnp_cartera_oficial')
    .select('rut_norm, excluido_mol')
    .eq('rut_norm', norm)
    .maybeSingle()

  if (error) {
    return { carteraCargada: false, enCartera: true, excluidoMol: false }
  }

  return {
    carteraCargada: true,
    enCartera: Boolean(data),
    excluidoMol: data?.excluido_mol === true,
  }
}
```

Borrar el `export type EstadoCarteraOficial` local si quedó duplicado.

- [ ] **Step 3: Store**

En `src/stores/datosAlumnoMnp.ts`:

```ts
import { fueraCarteraDesdeEstado } from '@/constants/carteraOficial'
```

En `verificarCarteraOficial`:

```ts
const estado = await estadoCarteraOficial(rut)
this.fueraCarteraOficial = fueraCarteraDesdeEstado(estado)
```

Comentario del state: `true = ausente del Excel oficial o excluido MOL (SUBDERE).`

- [ ] **Step 4: Type-check**

Run: `npx vue-tsc --build --force`
Expected: exit 0 (o solo errores preexistentes no introducidos por estos archivos)

---

### Task 3: Migración — refresh + seed SUBDERE

**Files:**
- Create: `docs/becas-beneficios/subdere-ruts-2027-01.txt`
- Create: `supabase/migrations/20260915150000_mnp_cartera_subdere_excluido_mol.sql`

**Interfaces:**
- Consumes: columna `mnp_cartera_oficial.excluido_mol` (`ADD COLUMN IF NOT EXISTS`)
- Produces: 62 `excluido_mol = true`; `refresh_fuera_cartera_oficial()` considera exclusión

- [ ] **Step 1: Extraer los 62 `rut_norm` del Excel**

```bash
python3 - <<'PY'
from openpyxl import load_workbook
from pathlib import Path
wb = load_workbook("/opt/mol-docker/docs/becas-beneficios/BASE PARA PRUEBA.xlsx", data_only=True, read_only=True)
ws = wb.active
rows = ws.iter_rows(values_only=True)
header = [str(c).strip() if c is not None else "" for c in next(rows)]
# header COHORTE tiene espacio; consolidado es col 16 (1-based)
idx_rut = header.index("RUT")
idx_dig = header.index("DIG")
idx_cons = next(i for i, h in enumerate(header) if h.startswith("CONSOLIDADO"))
ruts = []
for row in rows:
    if not row[idx_rut]:
        continue
    cons = row[idx_cons]
    if cons is None or str(cons).strip().upper() != "SUBDERE":
        continue
    cuerpo = str(int(row[idx_rut])) if isinstance(row[idx_rut], float) else str(row[idx_rut]).strip()
    dig = str(row[idx_dig]).strip().upper()
    ruts.append(cuerpo + dig)
wb.close()
ruts = sorted(set(ruts))
print("n=", len(ruts))
assert len(ruts) == 62, len(ruts)
assert "174202192" in ruts
out = Path("/opt/mol-docker/docs/becas-beneficios/subdere-ruts-2027-01.txt")
out.write_text("\n".join(ruts) + "\n", encoding="utf-8")
print(out)
PY
```

Expected: `n= 62` y el archivo con 62 líneas, incluida `174202192`.

- [ ] **Step 2: Write migration**

`supabase/migrations/20260915150000_mnp_cartera_subdere_excluido_mol.sql`:

```sql
-- SUBDERE: siguen en cartera, excluidos del flujo MOL (mismo bloqueo que fuera de cartera).

ALTER TABLE public.mnp_cartera_oficial
  ADD COLUMN IF NOT EXISTS excluido_mol boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.mnp_cartera_oficial.excluido_mol IS
  'true = fuera del flujo MOL (SUBDERE / NEDA). Sigue en cartera; no se borra.';

CREATE OR REPLACE FUNCTION public.refresh_fuera_cartera_oficial()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    n integer;
BEGIN
    UPDATE public.mnp_mv_plan_pagos_consolidado c
    SET fuera_cartera_oficial = NOT EXISTS (
        SELECT 1
        FROM public.mnp_cartera_oficial o
        WHERE o.excluido_mol = false
          AND o.rut_norm = regexp_replace(
            upper(replace(replace(coalesce(c.rut_alumno, ''), '.', ''), '-', '')),
            '[^0-9K]',
            '',
            'g'
        )
    );
    SELECT count(*)::integer INTO n
    FROM public.mnp_mv_plan_pagos_consolidado
    WHERE fuera_cartera_oficial;
    RETURN n;
END;
$$;

COMMENT ON FUNCTION public.refresh_fuera_cartera_oficial() IS
  'fuera_cartera_oficial = true si el RUT no está en mnp_cartera_oficial o excluido_mol.';

GRANT EXECUTE ON FUNCTION public.refresh_fuera_cartera_oficial() TO service_role;

-- Pegar los 62 rut_norm del txt generado en Step 1 (comillas simples, separados por coma).
UPDATE public.mnp_cartera_oficial
SET excluido_mol = true
WHERE rut_norm IN (
  -- REPLACE_WITH_62_RUTS
  '174202192'
);

-- Idempotente: el resto de SUBDERE se llena con el IN completo (62 valores).
```

Generar el `IN (...)` completo así (no dejar el placeholder):

```bash
python3 - <<'PY'
from pathlib import Path
ruts = Path("/opt/mol-docker/docs/becas-beneficios/subdere-ruts-2027-01.txt").read_text().split()
assert len(ruts) == 62
print(",\n  ".join(f"'{r}'" for r in ruts))
PY
```

Sustituir el `WHERE rut_norm IN (...)` por esa lista. Debe incluir `'174202192'`.

Luego, al final de la migración:

```sql
SELECT public.refresh_fuera_cartera_oficial();
```

- [ ] **Step 3: Apply and verify**

Aplicar la migración en el Postgres local del proyecto (mismo procedimiento que las migraciones MOL anteriores).

```sql
SELECT count(*) FROM public.mnp_cartera_oficial WHERE excluido_mol;
-- expected: 62

SELECT excluido_mol FROM public.mnp_cartera_oficial WHERE rut_norm = '174202192';
-- expected: true

SELECT count(*) FROM public.mnp_cartera_oficial;
-- expected: 4686 (no se borró nadie)

SELECT fuera_cartera_oficial
FROM public.mnp_mv_plan_pagos_consolidado
WHERE regexp_replace(upper(replace(replace(coalesce(rut_alumno,''),'.',''),'-','')),'[^0-9K]','','g') = '174202192';
-- expected: true en las filas que existan en consolidado
```

- [ ] **Step 4: Unit tests still pass**

Run: `npx vitest run src/constants/carteraOficial.test.ts`
Expected: PASS

- [ ] **Step 5: Spec status**

En `docs/superpowers/specs/2026-09-15-subdere-fuera-mol-design.md` cambiar Estado a: `implementado (excluido_mol + refresh). Sin bandeja NEDA.`

---

## Spec coverage

| Spec | Task |
|------|------|
| Siguen en `mnp_cartera_oficial`, no se borran | Task 3 UPDATE, count 4686 |
| `excluido_mol` / SUBDERE | Task 3 seed 62 |
| `refresh_fuera_cartera_oficial` = no en tabla **o** excluido | Task 3 función |
| Mismo copy de fuera de cartera | Task 1/2; UI existente |
| `prelacionArancel` no corre (guard antes) | router + `fueraCarteraOficial` |
| Caso `17420219-2` | Task 1 test + Task 3 SQL |
| Fuera de alcance: bandeja NEDA, 1 cuota U+, detección ERP | no hay task |
