# Gestión firmas fecha + medios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar en Gestión de firmas la fecha de generación y medios cortos de matrícula/arancel, con paginación de 10.

**Architecture:** API `listContratoFirma` enriquece cada fila con medios desde borrador (+ fallback Webpay / cubierto). Front pinta 3 columnas y pagina con `useTablaPaginada(..., 10)`.

**Tech Stack:** uniacc-api (TypeScript/Express), mol Vue 3 + Pinia, Postgres/Supabase.

## Global Constraints

- Etiquetas: Webpay / Pagaré / Cubierto / —
- Page size: 10
- Sin montos ni folios
- No denormalizar en `rematricula_contrato_tufirma`

---

### Task 1: Mapeo de medios (API puro)

**Files:**
- Create: `uniacc-api-docker/src/services/contrato-firma-medios.ts`
- Create: `uniacc-api-docker/src/services/contrato-firma-medios.test.ts`

- [x] Test: pagaré / webpay / null / cubierto arancel / fallback webpay sin medio
- [x] Implementar `resolverMediosFirma` + parse periodo
- [x] Tests verdes

### Task 2: Enriquecer listContratoFirma

**Files:**
- Modify: `uniacc-api-docker/src/services/tufirma-contrato.service.ts`
- Modify: tests de listado si existen

- [x] Extender tipo list item con `medio_matricula` / `medio_arancel`
- [x] Batch load borradores + webpay; mapear en `listContratoFirma`
- [x] Tests / smoke del listado

### Task 3: UI Gestión firmas

**Files:**
- Modify: `mol-docker/src/services/contratoFirmaApi.ts`
- Modify: `mol-docker/src/views/dashboard/rematricula/GestionFirmasView.vue`

- [x] Tipos + columnas Generado / Matrícula / Arancel
- [x] `useTablaPaginada(filasVisibles, 10)` + controles; reset al filtrar
- [x] Verificar vista

---
