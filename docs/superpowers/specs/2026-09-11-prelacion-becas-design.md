# Prelación de becas y descuentos (cascada)

Fecha: 2026-09-11  
Proyecto: `mol-docker`  
Estado: implementado en mock 2027-01 (sin escritura a U+)

## Decisión

MOL recalcula el arancel a pagar en **cascada** según Decreto 3/2026 Arts. 8, 9, 10 y 19. No se suman los montos ERP sobre el bruto.

- `%` de cada ítem: `monto / arancel_bruto` (se ignora `porc_apr`; se puede cambiar después).
- Art. 13 ajusta ese `%` en internas que midan promedio, antes de aplicar.
- Todo el descuento va al **arancel**. La matrícula queda plena.
- CAE no resta: no hay monto financiado; el saldo es el copago.

## Orden

1. Estatales (`ESTATAL`), en el orden del detalle, cada una sobre el saldo.
2. Internas `MOL_DVU`:
   - Ganadora = renovable de mayor `%` ya ajustado. **1756 no entra** a esa pelea.
   - **1756 Apoyo UNIACC Renovable** se acumula siempre a la ganadora, **aunque su % sea mayor**.
   - Si hay maternidad (nombre/código), **solo esa**; ni 1756 ni el resto.
   - `1811` Apoyo no renovable queda fuera (`NO_RENOVABLE`).
3. Convenios (`CONVENIO`), apilables sobre el saldo.
4. Topes: internas ≤ 70 % del arancel bruto; estatal + interna + convenio ≤ 100 %. Recorte desde el final (convenio, luego interna).

Fuera de prelación: `NO_RENOVABLE`, `NO_VIGENTE`, `EN_REVISION`, `FORMA_PAGO`, sin catálogo, internas que pierden Art. 13.

**SUBDERE** no entra a MOL ni a esta cascada (mismo bloqueo que fuera de cartera). Ver `docs/superpowers/specs/2026-09-15-subdere-fuera-mol-design.md`.

## UI

Forma de pago muestra desglose (estatal / interna / convenio / tope / neto) y badge Aplica / motivo de exclusión. El checkbox deja de mandar el total.

## Fuera de alcance

Recalcular forma de pago al elegir medio; persistir cascada en U+; monto CAE.
