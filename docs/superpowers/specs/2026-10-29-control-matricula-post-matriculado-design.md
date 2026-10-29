# Control de matrícula después de matricular

Fecha: 2026-10-29  
Proyectos: `uniacc-api-docker` (código), `mol-docker` (docs / despliegue mol-dev)  
Estado: diseño aprobado

## Problema

Al cerrar rematrícula MOL graba la cuenta (`sp_mol_grabar_plan_pagos`) y actualiza la ficha (`SP_MOL_ACTUALIZA_MATRICULA_FIRMADA`), pero **no escribe** en `MT_CONTROL_MATRICULA`.

Caso: Hans Aarón Vidal Rojo, RUT `17.562.199-7`, código `20231IIMU2AE003`, operación de cuenta `987912`, periodo `2027-1`. Quedó con pagarés, `MT_POSBEN` 2031 y `MT_ALUMNO` en 2027/1. En `MT_CONTROL_MATRICULA` solo existen filas 2023/2024/2025; no hay 2027-1.

En U+ clásico esa tabla se llena con `sp_insert_control_matricula` y luego `sp_update_control_matricula`. MOL no llama ninguno.

## Decisiones

| Tema | Decisión |
|------|----------|
| Cuándo | Después de que la ficha quede matriculada (`SP_MOL_ACTUALIZA_MATRICULA_FIRMADA` OK) |
| Qué SP | Solo `dbo.sp_insert_control_matricula` en el camino feliz de insert |
| Estado inicial | `'OK'` (la cuenta ya cuadra; no usamos `PENDIENTE` en esta entrega) |
| Si ya existe fila mismo codcli+carrera+año+periodo | Upsert liviano en MOL: `UPDATE` a `ESTADO='OK'`, `NUM_OPERACION` actual y `FECHA=GETDATE()` |
| `sp_update_control_matricula` | Fuera de alcance (devengo / jornada / validaciones extra) |
| Punto de enganche | Dentro de `grabarPlanPagosErp`, tras actualizar ficha (incluye camino `already`) |
| Fallo del control | Soft-fail + correo (opción C): no revierte cuenta ni ficha |
| Usuario U+ | `USUARIO_CAJA_MOL[ambiente]` (`prod` `68678`, `test` `69065`) |
| Rollout | Primero **mol-dev** (pruebas), después **uniacc-mol** (prod) |

## Flujo

```text
grabar cuentas OK
  → actualizar ficha OK
  → insertar/asegurar MT_CONTROL_MATRICULA
  → log KPI matriculado + aviso matriculado
```

Si `cerrarFicha === false`, no se llama al control (la ficha sigue abierta).

### Helper

`insertarControlMatriculaErp` (nombre tentativo) en `uniacc-api-docker`:

1. `EXEC dbo.sp_insert_control_matricula` con:

| Param | Valor |
|-------|--------|
| `@codcli` | RUT sin DV (`input.codcli`) |
| `@codcarr` | `input.codcarr` |
| `@ano` / `@periodo` | periodo de rematrícula |
| `@estado` | `'OK'` |
| `@usuario` | entero de `USUARIO_CAJA_MOL[ambiente]` |
| `@num_operacion` | número de operación de la cuenta |

2. Leer si existe fila para ese `codcli + codcarr + ano + periodo`.
3. Si no existía antes del insert, listo.
4. Si ya existía (o tras el insert sigue desfasada: `ESTADO <> 'OK'` o `NUM_OPERACION` distinta), ejecutar:

```sql
UPDATE dbo.MT_CONTROL_MATRICULA
SET ESTADO = 'OK',
    NUM_OPERACION = @num_operacion,
    USUARIO = @usuario,
    FECHA = GETDATE()
WHERE CODCLI = @codcli
  AND CODCARR = @codcarr
  AND ANO = @ano
  AND PERIODO = @periodo;
```

El `IF NOT EXISTS` del SP evita duplicados; el `UPDATE` alinea reintentos y filas viejas del mismo periodo.

## Errores y avisos

| Situación | Cuenta / ficha | Respuesta grabar | Log / correo |
|-----------|----------------|------------------|--------------|
| Control OK (insert o update) | Intactas | `ok: true` | Intento `cuenta` / `control_matricula` `ok` (opcional) |
| Control falla (timeout, SQL, etc.) | Intactas | `ok: true` | Intento `error` + evento `matricula` / `aviso_control_matricula` (una vez por codcli+periodo) + correo |
| Fila ya correcta (mismo op. y `OK`) | Intactas | `ok: true` | Éxito silencioso |

Correo: `EmailService.enviarMailRematriculaAviso`, mismos destinatarios que `aviso_no_grabado` (`hans.vidal@uniacc.cl`, `juan.silva@uniacc.cl`, cc `mol@uniacc.cl`). Payload: nombre/RUT/código/periodo/`numOperacion`/motivo.

La marca de avisado es `log_mol_evento` categoría `matricula`, acción `aviso_control_matricula`, por código académico + año + semestre. Se escribe tras envío OK. No se reenvía en el mismo periodo.

## Rollout

1. **mol-dev** (host de desarrollo / stack de prueba): desplegar API con el cambio, ambiente ERP según `tp_mnp_erp_sp_ambiente` usado en esa prueba, rematricular un RUT de prueba y verificar fila en `MT_CONTROL_MATRICULA`.
2. Solo con esa prueba OK → desplegar en **uniacc-mol** (producción).
3. Backfill one-shot de Hans (`17562199` / `IIMU2AE` / `2027` / `1` / op. `987912`) en prod, fuera del path automático si hace falta; no bloquea el merge.

No se modifica el SP de U+ en esta entrega.

## Fuera de alcance

- Llamar `sp_update_control_matricula`.
- Alterar `sp_insert_control_matricula` en SQL Server.
- Job de barrido genérico de controles faltantes.
- Cambios de UI en `mol-docker`.
- Revertir o regrabar la cuenta de Hans.

## Pruebas

En `uniacc-api-docker`, con pool ERP y correo simulados:

- Tras ficha OK, se llama al insert con los params correctos.
- Si la fila ya existe, corre el `UPDATE` a `OK` + `NUM_OPERACION` actual.
- Fallo del control: no lanza; registra intento; envía un solo correo por periodo.
- `cerrarFicha=false`: no llama al control.
- Camino `already` (plan ya en U+): también asegura el control al cerrar ficha.

En mol-dev, prueba E2E: un alumno rematriculado muestra fila `MT_CONTROL_MATRICULA` del periodo activo con `ESTADO='OK'` y la `NUM_OPERACION` de la cuenta.

## Criterios de éxito

- Toda matrícula MOL que cierre ficha deja (o alinea) una fila de control del periodo con `OK` y la operación de cuenta.
- Un fallo de control no deshace cuentas ni ficha; el equipo recibe un solo aviso por alumno/periodo.
- El cambio se valida primero en mol-dev y recién entonces se publica en uniacc-mol.
