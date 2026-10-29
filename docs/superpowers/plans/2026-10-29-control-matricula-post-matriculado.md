# Control matrícula post-matriculado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tras cerrar ficha en `grabarPlanPagosErp`, asegurar fila `MT_CONTROL_MATRICULA` con `ESTADO='OK'` y la `NUM_OPERACION` de la cuenta, con soft-fail + correo si falla.

**Architecture:** Helper `insertarControlMatriculaErp` (insert SP + UPDATE si la fila ya existe/desfasada) llamado desde `asegurarControlMatriculaTrasFicha` (nunca lanza; log + aviso único). Enganche en ambos caminos de ficha OK (grabado nuevo y `already`).

**Tech Stack:** TypeScript, mssql, Node test runner (`tsx --test`), EmailService + `log_mol_evento`.

## Global Constraints

- Solo `dbo.sp_insert_control_matricula` + UPDATE liviano MOL; no `sp_update_control_matricula`.
- Estado inicial `'OK'`; usuario `USUARIO_CAJA_MOL[ambiente]` como INT.
- Soft-fail: cuenta/ficha intactas; respuesta grabar sigue `ok: true`.
- Aviso: `aviso_control_matricula` una vez por codcli+año+semestre; mismos destinos que `aviso_no_grabado`.
- Rollout: primero rebuild `uniacc-api` (mol-dev / apigateway-dev); prod uniacc-mol después de prueba OK.
- No commit automático salvo que el usuario lo pida.

## File map

| Archivo | Rol |
|---------|-----|
| `uniacc-api-docker/src/services/grabar-plan-pagos-erp.service.ts` | Helper ERP + soft-fail + enganche |
| `uniacc-api-docker/src/services/grabar-plan-pagos-erp.service.test.ts` | Tests del control |
| `uniacc-api-docker/src/services/matricular-contrato-firmado.ts` | Reusar `DESTINO_AVISO_NO_GRABADO` / `COPIA_AVISO_NO_GRABADO` |

---

### Task 1: Helper ERP + soft-fail

**Files:**
- Modify: `uniacc-api-docker/src/services/grabar-plan-pagos-erp.service.ts`
- Test: `uniacc-api-docker/src/services/grabar-plan-pagos-erp.service.test.ts`

**Interfaces:**
- Produces: `insertarControlMatriculaErp(pool, params)` throws on SQL error
- Produces: `asegurarControlMatriculaTrasFicha(...)` never throws
- Consumes: `USUARIO_CAJA_MOL`, `EmailService`, destinos aviso, `querySupabase`

- [ ] **Step 1: Implement `insertarControlMatriculaErp`**

Params: `{ codcli, codcarr, ano, periodo, numOperacion, ambiente }`.

1. `SELECT ESTADO, NUM_OPERACION FROM MT_CONTROL_MATRICULA WHERE ...`
2. Si no hay fila → `EXEC dbo.sp_insert_control_matricula` con `@estado='OK'`, `@usuario=Number(USUARIO_CAJA_MOL[ambiente])`, `@num_operacion=Numeric`
3. Si hay fila y (`ESTADO !== 'OK'` o `NUM_OPERACION` distinta) → `UPDATE` a OK + op + usuario + FECHA
4. Si ya correcta → no-op

- [ ] **Step 2: Implement soft-fail wrapper**

`asegurarControlMatriculaTrasFicha`: try insertar; on success optionally `registrarIntento` tema `cuenta` accion `control_matricula` ok; on catch log error intento + `avisarControlMatriculaFallido` (idempotente vía `log_mol_evento` accion `aviso_control_matricula`).

Correo: to `DESTINO_AVISO_NO_GRABADO`, cc `COPIA_AVISO_NO_GRABADO`, subject `MOL: falló el control de matrícula de …`, body con RUT/código/periodo/numOperacion/motivo.

Extender `GrabarPlanPagosDeps` con hooks opcionales para tests:
- `asegurarControlMatricula?: (...) => Promise<void>`
- o `enviarAvisoControl?: ...` / `existeAvisoControl?: ...`

- [ ] **Step 3: Wire after ficha**

En `completarPlanYaGrabado` y en el camino feliz de `grabarPlanPagosErp`, **después** de `actualizarMatriculaFirmada` OK y **antes** de `registrarMatriculaActualizada` / aviso matriculado:

```ts
await asegurarControlMatriculaTrasFicha({ pool, ambiente, input, codcliAcademico, numOperacion, deps })
```

Si `cerrarFicha === false`, no llamar.

- [ ] **Step 4: Tests**

Con pool mock que distingue `execute(name)`:
- tras ficha OK llama `sp_insert_control_matricula` con params correctos
- si fila existe desfasada → UPDATE (no insert o insert+update según diseño)
- fallo del control → grabar igual `ok: true` y se dispara aviso una vez
- `cerrarFicha: false` → no llama control
- camino `already` (MT_CTAPAG previa) con cerrar ficha → también asegura control

- [ ] **Step 5: Verify**

```bash
cd /opt/uniacc-api-docker && npx tsx --test src/services/grabar-plan-pagos-erp.service.test.ts && npm run type-check
```

Expected: PASS + type-check OK.

---

### Task 2: Deploy mol-dev (API)

**Files:** none (ops)

- [ ] Rebuild `uniacc-api` en este host (`docker compose up -d --build` en `/opt/uniacc-api-docker`) para que mol-dev (apigateway-dev) tome el cambio.
- [ ] No tocar uniacc-mol hasta prueba E2E OK.
