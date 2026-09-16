# Beneficios desde Excel (no U+) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar y calcular beneficios de rematrícula solo desde el Excel de cartera, con `cod_beneficio` mapeado para un grab futuro a U+.

**Architecture:** Tabla `mnp_cartera_beneficios` cargada por script desde `BASE PARA PRUEBA.xlsx`. Match nombre → `mnp_mv_beneficio_periodo`. Forma de pago deja de leer `beneficios_detalle` U+ y consume esta tabla por `codcli_excel` / RUT.

**Tech Stack:** Postgres/Supabase, Python openpyxl + psycopg2, Vue 3 + TypeScript, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-16-beneficios-desde-excel-design.md`
- Fuente: Excel `BASE PARA PRUEBA.xlsx` (no `beneficios_detalle` U+)
- Llave: `rut_norm` + `codcli_excel`; PK `(periodo, codcli_excel)`
- Periodo cartera v1: `2027-01`
- Mostrar `cod_beneficio` en UI (requerido para insertar luego en U+)
- Caso éxito: `12946085-7` / `20152PSIC1SR039` → solo Apoyo UNIACC con código **1756**; sin 1791
- Composition API; tipos explícitos; sin `any`
- No commit salvo que el usuario lo pida
- v1 no escribe beneficios a U+

## File map

| Archivo | Rol |
|---------|-----|
| `src/utils/becaNombreMatch.ts` | Normalizar nombre + match catálogo → código |
| `src/utils/becaNombreMatch.test.ts` | Vitest |
| `src/utils/carteraBeneficiosUi.ts` | Filas Excel → ítems UI / input prelación |
| `src/utils/carteraBeneficiosUi.test.ts` | Vitest caso Vanessa |
| `supabase/migrations/20260916120000_mnp_cartera_beneficios.sql` | Tabla + RLS + RPC lectura |
| `scripts/load_cartera_beneficios.py` | ETL Excel → tabla |
| `src/services/carteraBeneficiosApi.ts` | Client RPC/select |
| `src/types/supabase.ts` | Tipos |
| `src/views/matricula-mock/FormaPagoMockView.vue` | Tarjeta + cálculo desde Excel |

---

### Task 1: Match nombre beca → `cod_beneficio`

**Files:**
- Create: `src/utils/becaNombreMatch.ts`
- Create: `src/utils/becaNombreMatch.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `export function normalizarNombreBeca(nombre: string | null | undefined): string`
  - `export function esSinBeca(nombre: string | null | undefined): boolean`
  - `export function matchCodBeneficio(nombreExcel: string | null | undefined, catalogo: { codigo_beneficio: string; beneficio: string }[]): string | null`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { esSinBeca, matchCodBeneficio, normalizarNombreBeca } from './becaNombreMatch'

const CAT = [
  { codigo_beneficio: '1756', beneficio: 'Beneficio Apoyo UNIACC Renovable' },
  { codigo_beneficio: '1791', beneficio: 'DESCUENTO ANTICIPACION MATRICULA NUEVO' },
]

