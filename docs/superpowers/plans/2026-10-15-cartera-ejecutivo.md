# Cartera por ejecutivo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un ejecutivo ve solo los alumnos de su cartera en las pantallas de seguimiento; Superadmin y Administrador siguen viendo la cartera completa.

**Architecture:** Un store Pinia calcula el alcance (`completo`, `ejecutivo` o `sin_correo`). Las lecturas de Supabase y de uniacc-api reciben ese correo y filtran antes de responder. El correo de Francisca en la cartera se corrige a `francisca.silvab@uniacc.cl`.

**Tech Stack:** Vue 3, Pinia, Supabase RPC, Fastify/Express en uniacc-api, Postgres.

## Global Constraints

- Perfil 3 con correo: solo filas con `email_ejecutivo` igual, en minúsculas y sin espacios.
- Perfil 1 y 2: sin filtro.
- Perfil 3 sin correo: no se consulta y la lista queda vacía con el aviso "Tu usuario no tiene correo para asociar la cartera."
- Un alumno sin ejecutivo no aparece para el perfil 3.
- Si falla la lectura de la cartera, no se devuelve la lista completa.
- Pantallas: KPI, seguimiento, casos, gestión de firmas, matriculados, estado de firma, encuesta y desbloqueo.
- Mantenedores de catálogo quedan fuera.
- El refresco del progreso y las sincronizaciones siguen siendo del universo completo.

---

### Task 1: Alcance puro y store

**Files:**
- Create: `src/utils/alcanceCarteraEjecutivo.ts`
- Create: `src/utils/alcanceCarteraEjecutivo.test.ts`
- Create: `src/stores/carteraEjecutivo.ts`

**Interfaces:**
- Produces: `alcanceCartera(perfil: number | null, email: string | null): AlcanceCartera`
- Produces: `useCarteraEjecutivoStore()` con `bloqueado` y `emailConsulta`

- [x] Implementar la función y las pruebas de perfil 1, perfil 3 con correo y perfil 3 sin correo.
- [x] El store lee auth y expone esos dos valores.

### Task 2: Funciones de Supabase

**Files:**
- Create: `supabase/migrations/20261015170000_cartera_ejecutivo_filtro.sql`
- Modify: `src/types/supabase.ts`
- Modify: `src/services/progresoRematriculaApi.ts`
- Modify: `src/services/casoRematriculaApi.ts`

**Interfaces:**
- Consumes: `emailConsulta`
- Produces: `p_email_ejecutivo text default null` en KPI, listar progreso y listar casos

- [x] Cruzar por `rut_norm`. En casos, normalizar `rut_alumno`.
- [x] Pasar el correo solo cuando el alcance es ejecutivo.

### Task 3: Filtro en uniacc-api

**Files:**
- Create: `src/services/cartera-ejecutivo.ts`
- Create: `src/services/cartera-ejecutivo.test.ts`
- Modify: controllers de matriculados, firma acepta, contrato firma, encuesta y desbloqueo

**Interfaces:**
- Produces: `emailEjecutivoDeQuery(raw)`, `rutNorm(valor)`, `rutsDeEjecutivo(email)`
- Query: `emailEjecutivo`

- [x] Sin el parámetro, la respuesta sigue completa.
- [x] Con el parámetro, RUT fuera de la cartera responde como inexistente.
- [x] `vigente` de desbloqueo no se filtra: lo usa el alumno.

### Task 4: Pantallas

**Files:**
- Modify: vistas KPI, seguimiento, casos, gestión de firmas, matriculados, estado de firma, encuesta y desbloqueo
- Modify: `useMatriculados.ts`, `useFirmaAcepta.ts` y los clientes API

- [x] Mostrar el aviso y no llamar cuando `bloqueado` es verdadero.
- [x] Agregar `emailEjecutivo` a las lecturas y a las acciones de desbloqueo.

### Task 5: Corrección de Francisca

- [x] `UPDATE` de `francisca.silva@uniacc.cl` a `francisca.silvab@uniacc.cl` en `mnp_cartera_oficial`.
- [x] La misma corrección en la columna `EJECUTIVO MATRICULA` del Excel de carga.
