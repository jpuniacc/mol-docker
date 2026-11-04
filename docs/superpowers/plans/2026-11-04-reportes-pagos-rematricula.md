# Reportes pagos rematrícula — plan (cierre gaps wireframe)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alinear el tablero ya existente (`ReportesPagosRematriculaView` + RPC v2) al wireframe/spec aprobado, sin reescribir el greenfield.

**Architecture:** Front Vue 3 + TanStack Table + ECharts; datos vía RPC Supabase `listar_` / `kpi_reporte_pagos_rematricula` (universo MOL, medios Webpay/Pagaré/Pendiente desde borrador + Webpay). Este plan solo cierra gaps UX/a11y/copy y verificación en mol-dev.

**Tech Stack:** Vue 3, TypeScript, shadcn-vue, Tailwind, TanStack Table, ECharts, Vitest, Supabase RPC.

## Global Constraints

- Universo: solo Matriculados MOL del periodo activo (excluye BO).
- Medios: Webpay `#059669` · Pagaré `#4D98C5` · Pendiente `#f59e0b`.
- Tokens UNIACC del shell; no glassmorphism oscuro.
- Chips de filtro = `<button>` con `aria-pressed`.
- No materializar cubos; no TuFirma en este tablero.
- Spec: `docs/superpowers/specs/2026-11-04-reportes-pagos-rematricula-design.md`.

## Estado previo (no rehacer)

| Pieza | Ubicación |
|-------|-----------|
| Vista | `src/views/dashboard/reportes/ReportesPagosRematriculaView.vue` |
| Helpers + tests | `src/utils/reportePagosRematricula.ts` · `.test.ts` |
| API | `src/services/reportesPagosRematriculaApi.ts` |
| RPC v2 | `supabase/migrations/20261104200000_reporte_pagos_rematricula_v2_mol_medios.sql` |
| Menú | insert en `20261104180000_reporte_pagos_rematricula.sql` |
| Ruta | `dashboard-reportes-pagos-rematricula` |

---

### Task 1: Empty state y headers de tabla al wireframe

**Files:**
- Modify: `src/views/dashboard/reportes/ReportesPagosRematriculaView.vue`
- Modify: `src/utils/reportePagosRematricula.ts` (helper texto empty si cabe)
- Test: `src/utils/reportePagosRematricula.test.ts`

- [x] **Step 1–4:** Helper `mensajeEmptyReportePagos`, headers wireframe, tests 9/9 OK.
- [ ] **Step 5: Commit** (solo si el usuario lo pide).

### Task 2: a11y chips + reduced motion

**Files:**
- Modify: `src/views/dashboard/reportes/ReportesPagosRematriculaView.vue`

- [x] **Step 1–3:** `aria-pressed` / focus ring en chips y toggles; `motion-safe:animate-spin`.
- [x] **Step 4:** Rebuild mol-dev (desarrollo) con bundle nuevo `ReportesPagosRematriculaView.B1R5gmZU.js`.

### Task 3: Verificar menú + datos en mol-dev

- [x] **Step 1–2:** Menú `Reportes` + `Pagos rematrícula` activo en `bo_menu_item`.
- [x] **Step 3–4:** RPC v2 presentes; front rebuild en mol-dev. Smoke manual en UI pendiente del usuario.

### Task 4: (Opcional) Deploy uniacc-mol

Solo tras OK en mol-dev y pedido explícito del usuario.

- [ ] rsync solo archivos del reporte + rebuild `mol-dev` con `VITE_SUPABASE_URL=https://mol.uniacc.cl`.
- [ ] Confirmar migración v2 aplicada en supabase prod.

---

## Fuera de este plan

- Canal BO, TuFirma, Power BI, paneles reordenables.
- Casos «pagó y no matriculó» (Valentina/Agustina cartola).
- Feature «Atrás» en firma de contrato (Agustina Carquen).