describe('becaNombreMatch', () => {
  it('normaliza espacios dobles', () => {
    expect(normalizarNombreBeca('Beneficio  Apoyo UNIACC Renovable')).toBe(
      'beneficio apoyo uniacc renovable',
    )
  })

  it('Sin beca → true', () => {
    expect(esSinBeca('Sin beca')).toBe(true)
    expect(esSinBeca(null)).toBe(true)
  })

  it('Apoyo UNIACC → 1756 aunque Excel tenga doble espacio', () => {
    expect(matchCodBeneficio('Beneficio  Apoyo UNIACC Renovable', CAT)).toBe('1756')
  })

  it('nombre desconocido → null', () => {
    expect(matchCodBeneficio('Beca inventada XYZ', CAT)).toBe(null)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd /opt/mol-docker && npx vitest run --config vitest.unit.config.ts src/utils/becaNombreMatch.test.ts`

- [ ] **Step 3: Implement**

```ts
export function normalizarNombreBeca(nombre: string | null | undefined): string {
  return (nombre ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function esSinBeca(nombre: string | null | undefined): boolean {
  const n = normalizarNombreBeca(nombre)
  return !n || n === 'sin beca' || n === '-' || n === 'n/a'
}

export function matchCodBeneficio(
  nombreExcel: string | null | undefined,
  catalogo: { codigo_beneficio: string; beneficio: string }[],
): string | null {
  if (esSinBeca(nombreExcel)) return null
  const target = normalizarNombreBeca(nombreExcel)
  const hit = catalogo.find((c) => normalizarNombreBeca(c.beneficio) === target)
  return hit?.codigo_beneficio?.trim() || null
}
```

- [ ] **Step 4: Run — expect PASS**

---

### Task 2: UI mapper cartera → ítems beneficios

**Files:**
- Create: `src/utils/carteraBeneficiosUi.ts`
- Create: `src/utils/carteraBeneficiosUi.test.ts`

**Interfaces:**
- Consumes: nada (tipos locales)
- Produces:
  - `export type CarteraBeneficioRow = { periodo: string; rut_norm: string; codcli_excel: string; beca_1: string | null; pct_1: number | null; beca_2: string | null; pct_2: number | null; consolidado: string | null; cod_beneficio_1: string | null; cod_beneficio_2: string | null }`
  - `export type BeneficioExcelUiItem = { slot: 1 | 2; descripcion: string; cod_beneficio: string | null; pct: number | null; sinMapear: boolean }`
  - `export function itemsBeneficioDesdeCartera(row: CarteraBeneficioRow | null): BeneficioExcelUiItem[]`
  - `export function flagsConsolidado(consolidado: string | null): { cae: boolean; ministerial: boolean; subdere: boolean }`

- [ ] **Step 1: Failing test — caso Vanessa**

```ts
it('12946085 solo Apoyo 1756; no inventa 1791', () => {
  const items = itemsBeneficioDesdeCartera({
    periodo: '2027-01',
    rut_norm: '129460857',
    codcli_excel: '20152PSIC1SR039',
    beca_1: 'Beneficio Apoyo UNIACC Renovable',
    pct_1: 10,
    beca_2: null,
    pct_2: null,
    consolidado: null,
    cod_beneficio_1: '1756',
    cod_beneficio_2: null,
  })
  expect(items).toHaveLength(1)
  expect(items[0].cod_beneficio).toBe('1756')
  expect(items.some((i) => i.cod_beneficio === '1791')).toBe(false)
})
```

- [ ] **Step 2: Implement** — omitir slots sin texto de beca; `sinMapear = !cod_beneficio` cuando hay texto.

- [ ] **Step 3: Tests PASS**

---

### Task 3: Migración SQL + RPC lectura

**Files:**
- Create: `supabase/migrations/20260916120000_mnp_cartera_beneficios.sql`
- Modify: `src/types/supabase.ts`

**Interfaces:**
- Produces table `mnp_cartera_beneficios` + RPC:
  - `consultar_cartera_beneficios(p_periodo text, p_codcli_excel text, p_rut_norm text) returns setof mnp_cartera_beneficios`
  - Prefer match `codcli_excel`; si vacío, fallback `rut_norm` (puede devolver >1 fila — el caller elige).

- [ ] **Step 1: CREATE TABLE** (campos del spec; PK `(periodo, codcli_excel)`; index `rut_norm`)

```sql
CREATE TABLE IF NOT EXISTS public.mnp_cartera_beneficios (
  periodo text NOT NULL CHECK (periodo ~ '^\d{4}-0[12]$'),
  rut_norm text NOT NULL,
  codcli_excel text NOT NULL,
  codcarpr text,
  beca_1 text,
  pct_1 numeric(8, 2),
  beca_2 text,
  pct_2 numeric(8, 2),
  consolidado text,
  cod_beneficio_1 text,
  cod_beneficio_2 text,
  loaded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (periodo, codcli_excel)
);
CREATE INDEX IF NOT EXISTS idx_mnp_cartera_beneficios_rut
  ON public.mnp_cartera_beneficios (periodo, rut_norm);
```

- [ ] **Step 2: RLS** — SELECT para `anon, authenticated` (lectura backoffice/mock) o SECURITY DEFINER RPC only (preferir **RPC** si el resto de logs niega SELECT; si cartera oficial permite SELECT, alinear con `mnp_cartera_oficial_select`).

Recomendación: mismo patrón que `mnp_cartera_oficial` (SELECT true para authenticated/anon) + GRANT.

- [ ] **Step 3: RPC `consultar_cartera_beneficios`**

```sql
-- Si p_codcli_excel not null: WHERE periodo = p_periodo AND codcli_excel = p_codcli_excel
-- Elsif p_rut_norm not null: WHERE periodo AND rut_norm
-- Else: empty
```

- [ ] **Step 4: Types** `MnpCarteraBeneficiosRow` + Functions en `supabase.ts`

- [ ] **Step 5: Apply migration** en entorno disponible; verificar `\d mnp_cartera_beneficios`

---

### Task 4: Script de carga Excel

**Files:**
- Create: `scripts/load_cartera_beneficios.py`

**Interfaces:**
- Consumes: Excel path (env `CARTERA_XLSX`), DSN como `load_cartera_email_ejecutivo.py`, catálogo desde DB `mnp_mv_beneficio_periodo` WHERE `periodo='2027-01'` **o** CSV `docs/becas-beneficios/cod_beneficios_flujos_2027-01.csv` (col0=código, col1=nombre) si DB vacía.
- Produces: UPSERT filas en `mnp_cartera_beneficios`

- [ ] **Step 1: Leer Excel** columnas `CODCLI`, `RUT`, `DIG`, `CODCARPR`, `BECA 1`, `%` (col 35), `BECA 2`, `%` (col 37), `CONSOLIDADO CAE-BECA MINISTERIAL-SUBDERE`

Nota: hay dos columnas `%`; usar índices por posición tras header o nombres únicos si el Excel las distingue. Si ambas se llaman `%`, usar índice numérico: BECA1→col35, BECA2→col37 (verificar en load).

- [ ] **Step 2: Match** — reimplementar normalización en Python (misma regla que Task 1) o llamar lógica equivalente; set `cod_beneficio_1/2`.

- [ ] **Step 3: UPSERT**

```sql
INSERT INTO mnp_cartera_beneficios (...)
VALUES (...)
ON CONFLICT (periodo, codcli_excel) DO UPDATE SET ...
```

Periodo fijo `2027-01` (env `CARTERA_PERIODO` override).

- [ ] **Step 4: Run dry / load**

```bash
cd /opt/mol-docker
# con DSN:
python3 scripts/load_cartera_beneficios.py
# Verificar:
# SELECT * FROM mnp_cartera_beneficios WHERE codcli_excel = '20152PSIC1SR039';
# Esperado: beca_1 Apoyo…, cod_beneficio_1 = 1756, beca_2 null
```

Print: `rows=N matched1=M unmatched1=U`

---

### Task 5: API front + FormaPagoMockView

**Files:**
- Create: `src/services/carteraBeneficiosApi.ts`
- Modify: `src/views/matricula-mock/FormaPagoMockView.vue`

**Interfaces:**
- Consumes: RPC Task 3; `itemsBeneficioDesdeCartera`; `periodoCatalogoLabel` / periodo fijo `2027-01` según spec (si periodo activo MOL aún no es 2027-01, **usar `2027-01` hardcodeado o env** para cartera Excel — documentar constante `PERIODO_CARTERA_BENEFICIOS = '2027-01'`)
- Produces: tarjeta y cálculo sin U+ detalle

- [ ] **Step 1: `consultarCarteraBeneficios({ periodo, codcliExcel, rutNorm })`**

- [ ] **Step 2: En FormaPagoMockView**
  - Al montar / al cambiar alumno: fetch cartera beneficios con `codcli` mostrado (tratar como `codcli_excel` cuando coincide) + `rutNorm`.
  - Reemplazar `beneficios` computed: **no** usar `plan.beneficios_detalle`.
  - Usar `itemsBeneficioDesdeCartera(row)`.
  - UI: descripción, `cod_beneficio` (o badge “sin mapear”), `%`, checkbox solo si `!sinMapear`.
  - Subtítulo periodo: `row.periodo` / `2027-01`.
  - Flags consolidado (texto pequeño CAE/ministerial si aplica).

- [ ] **Step 3: `calcularBecasMock`**
  - Construir items solo con `cod_beneficio` + pct Excel.
  - Si existe `aplicarPrelacionArancel` + catálogo flujo, llamar; si no, toast con lista de códigos/pct aplicados (mínimo: no usar U+).
  - Preferir: mapear a `ItemPrelacionInput` usando `flujo` desde `mnp_mv_beneficio_periodo` (fetch catálogo o join en row) — si v1 es pesado, toast + log de ítems Excel con código basta y dejar prelación plena en task follow-up. **Mínimo spec:** cálculo no mezcla U+; usa Excel+código.

- [ ] **Step 4: Smoke** mock alumno `12946085-7` / `20152PSIC1SR039`: tarjeta 1 fila, código 1756, sin 1791.

---

### Task 6: Verificación

- [ ] **Step 1:** SQL

```sql
SELECT beca_1, cod_beneficio_1, beca_2, cod_beneficio_2
FROM mnp_cartera_beneficios
WHERE periodo = '2027-01' AND codcli_excel = '20152PSIC1SR039';
```

Expected: `cod_beneficio_1='1756'`, `beca_2` null.

- [ ] **Step 2:** Count unmatched

```sql
SELECT count(*) FROM mnp_cartera_beneficios
WHERE periodo='2027-01' AND beca_1 IS NOT NULL AND btrim(beca_1) <> ''
  AND lower(btrim(beca_1)) NOT IN ('sin beca') AND cod_beneficio_1 IS NULL;
```

Report number; if alto, mejorar match (aliases).

- [ ] **Step 3:** Unit tests Tasks 1–2 PASS.

- [ ] **Step 4:** Checklist spec éxito Vanessa + “no 1791”.

---

## Spec coverage

| Spec | Task |
|------|------|
| Tabla + PK + campos | 3 |
| Carga Excel + match código | 1, 4 |
| UI periodo 2027-01 + cod visible | 2, 5 |
| Cálculo sin U+ | 5 |
| Caso 12946085-7 | 2, 4, 6 |
| Grab U+ | fuera v1 ✓ |

**Nota:** Matching imperfecto de nombres → `sin mapear`; no bloquear carga. Alias manual (mapa estático) solo si el count de unmatched lo exige en Task 6.
