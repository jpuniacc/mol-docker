# Casos rematrícula v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pedir certificado de convenio (plan ∩ catálogo 2027-01), dejar al alumno en standby hasta que el consejero apruebe, y mostrar una bandeja genérica de casos (convenio + apoderado + CAE).

**Architecture:** Tabla `mnp_caso_rematricula` + RPCs SECURITY DEFINER. El mock abre/rehidrata casos; el gate de certificado usa `mnp_mv_beneficio_periodo.requiere_certificado`. La bandeja dashboard lista todos los tipos y solo resuelve `CONVENIO_CERTIFICADO`.

**Tech Stack:** Postgres/Supabase, Vue 3 + Pinia + TypeScript, Vitest, shadcn-vue.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-10-casos-rematricula-design.md`
- Periodo catálogo: `YYYY-0S` (ej. `2027-01`)
- Gate: código en `beneficios_detalle` ∩ `requiere_certificado = true`
- Tras subir: `EN_REVISION` + bloqueo; no pago/firma/resumen
- Rechazo: motivo obligatorio; misma fila de caso vuelve a `EN_REVISION` al re-subir
- Tipos: `CONVENIO_CERTIFICADO` (ciclo completo), `APODERADO_DATOS` y `CAE_RESOLUCION` (solo abrir/listar)
- Composition API; tipos explícitos; sin `any`
- No commit salvo que el usuario lo pida

## File map

| Archivo | Rol |
|---------|-----|
| `src/utils/periodoCatalogo.ts` | `2027-1` / (2027,1) → `2027-01` |
| `src/utils/convenioCertificado.ts` | Cruce plan ∩ catálogo certificado |
| `src/services/fetchBeneficioPeriodo.ts` | SELECT `mnp_mv_beneficio_periodo` |
| `src/services/casoRematriculaApi.ts` | RPCs abrir / listar / consultar / resolver |
| `src/stores/mockMatriculaContext.ts` | `convenioCertificadoBloqueo` + rehidratación |
| `src/components/rematricula/ConvenioVigenteUpload.vue` | Pedir solo certificado; estado en revisión |
| `src/views/matricula-mock/FormaPagoMockView.vue` | Standby + gate |
| `src/router/index.ts` | Guard firma/resumen |
| `src/views/matricula-mock/MatriculaMockApoderadoStep.vue` | Abrir caso `APODERADO_DATOS` |
| `src/views/matricula-mock/FormaPagoMockView.vue` (CAE) | Abrir caso `CAE_RESOLUCION` |
| `src/views/dashboard/rematricula/CasosRematriculaView.vue` | Bandeja |
| `supabase/migrations/20260910140000_mnp_caso_rematricula.sql` | Tabla + RPCs + menú |
| `src/types/supabase.ts` | Tipos |

---

### Task 1: Periodo catálogo + cruce certificado

**Files:**
- Create: `src/utils/periodoCatalogo.ts`, `src/utils/periodoCatalogo.test.ts`
- Create: `src/utils/convenioCertificado.ts`, `src/utils/convenioCertificado.test.ts`

**Interfaces:**
- `periodoCatalogoLabel(anio, semestre): string` → `2027-01`
- `detectarCertificadosRequeridos(plan, catalogo): CertificadoRequerido[]`

- [x] Tests RED/GREEN de periodo y cruce (códigos 89/749/1552/1565)

### Task 2: Persistencia casos

**Files:**
- Create: `supabase/migrations/20260910140000_mnp_caso_rematricula.sql`
- Modify: `src/types/supabase.ts`

- [x] Tabla `mnp_caso_rematricula` + unique parcial de caso abierto
- [x] RPCs: `abrir_mnp_caso_rematricula`, `resolver_mnp_caso_rematricula`, `listar_mnp_casos_rematricula`, `consultar_casos_alumno`
- [x] Menú `dashboard-casos-rematricula` (id `...000040`, orden 31)
- [x] Aplicar en Supabase local y verificar RPCs

### Task 3: API front + bloqueo mock

**Files:**
- Create: `src/services/fetchBeneficioPeriodo.ts`, `src/services/casoRematriculaApi.ts`
- Modify: `src/stores/mockMatriculaContext.ts`, `src/router/index.ts`

- [x] `convenioCertificadoBloqueo` persistido; guard como `apoderadoBloqueo` para forma-pago/firma/resumen

### Task 4: Flujo alumno certificado

**Files:**
- Modify: `ConvenioVigenteUpload.vue`, `FormaPagoMockView.vue`

- [x] Pedir PDF solo si `requiere_certificado`
- [x] Subir → abrir caso EN_REVISION → pantalla standby
- [x] Rehidratación al entrar al mock

### Task 5: Abrir casos apoderado y CAE

**Files:**
- Modify: `MatriculaMockApoderadoStep.vue`, punto CAE en `FormaPagoMockView.vue`

- [x] Al bloquear apoderado / CAE pendiente, `abrir_mnp_caso_rematricula` (idempotente)

### Task 6: Bandeja consejero

**Files:**
- Create: `CasosRematriculaView.vue`
- Modify: `src/router/index.ts`, `dashboardRouteNames.ts`

- [x] Lista + filtros; detalle convenio: ver PDF, aprobar/rechazar con motivo
- [x] Otros tipos: solo lectura

### Task 7: Verificación

- [x] Tests unitarios
- [x] SQL: tabla + 4 RPCs
- [x] Ruta dashboard registrada
