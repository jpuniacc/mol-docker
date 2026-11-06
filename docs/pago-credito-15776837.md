# Cómo pagó Felipe Andrés Aranda Caballero

RUT 15776837-9 · Psicología (PSIC1SR) · contrato `20252PSIC1SR52381` · operación de matrícula 918341 · período 2026-1.

Fuente: U+ producción. Consultas:

```sql
SELECT * FROM MT_DOCITEM WHERE CODCLI = 15776837 AND ANO = 2026;
SELECT * FROM MT_CTADOC WHERE CODCLI = 15776837 AND ANO = 2026;
SELECT * FROM MT_CTAPAG WHERE CODCLI = 15776837 AND ANO = 2026;
SELECT * FROM MT_CTADEP WHERE CODCLI = 15776837 AND ANO = 2026;
SELECT * FROM MT_POSBEN WHERE CODCLI = 15776837 AND ANO = 2026;
```

| Concepto | Monto |
|---|---:|
| Matrícula, boleta 399256 | $250.000 |
| Arancel, boleta 399257 | $3.810.000 |
| Pagado con tarjeta el 1 dic 2025 | $2.733.650 |
| Saldo de las dos boletas | $0 |

## Cobertura de cada boleta

Montos aplicados en `MT_CTADEP` el 1 de diciembre de 2025. La suma de cada tabla es el monto de la boleta 41.

### Boleta 399256 · matrícula

Ítem 1 · cancelada · $250.000.

| Medio | Código | Folio | Monto |
|---|---:|---:|---:|
| Tarjeta crédito | 14 | 48825 | $200.000 |
| Descuento matrícula noviembre | 373 | 90121330343 | $50.000 |

### Boleta 399257 · arancel

Ítem 2 · cancelada · $3.810.000.

| Medio | Código | Folio | Monto |
|---|---:|---:|---:|
| Tarjeta de crédito pago total | 434 | 4882501 | $2.533.650 |
| Beca Talento Virtual 2 | 373 | 90121330344 | $1.143.000 |
| Descuento por forma de pago | 20 | 90121330345 | $133.350 |

## Dónde se ve el crédito en la cuenta

El arancel con tarjeta queda como un pago propio: `MT_CTAPAG` código 434, folio 4882501, $2.533.650, estado cancelada y saldo 0. La glosa va vacía; el nombre sale de `MT_DOCPAG`. `MT_CTADEP` lo aplica entero a la boleta 41 folio 399257.

La matrícula no usa el 434: usa el código 14, folio 48825, por $200.000.

## Ítems de la boleta

`MT_DOCITEM` · operación 918341 · estado 1. El ítem 1 es matrícula y el ítem 2 es arancel. La glosa del ítem va vacía.

| Ítem | Boleta | Precio | Monto | Carrera |
|---:|---|---:|---:|---|
| 1 | 41 / 399256 | $250.000 | $250.000 | PSIC1SR |
| 2 | 41 / 399257 | $3.810.000 | $3.810.000 | PSIC1SR |

## Beneficios que alimentan los pagos 373

`MT_POSBEN` · aprobados · operación 918341. El monto aprobado coincide con el pago 373 de cada boleta.

| Código | Beneficio | Porcentaje | Monto aprobado | Aplica a |
|---:|---|---:|---:|---|
| 2025 | Descuento matrícula noviembre | 20% | $50.000 | Matrícula |
| 1809 | Beca Talento Virtual 2 | 30% | $1.143.000 | Arancel |

## El mismo folio, tres días después, como documento por conciliar

El 4 de diciembre de 2025, operación 919758, aparecen dos cargos con el mismo folio y el mismo monto del pago con tarjeta. Quedan cancelados ese día. Están en `MT_CTADOC` del año 2026 y no tienen fila en `MT_CTADEP`.

| Documento | Nombre | Folio | Monto | Vencimiento | Cancelación |
|---:|---|---:|---:|---|---|
| 807 | TCRED por conciliar | 48825 | $200.000 | 1 dic 2025 | 4 dic 2025 |
| 809 | Tarjeta de crédito total por conciliar | 4882501 | $2.533.650 | 1 dic 2025 | 4 dic 2025 |

## Ocho depósitos de 2026 que salen en la misma consulta

`MT_CTAPAG` y `MT_CTADEP` con `ANO` 2026 también traen ocho depósitos bancarios (código 9) de $273.365 cada uno, $2.186.920 en total. Cada uno cancela un cargo 811, tarjeta de crédito múltiple por conciliar, del período 2025-2. Esos cargos no están en `MT_CTADOC` con `ANO` 2026, y no se aplican a las boletas 399256 ni 399257.

| Cargo 811 | Vencimiento | Depósito | Operación | Cancelado |
|---:|---|---:|---:|---|
| 4882503 | 4 feb 2026 | 3493 | 934279 | 4 feb 2026 |
| 4882504 | 4 mar 2026 | 4049 | 938184 | 4 mar 2026 |
| 4882505 | 4 abr 2026 | 6904 | 949586 | 24 abr 2026 |
| 4882506 | 4 may 2026 | 9774 | 952486 | 6 may 2026 |
| 4882507 | 4 jun 2026 | 3778 | 958081 | 4 jun 2026 |
| 4882508 | 4 jul 2026 | 4679 | 964251 | 6 jul 2026 |
| 4882509 | 4 ago 2026 | 6852 | 971735 | 5 ago 2026 |
| 4882510 | 4 sep 2026 | 3910 | 978245 | 4 sep 2026 |
