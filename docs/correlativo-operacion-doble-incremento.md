# Correlativo de operación: dos incrementos

El número de operación se incrementa dos veces porque hoy lo piden dos momentos distintos. El primero es correcto. El segundo lo hace `dbo.sp_mol_grabar_plan_pagos` al grabar la cuenta.

Ejemplo: `MT_PARAME_DET.Valor` de `CORRELATIVO` parte en `981379`.

## 1. El alumno entra a la forma de pago

El front llama:

```text
POST /api/rematricula/alumno/contrato/firma/correlativo
```

`correlativoOperacionHttp` llama a `emitirNumeroOperacion()`. Esa función abre la reserva en MOL y, si el alumno todavía no tiene número, ejecuta en SQL Server de test:

```sql
UPDATE dbo.MT_PARAME_DET
SET Valor = CONVERT(varchar(30), CONVERT(bigint, Valor) + 1)
OUTPUT INSERTED.Valor
WHERE IdParametro = 'CORRELATIVO'
  AND NumLinea = (
    SELECT TOP (1) NumLinea
    FROM dbo.MT_PARAME_DET
    WHERE IdParametro = 'CORRELATIVO'
      AND CONVERT(date, GETDATE()) BETWEEN CONVERT(date, FechaInicio) AND CONVERT(date, FechaTermino)
    ORDER BY NumLinea DESC
  );
```

Código:

- `src/controllers/rematricula-alumno-contrato-firma.controller.ts` — `correlativoOperacionHttp`
- `src/services/operacion-rematricula-http.ts` — `emitirNumeroOperacion`, `consumirCorrelativoUPlus`
- `src/services/operacion-rematricula-store.ts` — `SQL_CONSUMIR_CORRELATIVO`

Resultado:

```text
MT_PARAME_DET: 981379 → 981380
MOL guarda: alumno → 981380
```

El `UPDATE` con `OUTPUT` es atómico. Diez transacciones simultáneas no comparten número: SQL Server bloquea la fila, devuelve el valor que cada una escribió y la siguiente sigue desde ahí.

Si MOL incrementa SQL Server y falla antes de guardar el número, ese correlativo se pierde. No se repite. Un salto en la secuencia es preferible a asignar el mismo número a dos alumnos.

## 2. Webpay y TuFirma usan el número guardado

MOL recupera `981380` desde `mnp.rematricula_operacion`. Matrícula Webpay, arancel Webpay y TuFirma usan ese mismo número. Esos pasos no vuelven a incrementar `CORRELATIVO`.

## 3. Después de firmar, MOL graba el plan

El front llama:

```text
POST /api/rematricula/alumno/plan-pagos/grabar
```

`grabarPlanPagosHttp` llama a `grabarPlanPagosErp()`. El servicio confirma que MOL ya tiene un número:

```ts
const asignado = await leerNumOperacionReservado(...)
if (!asignado) {
  throw new GrabarPlanPagosError('No hay número de operación reservado', 422)
}
```

Después no envía ese número al procedimiento. Solo declara la salida y lo ejecuta:

```ts
request.output('num_operacion', sql.Decimal(20, 0))
result = await request.execute('dbo.sp_mol_grabar_plan_pagos')
```

Código:

- `src/controllers/rematricula-alumno-grabar-plan-pagos.controller.ts` — `grabarPlanPagosHttp`
- `src/services/grabar-plan-pagos-erp.service.ts` — `grabarPlanPagosErp`

## 4. El procedimiento pide otro correlativo

Dentro de `dbo.sp_mol_grabar_plan_pagos`, al abrir la transacción:

```sql
BEGIN TRY
    BEGIN TRAN;

    EXEC dbo.sp_parametro_transaccion_correlativo
        @tipo = 'CORRELATIVO',
        @salida = @num_operacion OUTPUT,
        @muestra = 'NO';
```

Esa llamada vuelve a incrementar la misma fila de `MT_PARAME_DET`:

```text
MT_PARAME_DET: 981380 → 981381
```

Los documentos que crea el procedimiento quedan con `981381`. La API recibe ese valor en `result.output.num_operacion` y lo usa como número de la cuenta grabada.

Referencia del cuerpo: `docs/SP a U+/sp_mol_grabar_plan_pagos.sql`.

El segundo incremento no lo hace TypeScript con un `UPDATE`. Lo hace el procedimiento al ejecutar `dbo.sp_parametro_transaccion_correlativo`.

## Resultado

```text
MOL, Webpay y TuFirma: 981380
Cuenta grabada en U+: 981381
```

`@num_operacion` es solo de salida. Significa «genera el número y devuélvelo». El procedimiento no tiene un parámetro de entrada que signifique «usa este número que ya reservé».

Sin cambiar esa llamada, reservar el número antes de Webpay y dejar el mismo número en la cuenta grabada no se puede cumplir a la vez.
