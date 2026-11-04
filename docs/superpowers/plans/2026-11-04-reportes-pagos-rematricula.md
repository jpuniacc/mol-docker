# Reportes pagos rematrícula — Implementation Plan

> **For agentic workers:** Execute task-by-task. Spec: `docs/superpowers/specs/2026-11-04-reportes-pagos-rematricula-design.md`.

**Goal:** Menú Reportes en MOL con tablero fijo: matriculados × Webpay matrícula/arancel.

**Architecture:** RPC Supabase en vivo (embudo MOL + canal BO + `mnp_webpay_transaccion`); vista Vue con tarjetas, filtros y CSV.

**Tech Stack:** Vue 3, Supabase RPC, bo_menu_item.

## Tasks

- [ ] Task 1: Migración RPC `kpi_reporte_pagos_rematricula` + `listar_reporte_pagos_rematricula` + menú Reportes
- [ ] Task 2: API front + helpers/tests CSV/última tx
- [ ] Task 3: Vista + ruta + `DASHBOARD_MENU_ROUTE_NAMES`
- [ ] Task 4: Aplicar en mol-dev/prod, rebuild, commit merge push
