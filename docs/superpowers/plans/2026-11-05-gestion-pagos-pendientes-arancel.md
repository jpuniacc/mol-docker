# Gestión Pagos (matrícula Webpay sin arancel) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menú **Gestión Pagos** con alumnos del periodo activo que tienen matrícula Webpay autorizada y aún no cerraron arancel (ni Webpay arancel autorizada ni TuFirma enviada), con contacto OTP validado y export CSV/Excel; ocultar Seguimiento.

**Architecture:** RPC Supabase `listar_gestion_pagos_pendientes_arancel` arma el universo (Webpay + contacto + demografía, excluye Webpay arancel y arancel cubierto). `uniacc-api` llama el RPC, filtra filas con `rematricula_contrato_tufirma` del periodo, y expone `GET /api/rematricula/reportes/gestion-pagos`. MOL consume el API, pagina de a 10 y exporta.

**Tech Stack:** Supabase Postgres (RPC + `bo_menu_item`), uniacc-api (Express/TS + `querySupabase` + Postgres mnp), mol Vue 3 + Composition API + `xlsx` + `useTablaPaginada`.

**Spec:** `docs/superpowers/specs/2026-11-05-gestion-pagos-pendientes-arancel-design.md`

## Global Constraints

- Periodo: solo `tp_periodo_activo` (sin selector en UI)
- Sale del listado: Webpay arancel autorizada **o** fila TuFirma enviada (no basta pagaré en borrador)
- Contacto: `contactoCorreoValidado` / `contactoTelefonoValidado` del borrador; si falta → `—`
- Page size UI: **10**
- Sin montos, buy_order, ni botones tel:/mailto:
- Ocultar menú Seguimiento; no borrar la ruta aún (solo `activo = false`)

## File map

| Archivo | Rol |
|---------|-----|
| `mol-docker/supabase/migrations/20261105180000_gestion_pagos_pendientes_arancel.sql` | RPC + menú |
| `uniacc-api-docker/src/services/gestion-pagos.service.ts` | RPC + filtro TuFirma |
| `uniacc-api-docker/src/services/gestion-pagos.service.test.ts` | Unit filtro TuFirma |
| `uniacc-api-docker/src/controllers/rematricula-gestion-pagos.controller.ts` | HTTP |
| `uniacc-api-docker/src/routes/rematricula-gestion-pagos.routes.ts` | Router |
| `uniacc-api-docker/src/index.ts` | Mount ruta |
| `mol-docker/src/utils/gestionPagos.ts` (+ `.test.ts`) | Parse fila + CSV/matriz export |
| `mol-docker/src/services/gestionPagosApi.ts` | Cliente HTTP |
| `mol-docker/src/views/dashboard/rematricula/GestionPagosView.vue` | UI |
| `mol-docker/src/router/index.ts` | Ruta |
| `mol-docker/src/constants/dashboardRouteNames.ts` | Allowlist menú |

---

### Task 1: Helpers puros filtro TuFirma (API)

**Files:**
- Create: `uniacc-api-docker/src/services/gestion-pagos-filtro.ts`
- Create: `uniacc-api-docker/src/services/gestion-pagos-filtro.test.ts`

**Interfaces:**
- Consumes: `parsePeriodoFirma` from `./contrato-firma-medios`
- Produces:
  - `export type GestionPagosRpcRow = { codcli: string; rut: string | null; rut_norm: string | null; nombre_alumno: string | null; codigo_carrera: string | null; nombre_carrera: string | null; telefono: string | null; email: string | null; fecha_pago_matricula: string | null; anio: number; semestre: number }`
  - `export type TuFirmaClave = { codcli: string | null; rut: string | null; periodo: string | null }`
  - `export function filaTieneTufirmaEnviada(row: GestionPagosRpcRow, tufirma: TuFirmaClave[]): boolean`
  - `export function filtrarSinTufirma(rows: GestionPagosRpcRow[], tufirma: TuFirmaClave[]): GestionPagosRpcRow[]`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { filtrarSinTufirma, type GestionPagosRpcRow } from './gestion-pagos-filtro'

