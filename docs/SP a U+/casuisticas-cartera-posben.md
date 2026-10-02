# Casos para revisar

Fecha: 2026-10-02. Lectura en U+ PROD, base `UNIACC`. Ninguna escritura.

Cada caso es un alumno real. Arriba va el documento que se grabó. Abajo, la fila de `MT_POSBEN` que hay que dejar marcada cuando ese beneficio entra en la matrícula.

La nota de grabación está en [`grabacion-erp-sp-plan-pagos.md`](grabacion-erp-sp-plan-pagos.md).

`CODCLI` es el RUT sin dígito verificador. En la boleta 41, el ítem 1 es matrícula y el ítem 2 es arancel. `CTAPAG.CODBEN` queda vacío: el código del beneficio vive en `MT_POSBEN`, no en el documento de pago.

Los folios de estos casos son los que escribió caja. No siempre salen seguidos, porque cada pantalla pidió el número en otro momento. El SP que estamos definiendo los reservaría seguidos, al generar el plan.

---

## Cómo se marca el beneficio

La fila ya existe antes de matricular. Al confirmar se actualiza esa fila. No se inserta otra con la misma clave.

Clave: `CODBEN` + `ORDEN` + `CODCLI` + `CODCARR` + `ANO` + `PERIODO`.

| Campo | Valor al usarlo en la matrícula |
| --- | --- |
| `ESTADO` | `4` (ASIGNADO) |
| `num_operacion` | La operación de esa matrícula |
| `FECASIG` | Fecha de la matrícula, a las 00:00 |
| `APROBADO` | `S` |
| `MONTO` | El monto del folio de ese beneficio |
| `APLICABLE` | `1` en beca y en descuento de matrícula. `2` en CAE (`CODBEN` 4) |

`MT_BENEFICIO.APLICONCEPTO`: `M` va a la boleta de matrícula, `A` a la de arancel. `FPAGOGENERADA`: `373` es la beca y el descuento de matrícula, `21` es el CAE.

Un beneficio usado es una fila y un folio. Dos becas en el arancel son dos filas y dos folios 373.

El descuento por forma de pago (tipo 20) no tiene fila. El alumno sin beneficio no tiene filas de ese año.

---

## Índice

