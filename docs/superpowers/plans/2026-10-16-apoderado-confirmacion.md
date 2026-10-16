# Confirmación de datos de apoderado — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El botón Datos actualizados muestra la comparación y solo al confirmar actualiza MOL, avisa al alumno y cierra el caso.

**Architecture:** `preview-from-erp` lee el ERP y el correo validado sin escribir. `refresh-from-erp` exige ese correo, actualiza el consolidado, reutiliza o encola `APODERADO_ACTUALIZADO` y solo entonces la vista cierra el caso. El aviso siempre va al correo validado, con copia a MOL y al ejecutivo de la cartera.

**Tech Stack:** Vue 3, TypeScript, Fastify no: Express + node:test en `uniacc-api-docker`, Vitest en `mol-docker`.

## Global Constraints

- Datos antiguos: `payload.apoderadoNombre`, `payload.apoderadoTelefono`, `payload.apoderadoEmail`.
- Datos nuevos: nombre completo del ERP, teléfono `telefono_apoder` o si no `telefono_apoderado`, correo `mail_apoder`.
- Vacío se muestra como `—`. Coincidencia no bloquea Confirmar.
- Sin correo validado: `SIN_CORREO_VALIDADO`, sin escritura. Confirmar deshabilitado.
- Aviso no encolado: `AVISO_ERROR`, caso sigue en `EN_REVISION`.
- Reintento no inserta otro aviso `pendiente` o `enviado` del mismo `caso_id`.
- Cierre solo con `ok` y `avisoId`. Motivo: `Datos de apoderado actualizados desde ERP`.
- Correo: Para el validado. Copia `mol@uniacc.cl` y `email_ejecutivo`. Enlace `/matricula-alumno`.
- Solo `APODERADO_DATOS` en `EN_REVISION`.

---

### Task 1: Consulta y confirmación en la API

**Files:**
- Modify: `uniacc-api-docker/src/services/apoderado-refresh-from-erp.service.ts`
- Modify: `uniacc-api-docker/src/controllers/rematricula-apoderado.controller.ts`
- Modify: `uniacc-api-docker/src/routes/rematricula-apoderado.routes.ts`
- Test: `uniacc-api-docker/src/services/apoderado-refresh-from-erp.service.test.ts`

- [x] Cubrir con puerto falso: preview no escribe; sin correo no hay UPDATE; confirmar devuelve `avisoId`; segundo confirmar reutiliza; fallo al encolar devuelve `AVISO_ERROR`.

### Task 2: Destinatario y enlace del correo

**Files:**
- Modify: `uniacc-api-docker/src/services/rematricula-aviso-outbox.service.ts`
- Modify: `uniacc-api-docker/src/services/rematricula-aviso-templates.ts`
- Test: `uniacc-api-docker/src/services/rematricula-aviso-templates.test.ts`
- Test: `uniacc-api-docker/src/services/rematricula-aviso-outbox.service.test.ts`

- [x] `APODERADO_ACTUALIZADO` siempre incluye al alumno. Sin `emailAlumno` el aviso queda omitido. El CTA apunta a `/matricula-alumno`.

### Task 3: Cuadro en Casos rematrícula

**Files:**
- Modify: `mol-docker/src/services/apoderadoRefreshFromErpApi.ts`
- Modify: `mol-docker/src/views/dashboard/rematricula/CasosRematriculaView.vue`
- Create: `mol-docker/src/utils/comparacionApoderado.ts`
- Test: `mol-docker/src/utils/comparacionApoderado.test.ts`

- [x] Los dos botones abren el cuadro. Cancelar no llama a refresh ni a resolver. Confirmar cierra el caso solo si hay `avisoId`.
