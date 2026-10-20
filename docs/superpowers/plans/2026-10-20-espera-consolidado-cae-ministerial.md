# Espera consolidado CAE y ministerial — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Frenar el pago cuando el consolidado de la cartera trae CAE o beca ministerial, y dejar seguir solo con la resolución correspondiente.

**Architecture:** Una función pura lee el consolidado. La forma de pago del alumno y la de prueba la usan en el mismo orden: CAE primero, ministerial después. BECA 1 y BECA 2 siguen siendo el descuento interno.

**Tech Stack:** Vue 3, TypeScript, Vitest.

## Global Constraints

- BECA 1 y BECA 2 no deciden la espera.
- `CAE` espera resolución CAE. `BECA MINISTERIAL` espera resolución ministerial. `CAE/BECA MINISTERIAL` hace las dos, en ese orden.
- `SUBDERE` no entra. Consolidado vacío sigue al pago, salvo `alumno_cae` en `Si` o `Sí`.
- Error al cargar la cartera no abre el pago.
- El caso ministerial es `ESTATAL_MINEDUC`, periodo `YYYY-0S`, y no se duplica.
- No se recarga el Excel ni se escribe la resolución desde MOL.

---

### Task 1: Decisión pura

**Files:**
- Create: `src/utils/esperaConsolidado.ts`
- Test: `src/utils/esperaConsolidado.test.ts`

- [x] Cubrir la tabla del spec y `alumno_cae` en `Si`/`Sí`.
- [x] Implementar `esperaDesdeConsolidado` y `requiereVerificacionCae`.

### Task 2: Forma de pago del alumno

**Files:**
- Modify: `src/views/matricula-alumno/FormaPagoAlumnoView.vue`
- Modify: `src/constants/verificacionEstatal.ts`

- [x] La puerta usa el consolidado y, para CAE, también el plan.
- [x] Reserva `CAE` o `ESTATAL` al entrar en espera.
- [x] Abre `ESTATAL_MINEDUC` con `periodoCatalogoLabel`.
- [x] La pantalla ministerial muestra el texto del consolidado.
- [x] Si la cartera falla, el pago no se abre y hay reintento.

### Task 3: Forma de pago de prueba

**Files:**
- Modify: `src/views/matricula-mock/FormaPagoMockView.vue`

- [x] Misma decisión, misma reserva, mismo caso y el mismo bloqueo si la cartera falla.
