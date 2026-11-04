# Aviso rollover descuento matrícula (pestaña abierta)

**Fecha:** 2026-11-04  
**Proyecto:** mol-docker  
**Rollout:** primero **mol-dev** (uniacc-desarrollo); **uniacc-mol** (prod) solo tras prueba OK.

## Problema

En forma de pago, `descuentoMatriculaAplicado` usa `fechaChileIso()` dentro de un `computed` sin dependencia reactiva al reloj. Si el alumno deja la pestaña abierta del 30-11 al 01-12 y genera plan / paga, puede usar el descuento de noviembre sin F5.

## Decisión

- Actualizar montos en pantalla + toast (`vue-sonner`). Sin logout.
- Misma sync al inicio de pagar / generar cuotas / confirmar pagaré / Webpay; si el descuento cambió, toast y abortar la acción.
- Con reserva CAE vigente el monto no cambia → sin toast.

## Diseño

1. `hoyChileIso` ref alimenta el computed.
2. `syncHoyChileDescuento()`: si el día Chile cambió, actualiza el ref, compara snapshot nombre/monto, toast si cambió.
3. Triggers: `visibilitychange` (visible), `window` focus, `setTimeout` hasta próxima medianoche Chile (+ margen), cleanup al desmontar.
4. Gates en `abrirPagoMatricula`, `iniciarWebpay`, `generarCuotasPagare`, `confirmarPagareMatricula`.

Helpers puros en `descuentoMatriculaMes.ts`: `descuentoMatriculaCambio`, `msHastaProximaMedianocheChile`.
