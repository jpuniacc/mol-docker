# Catálogo beneficios por periodo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persistir en Supabase los 67 códigos de beneficios de 2027-01, con `periodo`, `flujo` y `aplica`, más una vista de los que aplican.

**Architecture:** Tabla física `mnp_mv_beneficio_periodo` (seed en la migración). Vista `v_mnp_mv_convenios` = `aplica = true`. Clasificador TypeScript con tests (misma regla que el seed). Tipos en `src/types/supabase.ts`. Sin mock ni mantenedor.

**Tech Stack:** Postgres/Supabase migrations, Vue 3 + TypeScript types, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-10-beneficio-periodo-design.md`
- Solo periodo `2027-01` (formato `YYYY-0S`)
- 67 filas; 36 `aplica = true`; código 2026 `aplica = false` / `EN_REVISION`
- No tocar `tp_mnp_convenio`
- RLS SELECT only (anon, authenticated, service_role)
- Composition API / tipos explícitos; sin `any`
- No commit a menos que el usuario lo pida

## File map

| Archivo | Rol |
|---------|-----|
| `src/utils/beneficioPeriodo.ts` | Clasificador Excel → flujo / aplica / certificado |
| `src/utils/beneficioPeriodo.test.ts` | Unit tests de la regla |
| `supabase/migrations/20260910120000_mnp_mv_beneficio_periodo.sql` | Tabla, vista, RLS, seed 67 |
| `src/types/supabase.ts` | `MnpMvBeneficioPeriodoRow` + Tables/Views |

---

### Task 1: Clasificador + tests

**Files:**
- Create: `src/utils/beneficioPeriodo.ts`
- Test: `src/utils/beneficioPeriodo.test.ts`

**Interfaces:**
- Produces: `BeneficioFlujo`, `clasificarBeneficioExcel({ renovable, convenio })`

- [x] **Step 1:** Test que falle (import no existe)
- [x] **Step 2:** Implementar clasificador
- [x] **Step 3:** `npx vitest run src/utils/beneficioPeriodo.test.ts` PASS

### Task 2: Migración + seed + tipos

**Files:**
- Create: `supabase/migrations/20260910120000_mnp_mv_beneficio_periodo.sql`
- Modify: `src/types/supabase.ts`

- [x] **Step 1:** CREATE TABLE + checks + unique `(periodo, codigo_beneficio)`
- [x] **Step 2:** Vista `v_mnp_mv_convenios`, RLS, GRANT SELECT
- [x] **Step 3:** INSERT 67 filas `2027-01` alineadas al CSV/clasificador
- [x] **Step 4:** Tipos Table + View
- [x] **Step 5:** Aplicar en Postgres local y verificar conteos (67 / 36 / 2026 false)

### Task 3: Verificación

- [x] Tests unitarios en verde
- [x] SQL: 67 total, 36 aplica, 0 filas periodo 2026, código 2026 no aplica