| Caso | RUT | Operación | Qué revisar |
| --- | --- | --- | --- |
| [Dos pagarés, cada uno con beca](#caso-1) | 17521611 | 919638 | 618 operaciones. Pagaré de matrícula y pagaré de arancel, y una beca en cada uno. |
| [Matrícula cubierta al 100 %](#caso-2) | 16134914 | 910589 | 517 operaciones. No hay pagaré de matrícula. |
| [Matrícula a precio pleno](#caso-3) | 17502346 | 932779 | 458 operaciones. Una sola beca, en el arancel. |
| [Dos becas en el arancel](#caso-4) | 10951718 | 936298 | 194 operaciones. Un folio por beca. El monto aplicado puede ser menor que el pedido. |
| [CAE con descuento de matrícula](#caso-5) | 10281886 | 931196 | 186 operaciones. El CAE es una fila más, con documento 21. |
| [CAE y matrícula a precio pleno](#caso-6) | 10159301 | 936828 | 84 operaciones. CAE y beca solo en el arancel. |
| [Cheques y descuento de matrícula](#caso-7) | 21310817 | 918177 | El descuento de noviembre sí es beneficio. El 3 % del arancel no. |
| [Sin beneficio](#caso-8) | 19740769 | 926434 | No hay filas en `MT_POSBEN`. |
| [Referencia del orden de folios](#caso-9) | 22316526 | 919274 | Fuera de la cartera (Retiro Definitivo). Es una de las dos operaciones con las que se cerró el orden. |

---

## Caso 1. Dos pagarés, cada uno con beca

RUT 17521611 · operación 919638 · ARQU1SR · 2026-1. Esta firma aparece en 618 operaciones.

| Ítem | Documento | Folio | Monto |
| --- | --- | --- | ---: |
| Matrícula | Pagaré 5 | 90121332133 | 225.000 |
| Arancel | Pagaré 5 | 90121332134 | 2.080.000 |
| Matrícula | Beca 373 | 90121332135 | 25.000 |
| Arancel | Beca 373 | 90121332136 | 2.080.000 |

Los dos pagarés van primero. Las dos becas ocupan los folios siguientes. El pagaré de matrícula es el saldo: 250.000 − 25.000.

`MT_POSBEN`. Estado 4, `APLICABLE` 1, `FECASIG` 2025-12-04.

| CODBEN | Beneficio | Va a | Orden | Monto | % |
| --- | --- | --- | ---: | ---: | ---: |
| 1744 | Beca Talento Presencial | Arancel | 1 | 2.080.000 | 50 |
| 2028 | Descuento matrícula diciembre | Matrícula | 2 | 25.000 | 10 |

```sql
SELECT * FROM MT_POSBEN WHERE NUM_OPERACION = 919638
SELECT * FROM MT_CTAPAG WHERE NUM_OPERACION = 919638
SELECT * FROM MT_CTADEP WHERE NUM_OPERACION = 919638
```

---

## Caso 2. Matrícula cubierta al 100 %

RUT 16134914 · operación 910589 · ADPU2AE · 2026-1. Esta firma aparece en 517 operaciones.

| Ítem | Documento | Folio | Monto |
| --- | --- | --- | ---: |
| Arancel | Pagaré 5 | 90121320816 | 2.233.000 |
| Matrícula | Beca 373 | 90121320817 | 250.000 |
| Arancel | Beca 373 | 90121320818 | 957.000 |

No hay pagaré de matrícula: el descuento la cubre entera. El pagaré del arancel va primero y las becas en los folios siguientes. 957.000 + 2.233.000 = 3.190.000 de arancel.

`MT_POSBEN`. Estado 4, `APLICABLE` 1, `FECASIG` 2025-10-27.

| CODBEN | Beneficio | Va a | Orden | Monto | % |
| --- | --- | --- | ---: | ---: | ---: |
| 1791 | Descuento anticipación matrícula nuevo | Matrícula | 1 | 250.000 | 100 |
| 1756 | Apoyo UNIACC renovable | Arancel | 1 | 957.000 | 30 |

```sql
SELECT * FROM MT_POSBEN WHERE NUM_OPERACION = 910589
SELECT * FROM MT_CTAPAG WHERE NUM_OPERACION = 910589
SELECT * FROM MT_CTADEP WHERE NUM_OPERACION = 910589
```

---

## Caso 3. Matrícula a precio pleno

RUT 17502346 · operación 932779 · PSIC1SR · 2026-1. Esta firma aparece en 458 operaciones.

| Ítem | Documento | Folio | Monto |
| --- | --- | --- | ---: |
| Matrícula | Pagaré 5 | 90121358622 | 250.000 |
| Arancel | Pagaré 5 | 90121358628 | 2.667.000 |
| Arancel | Beca 373 | 90121358629 | 1.143.000 |

La matrícula no tiene beneficio: el pagaré es el valor pleno, 250.000. La beca está solo en el arancel.

`MT_POSBEN`. Una fila. Estado 4, `APLICABLE` 1, `FECASIG` 2026-01-28.

| CODBEN | Beneficio | Va a | Orden | Monto | % |
| --- | --- | --- | ---: | ---: | ---: |
| 1744 | Beca Talento Presencial | Arancel | 1 | 1.143.000 | 30 |

```sql
SELECT * FROM MT_POSBEN WHERE NUM_OPERACION = 932779
SELECT * FROM MT_CTAPAG WHERE NUM_OPERACION = 932779
SELECT * FROM MT_CTADEP WHERE NUM_OPERACION = 932779
```

---

## Caso 4. Dos becas en el arancel

RUT 10951718 · operación 936298 · TRSO2AE · 2026-1. Esta firma aparece en 194 operaciones.

| Ítem | Documento | Folio | Monto |
| --- | --- | --- | ---: |
| Arancel | Pagaré 5 | 90121369055 | 1.630.200 |
| Matrícula | Beca 373 | 90121369056 | 250.000 |
| Arancel | Beca 373 | 90121369057 | 1.144.000 |
| Arancel | Beca 373 | 90121369058 | 85.800 |

La matrícula queda cubierta y no tiene pagaré. En el arancel hay dos becas y cada una tiene su folio.

`MT_POSBEN`. Estado 4, `APLICABLE` 1, `FECASIG` 2026-02-21.

| CODBEN | Beneficio | Va a | Orden | Monto en el folio | Pedido |
| --- | --- | --- | ---: | ---: | ---: |
| 1791 | Descuento anticipación matrícula nuevo | Matrícula | 1 | 250.000 | 250.000 |
| 1756 | Apoyo UNIACC renovable | Arancel | 1 | 1.144.000 | 1.144.000 |
| 1811 | Apoyo UNIACC no renovable | Arancel | 1 | 85.800 | 143.000 |

En 1811 el folio y `MONTO` usan 85.800. `MONTO_SOL` quedó en 143.000. Al pegar el beneficio, el monto que se escribe es el del folio.

```sql
SELECT * FROM MT_POSBEN WHERE NUM_OPERACION = 936298
SELECT * FROM MT_CTAPAG WHERE NUM_OPERACION = 936298
SELECT * FROM MT_CTADEP WHERE NUM_OPERACION = 936298
```

---

## Caso 5. CAE con descuento de matrícula

RUT 10281886 · operación 931196 · PSIC1SR · 2026-1. Esta firma aparece en 186 operaciones.

| Ítem | Documento | Folio | Monto |
| --- | --- | --- | ---: |
| Matrícula | Pagaré 5 | 90121355974 | 200.000 |
| Arancel | Pagaré CAE 21 | 90121355975 | 3.145.000 |
| Matrícula | Beca 373 | 90121355976 | 50.000 |
| Arancel | Beca 373 | 90121355977 | 555.000 |

`MT_POSBEN`. Estado 4, `FECASIG` 2026-01-26.

| CODBEN | Beneficio | Va a | Orden | Aplicable | Monto en el folio | Pedido |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| 2025 | Descuento matrícula noviembre | Matrícula | 1 | 1 | 50.000 | 50.000 |
| 1756 | Apoyo UNIACC renovable | Arancel | 1 | 1 | 555.000 | 555.000 |
| 4 | Crédito Aval del Estado | Arancel | 1 | 2 | 3.145.000 | 3.250.968 |

El CAE se marca igual que una beca: estado 4 y `num_operacion`. El documento es tipo 21. El folio usa `MONTO` (3.145.000), menor que lo pedido. `Monto_cae_aprobado` queda vacío. `APLICABLE` queda 2.

```sql
SELECT * FROM MT_POSBEN WHERE NUM_OPERACION = 931196
SELECT * FROM MT_CTAPAG WHERE NUM_OPERACION = 931196
SELECT * FROM MT_CTADEP WHERE NUM_OPERACION = 931196
```

---

## Caso 6. CAE y matrícula a precio pleno

RUT 10159301 · operación 936828 · CONA1AR · 2026-1. Esta firma aparece en 84 operaciones.

| Ítem | Documento | Folio | Monto |
| --- | --- | --- | ---: |
| Matrícula | Pagaré 5 | 90121370432 | 250.000 |
| Arancel | Pagaré CAE 21 | 90121370433 | 1.547.000 |
| Arancel | Beca 373 | 90121370434 | 663.000 |

No hay fila de matrícula en `MT_POSBEN`. El pagaré de matrícula es el valor pleno.

`MT_POSBEN`. Estado 4, `FECASIG` 2026-02-25.

| CODBEN | Beneficio | Va a | Orden | Aplicable | Monto en el folio | Pedido |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| 4 | Crédito Aval del Estado | Arancel | 1 | 2 | 1.547.000 | 1.990.000 |
| 1756 | Apoyo UNIACC renovable | Arancel | 1 | 1 | 663.000 | 663.000 |

```sql
SELECT * FROM MT_POSBEN WHERE NUM_OPERACION = 936828
SELECT * FROM MT_CTAPAG WHERE NUM_OPERACION = 936828
SELECT * FROM MT_CTADEP WHERE NUM_OPERACION = 936828
```

---

## Caso 7. Cheques y descuento de matrícula

RUT 21310817 · operación 918177 · TRIE1DR · 2026-1.

| Ítem | Documento | Folio | Monto |
| --- | --- | --- | ---: |
| Matrícula | Cheque a fecha 2 | 9953814 | 200.000 |
| Matrícula | Beca 373 | 90121330031 | 50.000 |
| Arancel | Diez cheques a fecha 2 | 9953815 a 9953824 | 323.010 cada uno |
| Arancel | Descuento por forma de pago 20 | 90121330032 | 99.900 |

`MT_POSBEN`. Una fila. Estado 4, `APLICABLE` 1, `FECASIG` 2025-12-01.

| CODBEN | Beneficio | Va a | Orden | Monto | % |
| --- | --- | --- | ---: | ---: | ---: |
| 2025 | Descuento matrícula noviembre | Matrícula | 1 | 50.000 | 20 |

El 3 % del arancel (tipo 20, folio 90121330032) no tiene fila en `MT_POSBEN`. El cheque usa una numeración corta, distinta de `CORRPAGNUM`.

```sql
SELECT * FROM MT_POSBEN WHERE NUM_OPERACION = 918177
SELECT * FROM MT_CTAPAG WHERE NUM_OPERACION = 918177
SELECT * FROM MT_CTADEP WHERE NUM_OPERACION = 918177
```

---

## Caso 8. Sin beneficio

RUT 19740769 · operación 926434 · PSIC1DR · 2026-1.

| Ítem | Documento | Folio | Monto |
| --- | --- | --- | ---: |
| Matrícula | Cheque a fecha 2 | 2207 | 250.000 |
| Arancel | Diez cheques a fecha 2 | 2196 a 2205 | 369.570 cada uno |
| Arancel | Descuento por forma de pago 20 | 90121341242 | 114.300 |

`MT_POSBEN` no tiene filas de este RUT en 2026. No hay beneficio que marcar. El tipo 20 se graba solo en la cuenta corriente.

```sql
SELECT * FROM MT_POSBEN WHERE CODCLI = '19740769' AND ANO = 2026
SELECT * FROM MT_CTAPAG WHERE NUM_OPERACION = 926434
SELECT * FROM MT_CTADEP WHERE NUM_OPERACION = 926434
```

---

## Caso 9. Referencia del orden de folios

RUT 22316526 · operación 919274 · MUCO1DR · 2026-1.

Este RUT está como Retiro Definitivo en la base de la cartera. No entra en los 4.103 rematriculables. Se deja aquí porque, junto con el caso 2, es la operación con la que se cerró el orden de los folios.

| Ítem | Documento | Folio | Monto |
| --- | --- | --- | ---: |
| Arancel | Pagaré 5 | 90121331606 | 4.990.000 |
| Matrícula | Beca 373 | 90121331607 | 25.000 |
| Matrícula | Efectivo 1 | 90121331608 | 225.000 |

El pagaré del arancel va primero. El descuento de matrícula ocupa el folio siguiente. El resto de la matrícula es efectivo, no un segundo pagaré. El 2026-03-31 una nota de crédito 383 anuló el pagaré completo.

`MT_POSBEN`. Una fila. Estado 4, `APLICABLE` 1, `FECASIG` 2025-12-03.

| CODBEN | Beneficio | Va a | Orden | Monto | % |
| --- | --- | --- | ---: | ---: | ---: |
| 2028 | Descuento matrícula diciembre | Matrícula | 2 | 25.000 | 10 |

```sql
SELECT * FROM MT_POSBEN WHERE NUM_OPERACION = 919274
SELECT * FROM MT_CTAPAG WHERE NUM_OPERACION = 919274
SELECT * FROM MT_CTADEP WHERE NUM_OPERACION = 919274
```
