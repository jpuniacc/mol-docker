# Tarjetas de prueba de Webpay Plus

Sirven solo en el ambiente de integración (`https://webpay3gint.transbank.cl`). En producción Transbank no acepta estos números.

Fuente: [Cómo empezar, tarjetas de prueba](https://www.transbankdevelopers.cl/documentacion/como_empezar#tarjetas-de-prueba). Copiado el 7 de octubre de 2026.

Cuando el formulario pide RUT y clave, usa el RUT `11.111.111-1` y la clave `123`.

En las tarjetas de crédito y prepago, la fecha de expiración puede ser cualquiera que no esté vencida.

## Crédito

| Marca | Número | CVV | Resultado |
|---|---|---|---|
| VISA | 4051 8856 0044 6623 | 123 | Aprobada |
| AMEX | 3700 0000 0002 032 | 1234 | Aprobada |
| MASTERCARD | 5186 0595 5959 0568 | 123 | Rechazada |

En MOL, una autorización con crédito se graba con el código 434 (tarjeta de crédito pago total), tanto en matrícula como en arancel.

## Débito Redcompra

La documentación no indica CVV para estas tarjetas.

| Número | Resultado |
|---|---|
| 4051 8842 3993 7763 | Aprobada |
| 4511 3466 6003 7060 | Aprobada |
| 5186 0085 4123 3829 | Rechazada |

En MOL, una autorización con débito se graba con el código 435 (Redcompra pago total), tanto en matrícula como en arancel.

## Prepago

| Marca | Número | CVV | Resultado |
|---|---|---|---|
| VISA | 4051 8860 0005 6590 | 123 | Aprobada |
| MASTERCARD | 5186 1741 1062 9480 | 123 | Rechazada |

Transbank informa el prepago como un medio distinto del crédito y del débito. En MOL se graba igual que el débito, con el código 435 (Redcompra pago total), tanto en matrícula como en arancel.

## Anular en el formulario

No hay una tarjeta para anular. En la pantalla de Webpay se cancela el pago antes de autorizar. MOL deja esa transacción en estado `abortada`.
