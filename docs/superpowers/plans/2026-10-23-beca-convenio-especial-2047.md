# Beca Convenio Especial 2047 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el 2026 por el 2047 en la cartera de mol-dev y hacer que MOL aplique el 20 % sin baja por notas, aunque U+ aún no lo tenga asignado.

**Architecture:** La excepción vive en `filtrarBeneficiosAsignados`: solo el código 2047 pasa sin asignación previa. El catálogo `2027-01` lo marca `MOL_DVU` / `SIN REQUISITO DE NOTAS` / aplicable. El grabado a `MT_POSBEN` no cambia.

**Tech Stack:** Vue 3, TypeScript, Vitest, Postgres (Supabase mol-dev).

## Global Constraints

- Solo estos 52 alumnos y solo mol-dev.
- La beca 2, el consolidado y el resto de las columnas no cambian.
- Solo se actualiza la fila si `cod_beneficio_1` sigue siendo `2026`.
- No se escribe U+ antes de firmar y no se modifica `sp_mol_grabar_plan_pagos`.
- No se copia a uniacc-mol ni a la cartera de producción.
- El 2026 permanece en revisión.

---

### Task 1: Mostrar el 2047 sin asignación previa

**Files:**
- Modify: `src/utils/carteraBeneficiosUi.ts`
- Test: `src/utils/carteraBeneficiosUi.test.ts`
- Test: `src/utils/beneficioPromedioVista.test.ts`

- [ ] Test rojo: el 2047 se ve con el conjunto de asignados vacío y el 1756 no.
- [ ] Implementar la excepción solo para `2047`.
- [ ] Test: con `SIN REQUISITO DE NOTAS` y promedio 3,5 el porcentaje queda en 20 y el monto es el 20 % del arancel.
- [ ] `npx vitest run --config vitest.unit.config.ts src/utils/carteraBeneficiosUi.test.ts src/utils/beneficioPromedioVista.test.ts` en verde.

### Task 2: Datos en mol-dev

**Files:**
- Datos: `public.mnp_cartera_beneficios` y `public.mnp_mv_beneficio_periodo` en Supabase mol-dev.

- [ ] Insertar el 2047 en el catálogo `2027-01` si no existe.
- [ ] Actualizar la beca 1 de los 52 códigos solo donde siga el 2026.
- [ ] Verificar 52 filas con código 2047 y una fila de catálogo.
