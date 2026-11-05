# Grabado U+ — Implementation Plan

> **For agentic workers:** Execute task-by-task.

**Goal:** Reportes → Técnico → Grabado U+: lista matriculados MOL con semáforo U+ y detalle de 6 tablas.

**Architecture:** uniacc-api lee MOL (Supabase PG) + U+ (mssql); front Vue consume `/api/rematricula/reportes/grabado-up`.

**Tech Stack:** Express, mssql, pg, Vue 3, shadcn-vue.

## Global Constraints

- Solo lectura U+.
- Semáforo v1 solo U+ (CONTROL + cuentas).
- Menú: Reportes → Técnico → Grabado U+.
- Op. cuenta ≠ TuFirma.
- Deploy prod solo con pedido explícito.

---

### Task 1: API uniacc-api — DONE

- `grabado-up-semaforo.ts` + test
- `grabado-up-reporte.service.ts` list + detalle (6 tablas)
- routes `/api/rematricula/reportes/grabado-up` (+ `/detalle`)

### Task 2: Front mol-docker — DONE (mol-dev)

- `ReportesGrabadoUpView.vue` + API client
- Menú Reportes → Técnico → Grabado U+
- Smoke: list 2027-1 + detalle op 989866 OK
