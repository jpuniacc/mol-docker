# Verificar rollover descuento matrícula vs reserva CAE

Regla: **solo CAE** congela el monto (`mnp_reserva_descuento_matricula`). Sin esa reserva, el descuento es el del **día Chile** al recalcular forma de pago.

## Checklist rápido

1. **Catálogo del día** (prod, periodo `2027-1`):
   - Hoy en noviembre → fila Noviembre **$50.000**.
   - Desde `2026-12-01` → fila Diciembre **$25.000**.
2. **Sin reserva** (alumno en forma de pago, `espera_cae = false`, sin fila en `mnp_reserva_descuento_matricula`):
   - Abrir forma de pago → ver monto del mes actual.
   - Al pasar de mes: **F5** o salir y volver a forma de pago → debe mostrar el monto del mes nuevo (no el del día en que entró).
   - Pestaña abierta cruzando medianoche: al volver el foco / visibilidad, o al dispararse el timer de medianoche Chile, se recalcula; si cambió el descuento → toast *“El descuento de matrícula se actualizó…”*.
   - Si intenta pagar / generar cuotas / confirmar pagaré / Webpay con día stale: misma sync; si cambió, toast y **no** continúa (debe reintentar con montos nuevos).
3. **Con reserva CAE** (ej. `16437657-5` / `20261ICOM4AE032`):
   - Debe mostrar el **monto congelado** (ej. Noviembre $50.000) aunque el calendario ya sea otro mes.
   - Válido mientras `CURRENT_DATE <= reserva_hasta` de esa fila del mantenedor (ej. `2027-01-31`).
4. **No mirar** montos ya grabados en Webpay/borrador post-pago: el rollover importa **antes** de confirmar medio/pago.

## SQL contraste

```sql
-- ¿Congela?
SELECT * FROM public.mnp_reserva_descuento_matricula
WHERE codcli = '<codcli>' AND anio_periodo = 2027 AND semestre_periodo = 1;

-- Catálogo vigente hoy (Chile)
SELECT id, nombre, vigencia_desde, vigencia_hasta, reserva_hasta, monto_descuento
FROM public.tp_mnp_descuento_matricula_anticipada
WHERE periodo = '2027-1' AND activo AND aplicable_a = 'MATRICULA'
  AND (CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date
      BETWEEN vigencia_desde AND vigencia_hasta;
```

## Tests

```bash
npx vitest run src/utils/descuentoMatriculaMes.test.ts
```

Incluye: rollover sin reserva nov→dic, y reserva CAE que no hace rollover en diciembre.
