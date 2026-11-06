# Pago con tarjeta, Webpay y Redcompra en la cartera

Nota de análisis. Producción U+, solo lectura. Fecha del cruce: 2026-10-05.

## Decisión para MOL

Cada transacción de Webpay, matrícula y arancel por separado, se graba en U+ con el mismo código en los dos conceptos.

| Medio que autoriza Transbank | Código `MT_DOCPAG` | Nombre |
|---|---:|---|
| Webpay con tarjeta de crédito | 434 | Tarjeta de crédito pago total |
| Débito | 435 | Redcompra pago total |
| Prepago | 435 | Redcompra pago total |

No se usan el 70 (WebPay), el 104 (Pago Transbank), el 14 (tarjeta crédito), el 18 (Redcompra), el 440 ni el 444. El código 434 y el 435 tienen `DESP_MAT = S` y `DESP_ARA = S`.

## Qué se buscó

Alguien de la cartera 2027-1 que haya pagado matrícula y/o arancel con tarjeta de crédito, Webpay o un medio electrónico parecido.

- Catálogo de códigos: `MT_DOCPAG` (`TIPODOC`, `NOMBRE`).
- Cargo: boleta `MT_CTADOC` con `CTADOC = 41`. Ítem 1 es matrícula, ítem 2 es arancel.
- Pago: `MT_CTAPAG.CTAPAG` unido al cargo por `MT_CTADEP`.
- Pagado: `ESTADO = 1` y `SALDO = 0`.
- Año del pago: 2026, período 1 en los ejemplos. La cartera es la de rematrícula 2027-1 (`mnp_cartera_oficial`, rematriculable y no excluida de MOL).

## Códigos que existen y no se usaron

En `MT_DOCPAG` están el `70` (WebPay) y el `104` (Pago Transbank). En 2026 no aparecen aplicados a la boleta 41 de matrícula o arancel. `DESP_MAT` y `DESP_ARA` del 70 vienen nulos; los del 104 vienen en `N`.

Los pagos electrónicos de matrícula y arancel de 2026 quedaron grabados con los códigos de abajo.

## Códigos que sí pagaron matrícula o arancel en 2026

Alumnos distintos, documento pagado. El conteo es de toda la producción 2026, no solo de la cartera.

| Código | Nombre | Matrícula (ítem 1) | Arancel (ítem 2) |
|---|---|---:|---:|
| 14 | Tarjeta crédito | 112 | 23 |
| 18 | Redcompra | 424 | 15 |
| 434 | Tarjeta de crédito pago total | 13 | 31 |
| 435 | Redcompra pago total | 3 | 11 |
| 440 | Tarjeta de crédito múltiple total | 203 | 249 |
| 444 | Redcompra múltiple total | 3 | 8 |

También existen, con `DESP_MAT = S` y `DESP_ARA = S`, pero no salieron en ese cruce de 2026: efectivo (1), cheque a fecha (2), pagaré (5), depósito (9), vale vista (10 y 15), Servipag (103).

## Ejemplos dentro de la cartera

Período 2026-1. Están en `mnp_cartera_oficial`, rematriculables y no excluidos de MOL.

### Los dos conceptos con tarjeta de crédito

- Felipe Andrés Aranda Caballero, RUT 15776837-9, Psicología. Matrícula $200.000 con código 14 (tarjeta crédito). Arancel $2.533.650 con código 434 (tarjeta de crédito pago total).
- Paula Ivonne Sánchez Vera, RUT 12418698-6, Psicología. Los dos con código 440 (tarjeta de crédito múltiple total): matrícula $200.000 y arancel $2.460.500.
- Marcia Jessica Hernández Soto, RUT 13525415-0, Psicología. Los dos con código 440: matrícula $225.000 y arancel $2.636.250.

### Redcompra

- Darwin Angelo Briones Palma, RUT 13900721-2, Psicología. Los dos con código 18: matrícula $225.000 y arancel $775.000.
- Ignacia María Chacón Aliaga, RUT 21720343-0, Traducción e interpretariado bilingüe. Matrícula $225.000 con código 435 (Redcompra pago total). Arancel $100.878 con código 18.
- Alexandra Herminia Santander Zurita, RUT 12247501-8, Psicología. Arancel $3.582.450 con código 444 (Redcompra múltiple total).
- Giannina Milenka Tardito Ibañez, RUT 18464385-5, Periodismo. Arancel $2.125.340 con código 435.
- Damaris Valentina Sepúlveda Sepúlveda, RUT 20332847-8, Diseño de interiores y ambientes / Arquitectura. Matrícula $250.000 con código 444.
