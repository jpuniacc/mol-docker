# Reportes Becas + Tiempos — Implementation Plan

> **For agentic workers:** Execute task-by-task. Steps use checkbox syntax.

**Goal:** Dos reportes nuevos bajo menú Reportes (Becas asignadas, Tiempos por tramo) para matriculados MOL.

**Architecture:** RPCs Supabase hermanas al de pagos; vistas Vue 3 + helpers TS; Art. 13 reutiliza `resolucionBecaPromedio`.

**Tech Stack:** Vue 3, Pinia periodo, Supabase RPC, Postgres, vitest, shadcn-vue/Tailwind.

## Global Constraints

- Universo = matriculado MOL − canal BO (misma regla que pagos).
- Talento `1744` ≥100 % omite tope 70 %; Art. 13 sí aplica.
- Tiempos solo agregados (media/mediana/n); sin fila por alumno.
- No modificar firma de `listar_reporte_pagos_rematricula` salvo necesidad de menú.
- Copy UI en español; deploy prod solo con pedido explícito.

---

### Task 1: Spec (done in repo)

- [x] `docs/superpowers/specs/2026-11-05-reportes-becas-tiempos-design.md`

### Task 2: RPC Becas + menú + rutas

- [x] Migración SQL `listar_reporte_becas_rematricula` + `kpi_reporte_becas_rematricula`
- [x] `bo_menu_item` Becas + Tiempos (Tiempos puede activarse en task 4)
- [x] Router + `DASHBOARD_MENU_ROUTE_NAMES`

### Task 3: UI Becas

- [x] Helpers + tests Art. 13 peor resultado / parse filas
- [x] `reportesBecasRematriculaApi.ts`
- [x] `ReportesBecasAsignadasView.vue` + export

### Task 4: RPC + UI Tiempos

- [x] `kpi_reporte_tiempos_tramo_rematricula`
- [x] API + `ReportesTiemposTramoView.vue`
- [x] Apply SQL en supabase-dev + smoke mol-dev