const base: GestionPagosRpcRow = {
  codcli: '12345',
  rut: '12.345.678-9',
  rut_norm: '123456789',
  nombre_alumno: 'Ana',
  codigo_carrera: 'PER',
  nombre_carrera: 'Periodismo',
  telefono: '987654321',
  email: 'ana@mail.cl',
  fecha_pago_matricula: '2026-11-01T12:00:00.000Z',
  anio: 2027,
  semestre: 1,
}

describe('filtrarSinTufirma', () => {
  it('saca fila si hay tufirma mismo codcli y periodo 2027-1', () => {
    const out = filtrarSinTufirma([base], [
      { codcli: '12345', rut: null, periodo: '2027-1' },
    ])
    assert.equal(out.length, 0)
  })

  it('mantiene fila si tufirma es otro periodo', () => {
    const out = filtrarSinTufirma([base], [
      { codcli: '12345', rut: null, periodo: '2026-2' },
    ])
    assert.equal(out.length, 1)
  })

  it('saca por rut_norm si codcli tufirma null', () => {
    const out = filtrarSinTufirma([base], [
      { codcli: null, rut: '12345678-9', periodo: '2027/1' },
    ])
    assert.equal(out.length, 0)
  })

  it('mantiene si no hay tufirma', () => {
    assert.equal(filtrarSinTufirma([base], []).length, 1)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/gestion-pagos-filtro.test.ts`  
Expected: FAIL module not found / function not defined

- [ ] **Step 3: Implement**

```ts
import { parsePeriodoFirma } from './contrato-firma-medios'

export type GestionPagosRpcRow = {
  codcli: string
  rut: string | null
  rut_norm: string | null
  nombre_alumno: string | null
  codigo_carrera: string | null
  nombre_carrera: string | null
  telefono: string | null
  email: string | null
  fecha_pago_matricula: string | null
  anio: number
  semestre: number
}

export type TuFirmaClave = {
  codcli: string | null
  rut: string | null
  periodo: string | null
}

function rutNorm(v: string | null | undefined): string | null {
  if (v == null) return null
  const n = String(v).replace(/[^0-9Kk]/gi, '').toUpperCase()
  return n.length ? n : null
}

export function filaTieneTufirmaEnviada(
  row: GestionPagosRpcRow,
  tufirma: TuFirmaClave[],
): boolean {
  const rowRut = rutNorm(row.rut_norm) ?? rutNorm(row.rut)
  for (const t of tufirma) {
    const p = parsePeriodoFirma(t.periodo)
    if (!p || p.anio !== row.anio || p.semestre !== row.semestre) continue
    const tCod = (t.codcli ?? '').trim()
    if (tCod && tCod === row.codcli) return true
    const tRut = rutNorm(t.rut)
    if (tRut && rowRut && (tRut === rowRut || rowRut.startsWith(tRut) || tRut.startsWith(rowRut.replace(/[Kk]$/, '')))) {
      return true
    }
  }
  return false
}

export function filtrarSinTufirma(
  rows: GestionPagosRpcRow[],
  tufirma: TuFirmaClave[],
): GestionPagosRpcRow[] {
  return rows.filter((r) => !filaTieneTufirmaEnviada(r, tufirma))
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/gestion-pagos-filtro.test.ts`

- [ ] **Step 5: Commit** (solo si el usuario lo pide en esta sesión; si no, dejar staged mentalmente y seguir)

```bash
cd /opt/uniacc-api-docker && git add src/services/gestion-pagos-filtro.ts src/services/gestion-pagos-filtro.test.ts
git commit -m "$(cat <<'EOF'
feat: filtro TuFirma para listado Gestión Pagos

EOF
)"
```

---

### Task 2: RPC Supabase + menú

**Files:**
- Create: `mol-docker/supabase/migrations/20261105180000_gestion_pagos_pendientes_arancel.sql`

**Interfaces:**
- Produces RPC `public.listar_gestion_pagos_pendientes_arancel(p_anio int, p_semestre int)` → columnas alineadas a `GestionPagosRpcRow` (sin filtrar TuFirma)
- Menú: desactiva Seguimiento; inserta Gestión Pagos id `b0000001-0001-4000-8000-000000000082`, parent `…000020`, route `dashboard-gestion-pagos`, icon `Wallet`, orden 27, grupo 1

- [ ] **Step 1: Write migration**

Lógica SQL (misma join Webpay que `listar_reporte_pagos_rematricula`):

1. Resolver alumnos con tx `mnp_webpay_transaccion` `estado='autorizada'` `concepto='matricula'` en `(p_anio, p_semestre)`; `DISTINCT ON` alumno + orden `actualizado_en DESC` → `fecha_pago_matricula`.
2. Match alumno: `w.codcli = p.codcli` **o** prefijo `rut_norm` (igual reporte pagos). Universo demográfico: `mnp_progreso_rematricula` del periodo (cualquier etapa) **o**, si no hay progreso, intentar resolver `codcli`/nombre desde borrador/`mnp_matricula_cartera_canal` canal MOL. Preferir siempre fila de progreso cuando exista.
3. Excluir si existe Webpay arancel autorizada (mismo match).
4. Excluir arancel cubierto: borrador con `pagoMatricula` donde suma montos de `cuotasDetalle` con `item::int = 2` ≤ 0 **y** existe descuento `concepto` in (`arancel`,`A`) — espejo de `esArancelCubiertoPayload`.
5. Contacto: `nullif(trim(b.payload->>'contactoTelefonoValidado'),'')`, `nullif(trim(b.payload->>'contactoCorreoValidado'),'')`.
6. `RETURNS TABLE (codcli, rut, rut_norm, nombre_alumno, codigo_carrera, nombre_carrera, telefono, email, fecha_pago_matricula, anio, semestre)`.
7. `SECURITY DEFINER`, `STABLE`, `search_path = public`, `GRANT EXECUTE` al rol que usan otras RPC de reportes (copiar grants de `listar_reporte_pagos_rematricula` si existen al final del archivo de pagos; si no hay GRANT explícito, solo `NOTIFY pgrst`).
8. Menú:

```sql
UPDATE public.bo_menu_item
SET activo = false, updated_at = now()
WHERE route_name = 'dashboard-rematricula-seguimiento';

INSERT INTO public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo)
VALUES (
  'b0000001-0001-4000-8000-000000000082',
  'b0000001-0001-4000-8000-000000000020',
  'link',
  'Gestión Pagos',
  'dashboard-gestion-pagos',
  'Wallet',
  27,
  true
)
ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  tipo = EXCLUDED.tipo,
  label = EXCLUDED.label,
  route_name = EXCLUDED.route_name,
  icon_key = EXCLUDED.icon_key,
  orden = EXCLUDED.orden,
  activo = EXCLUDED.activo;

INSERT INTO public.bo_menu_item_grupo (menu_item_id, codigo_grupo)
VALUES ('b0000001-0001-4000-8000-000000000082', 1)
ON CONFLICT (menu_item_id, codigo_grupo) DO NOTHING;

NOTIFY pgrst, 'reload schema';
```

Si `bo_menu_item` no tiene `updated_at`, omitir esa columna en el `UPDATE`.

- [ ] **Step 2: Apply on dev Supabase** (cuando toque desplegar; en implementación local aplicar con el flujo habitual del equipo)

- [ ] **Step 3: Smoke SQL** (dev)

```sql
SELECT * FROM public.listar_gestion_pagos_pendientes_arancel(2027, 1) LIMIT 20;
```

Expected: filas con `fecha_pago_matricula` not null; nadie con webpay arancel autorizada en cruce manual.

- [ ] **Step 4: Commit** (si el usuario lo pide)

---

### Task 3: Servicio + HTTP Gestión Pagos (API)

**Files:**
- Create: `uniacc-api-docker/src/services/gestion-pagos.service.ts`
- Create: `uniacc-api-docker/src/controllers/rematricula-gestion-pagos.controller.ts`
- Create: `uniacc-api-docker/src/routes/rematricula-gestion-pagos.routes.ts`
- Modify: `uniacc-api-docker/src/index.ts` (import + `app.use` + log línea)
- Create: `uniacc-api-docker/src/services/gestion-pagos.service.test.ts` (map row / iso fecha con mock deps si el estilo del repo lo permite; mínimo test de `mapRpcRow`)

**Interfaces:**
- Consumes: `querySupabase`, pool Postgres API (`getPostgres` / cliente que usa `tufirma-contrato.service` para `rematricula_contrato_tufirma`), `filtrarSinTufirma`
- Produces: `listarGestionPagos(anio, semestre): Promise<{ filas: GestionPagosRpcRow[] }>`
- HTTP: `GET /api/rematricula/reportes/gestion-pagos?anio=&semestre=` → `{ filas: [...] }` (camelCase o snake igual que grabado-up; **usar snake_case de RPC** en JSON para alinear con front parse)

- [ ] **Step 1: Implement `gestion-pagos.service.ts`**

```ts
// Pseudocódigo obligatorio a completar con imports reales del repo:
// 1) querySupabase(`SELECT * FROM public.listar_gestion_pagos_pendientes_arancel($1,$2)`, [anio, semestre])
// 2) query API PG: SELECT codcli, rut, periodo FROM rematricula_contrato_tufirma
// 3) return { filas: filtrarSinTufirma(mapped, tufirma) }
// Mapear fechas Date → toISOString(); nulls limpios; codcli String obligatorio (skip fila sin codcli)
```

Reusar el mismo client PG que `listContratoFirma` / `createDefaultTuFirmaContratoDeps` para no inventar otro pool.

- [ ] **Step 2: Controller + routes**

```ts
// controller: leer anio/semestre query, validar Number.isInteger, 400 si faltan
// routes: router.get('/', listarGestionPagosHttp)
// index: app.use('/api/rematricula/reportes/gestion-pagos', rematriculaGestionPagosRoutes)
```

- [ ] **Step 3: Test map / filtro integración ligera**

Extender o añadir test que `filtrarSinTufirma` se invoque con periodo parseado (puede vivir en `gestion-pagos.service.test.ts` exportando `mapRow` si se extrae).

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/gestion-pagos-filtro.test.ts src/services/gestion-pagos.service.test.ts`

- [ ] **Step 4: Commit** (si el usuario lo pide)

---

### Task 4: Utils + API client MOL

**Files:**
- Create: `mol-docker/src/utils/gestionPagos.ts`
- Create: `mol-docker/src/utils/gestionPagos.test.ts`
- Create: `mol-docker/src/services/gestionPagosApi.ts`

**Interfaces:**
- Produces:
  - `export type FilaGestionPagos = { codcli: string; rut: string; nombre: string; carrera: string; telefono: string; email: string; fechaPagoMatricula: string | null }`
  - `parseFilaGestionPagos(raw: unknown): FilaGestionPagos | null`
  - `filasGestionPagosACsv(filas: FilaGestionPagos[]): string`
  - `filasGestionPagosAMatriz(filas: FilaGestionPagos[]): (string | number)[][]` (header + rows)
  - `listarGestionPagos(anio, semestre): Promise<{ data: FilaGestionPagos[]; error: string | null }>`

- [ ] **Step 1: Failing vitest**

```ts
import { describe, expect, it } from 'vitest'
import {
  filasGestionPagosACsv,
  filasGestionPagosAMatriz,
  parseFilaGestionPagos,
} from './gestionPagos'

describe('gestionPagos', () => {
  it('parsea snake_case del API', () => {
    const f = parseFilaGestionPagos({
      codcli: '1',
      rut: '1-9',
      nombre_alumno: 'Ana',
      nombre_carrera: 'Periodismo',
      telefono: '987654321',
      email: 'a@b.cl',
      fecha_pago_matricula: '2026-11-01T15:00:00.000Z',
    })
    expect(f?.nombre).toBe('Ana')
    expect(f?.fechaPagoMatricula).toBe('2026-11-01T15:00:00.000Z')
  })

  it('csv incluye header y fila', () => {
    const f = parseFilaGestionPagos({
      codcli: '1', rut: '1-9', nombre_alumno: 'Ana', nombre_carrera: 'P',
      telefono: null, email: null, fecha_pago_matricula: null,
    })!
    const csv = filasGestionPagosACsv([f])
    expect(csv.split('\n')[0]).toContain('RUT')
    expect(csv).toContain('Ana')
  })

  it('matriz excel tiene header', () => {
    expect(filasGestionPagosAMatriz([])[0][0]).toBe('RUT')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd /opt/mol-docker && npm run test:unit -- src/utils/gestionPagos.test.ts`

- [ ] **Step 3: Implement utils + `gestionPagosApi.ts`**

Patrón fetch: copiar `reportesGrabadoUpApi.ts` (`admisionApiBaseUrl`, `urlConCarteraEjecutivo`, timeout 90s).  
Path: `/api/rematricula/reportes/gestion-pagos?anio=&semestre=`  
CSV: BOM `\ufeff`, columnas `RUT,Nombre,Codcli,Carrera,Teléfono,Email,Fecha pago matrícula`.  
Teléfono/email vacíos → celda vacía en export; en UI se muestra `—`.

- [ ] **Step 4: Tests PASS**

- [ ] **Step 5: Commit** (si el usuario lo pide)

---

### Task 5: Vista + router + allowlist

**Files:**
- Create: `mol-docker/src/views/dashboard/rematricula/GestionPagosView.vue`
- Modify: `mol-docker/src/router/index.ts` (ruta hermana de seguimiento / firmas)
- Modify: `mol-docker/src/constants/dashboardRouteNames.ts` (añadir `'dashboard-gestion-pagos'`)

**UI requirements:**
- `usePeriodoActivoStore().ensureLoaded()`; si no hay periodo, mensaje claro
- Cargar `listarGestionPagos(anio, semestre)` onMounted
- Búsqueda RUT/nombre/codcli (cliente)
- `useTablaPaginada(filasVisibles, 10)` + Anterior/Siguiente como `GestionFirmasView`
- Columnas: RUT · Nombre · Codcli · Carrera · Teléfono · Email · Fecha pago matrícula (`dd/mm/yyyy HH:mm` o `—`)
- Botones Exportar CSV y Excel (`xlsx`, patrón `ReportesPagosRematriculaView`) sobre **filas filtradas**, no solo página
- Meta ruta: mismos guards que Seguimiento (`requiresAdminAdmision`, `requiresSoloGrupoDvU`, `requiresPerfilUsuarioIn: [1,2,3]`)
- path: `/dashboard/gestion-pagos`, name: `dashboard-gestion-pagos`

- [ ] **Step 1: Añadir route name a allowlist + ruta lazy**

- [ ] **Step 2: Implementar `GestionPagosView.vue`** (Composition API, shadcn Table/Card/Button/Input, iconos Lucide `Download` / `Wallet` opcional)

- [ ] **Step 3: Smoke manual**

1. Menú muestra Gestión Pagos; no Seguimiento (tras migración)
2. Listado carga periodo activo
3. Buscar + paginar 10
4. Export CSV/Excel abre archivo con mismas filas filtradas
5. Alumno con TuFirma no aparece; con solo pagaré borrador sí

- [ ] **Step 4: `npm run type-check` en mol** (arreglar tipos si fallan)

- [ ] **Step 5: Commit** (si el usuario lo pide)

---

## Spec coverage checklist

| Spec | Task |
|------|------|
| Ocultar Seguimiento + menú Gestión Pagos | 2 |
| Periodo activo fijo | 3–5 (API params desde store periodo) |
| Entra: Webpay matrícula autorizada | 2 |
| Sale: Webpay arancel / TuFirma enviada | 2 + 1/3 |
| Pagaré borrador no saca | 2 (no filtrar por medioArancel pagare) |
| Contacto OTP → borrador validado | 2 |
| Columnas pedidas | 5 |
| Export CSV/Excel | 4–5 |
| Paginación 10 | 5 |
| Sin tel:/mailto / montos | 5 (no añadir) |

## Placeholder scan

Sin TBD. Grants RPC: “copiar de reporte pagos si existen”. Columna `updated_at` en menú: omitir si no existe.
