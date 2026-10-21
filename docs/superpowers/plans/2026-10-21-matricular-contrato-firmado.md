# Matricular contrato firmado — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La API matricula cuando el contrato está completo, avisa una vez si no puede, y el KPI pasa a Matriculado.

**Architecture:** `matricularContratoFirmado` arma el plan desde el borrador y llama a `grabarPlanPagosErp`. La consulta de firma y un barrido cada 2 minutos la disparan. La página solo muestra el resultado.

**Tech Stack:** Express + TypeScript en `uniacc-api-docker` (`node:test`), Vue 3 en `mol-docker` (Vitest). Postgres Supabase para borrador, log y KPI. TuFirma y U+ TEST vía los servicios que ya existen.

## Global Constraints

- La API graba. El navegador no arma el POST de grabación al ver la firma lista.
- Se reusa `grabarPlanPagosErp`. No se modifican procedimientos de SQL Server.
- La grabación sigue solo en TEST.
- Correo a `hans.vidal@uniacc.cl` y `juan.silva@uniacc.cl`, copia `mol@uniacc.cl`, una vez por alumno y periodo.
- La marca es `log_mol_evento` categoría `matricula` acción `aviso_no_grabado`, después de un envío exitoso.
- El KPI pasa a Matriculado con `matricula` / `matriculado` y `refresh_mnp_progreso_rematricula`.
- El rechazo de Tamara por beneficio duplicado queda fuera. El barrido igual lo intenta y avisa una vez.
- La página de Pixarrón no se toca.

## Files

- Create: `/opt/uniacc-api-docker/src/services/matricular-contrato-firmado.ts`
- Create: `/opt/uniacc-api-docker/src/services/matricular-contrato-firmado.test.ts`
- Create: `/opt/uniacc-api-docker/src/services/matricular-contrato-firmado-runtime.ts`
- Modify: `/opt/uniacc-api-docker/src/controllers/rematricula-alumno-contrato-firma.controller.ts`
- Modify: `/opt/uniacc-api-docker/src/index.ts`
- Create: `/opt/mol-docker/src/utils/matriculaTrasFirma.ts`
- Create: `/opt/mol-docker/src/utils/matriculaTrasFirma.test.ts`
- Modify: `/opt/mol-docker/src/services/contratoFirmaApi.ts`
- Modify: `/opt/mol-docker/src/views/matricula-alumno/FirmaAlumnoView.vue`

### Task 1: Decisión y correo

Pruebas de armado del plan, de no llamar a U+ sin firma, de un solo correo y de una sola grabación concurrente. Luego el servicio con dependencias inyectadas.

### Task 2: Barrido y consulta de firma

Al partir y cada 2 minutos. La consulta responde 200 con `matriculaActualizada` o `errorMatricula`.

### Task 3: Página

Si la API confirma la matrícula, avanza. Si trae motivo, lo muestra. No llama a grabar al quedar la firma lista.

### Task 4: Verificación

`npm test` en la API y `npx vitest run src/utils/matriculaTrasFirma.test.ts` en el front.
