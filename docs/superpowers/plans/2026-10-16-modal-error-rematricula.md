# Modal de error de rematrícula e ingreso

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar los toast de error de rematrícula y del ingreso por un modal con franja, saludo y una escena según el fallo.

**Architecture:** `clasificarErrorRematricula` elige escena, título y cuerpo. Un store abre el modal. El componente vive en el layout del dashboard y en el login. Las vistas llaman `mostrarErrorRematricula` en lugar de `toast.error`.

**Tech Stack:** Vue 3, TypeScript, Pinia, Vitest.

## Global Constraints

- Franja `#fff7f2`, saludo `#D91B7A`, título `#1E3A5F`, botón `#D91B7A`, enlaces `#3B9EC9`.
- No mostrar códigos como `ya-autorizada` ni `HTTP 400`.
- Éxitos siguen en toast.
- Alumno: saludo con su nombre. Backoffice: saludo con el del consejero.
- Inicio de sesión: saludo solo si ya hay nombre.
- Usuario o contraseña vacíos no abren modal.
- Ilustración quieta si `prefers-reduced-motion`.
- `alertdialog` y foco en el botón principal.

---

### Task 1: Catálogo

**Files:**
- Create: `src/utils/errorRematriculaCatalogo.ts`
- Test: `src/utils/errorRematriculaCatalogo.test.ts`

- [ ] Cubrir los seis casos del spec y clasificar el resto sin filtrar el código técnico al título.

### Task 2: Modal y store

**Files:**
- Create: `src/stores/errorRematricula.ts`
- Create: `src/components/rematricula/ModalErrorRematricula.vue`
- Modify: `src/views/dashboard/layout/DashboardView.vue`
- Modify: `src/views/auth/LoginView.vue`

- [ ] Montar el modal en el dashboard y en el login. Los bloqueos existentes conservan título, cuerpo y `servicio.estudiante@uniacc.cl`.

### Task 3: Avisos de rematrícula

**Files:**
- Modify: vistas en `src/views/matricula-alumno/` y `src/views/dashboard/rematricula/` que usan `toast.error`.

- [ ] Cambiar esos avisos a `mostrarErrorRematricula`. La descarga de Gestión de firmas pasa el número de operación.
