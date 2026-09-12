# Layout firmas Bettersoft — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estampar TuFirma sobre las líneas del cierre Bettersoft (alumno + sostenedor), anexo en hoja nueva, representante legal vacío.

**Architecture:** Mismo BFF. `buildTuFirmaFirmantes` siempre emite 2 `fields`. El PDF deja de tener página «Firmas electrónicas»; `signaturePage = countPdfPages(pdf) - 1`.

**Tech Stack:** Express + pdfmake + `node:test` en uniacc-api. Vue 3 Composition API en MOL.

## Global Constraints

- Spec: `mol-docker/docs/superpowers/specs/2026-09-12-contrato-firmas-layout-design.md`
- RL vacío (ni Aliste ni Salazar)
- UNIACC no firma en TuFirma
- Misma persona sostenedora: 1 firmante, 2 fields, mismo filler
- No rehacer documentos TuFirma ya creados
- Composition API; tipos explícitos; sin `any`
- Commits en el repo dueño

## File map

| Archivo | Rol |
|---------|-----|
| `uniacc-api-docker/src/services/tufirma-firmantes.ts` | 2 fields; cajas izq/der |
| `uniacc-api-docker/src/services/tufirma-firmantes.test.ts` | Tests |
| `uniacc-api-docker/src/services/tufirma-contrato.service.ts` | `signaturePage = n - 1` |
| `uniacc-api-docker/src/services/contrato-preview-pdf.service.ts` | Layout Bettersoft |
| `uniacc-api-docker/src/assets/contrato/clausulas.json` | Preámbulo sin RL |
| `uniacc-api-docker/src/controllers/rematricula-alumno-contrato-preview.controller.ts` | RL opcional |
| `uniacc-api-docker/src/controllers/rematricula-alumno-contrato-firma.controller.ts` | RL opcional |
| `mol-docker/src/assets/contrato/clausulas.json` | Mismo preámbulo |
| `mol-docker/src/composables/useContratoMatriculaViewModel.ts` | representante vacío |
| `mol-docker/src/components/rematricula/ContratoPrestacionServiciosPreview.vue` | Centro sin nombre |

---

### Task 1: Dos recuadros TuFirma

**Files:**
- Modify: `/opt/uniacc-api-docker/src/services/tufirma-firmantes.ts`
- Modify: `/opt/uniacc-api-docker/src/services/tufirma-firmantes.test.ts`
- Modify: `/opt/uniacc-api-docker/src/services/tufirma-contrato.service.ts`

**Interfaces:**
- Produces: `FIRMA_ALUMNO_BOX = { x: 0.06, y: 0.62, width: 0.28, height: 0.09 }`, `FIRMA_SOSTENEDOR_BOX = { x: 0.66, y: 0.62, width: 0.28, height: 0.09 }`, `ANEXO_PAGES = 1`
- `buildTuFirmaFirmantes`: siempre `fields.length === 2`

- [x] Tests: sin apoderado → 1 firmante, 2 fields mismo filler; con apoderado → 2 firmantes, field[1] filler apoderado x=0.66
- [x] Implementar; `ensure` usa `page - ANEXO_PAGES` como `signaturePage`
- [x] Commit uniacc-api

### Task 2: PDF Bettersoft + RL vacío

**Files:** PDF service, clausulas.json (api + mol assets), controllers, view-model, preview Vue

- [x] Preámbulo sin «por {nombre}, cédula {rut}»
- [x] Quitar página «Firmas electrónicas»
- [x] Tres columnas; centro solo `pp. {institucion.nombre}`
- [x] Anexo `pageBreak: 'before'`
- [x] Validadores RL optional; MOL `representante: { nombre: '', rut: '' }`
- [x] Commit por repo

### Task 3: Rebuild uniacc-api

- [x] `docker compose up -d --build` en uniacc-api
- [x] Verificar preview-pdf no contiene «Firmas electrónicas» ni Aliste
