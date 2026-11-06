Para nuevas pruebas usar https://mol.uniacc.cl/webpay-qa (sin login).

# Tokens Webpay Plus — validación Transbank (integración)

Generados desde `https://mol.uniacc.cl` el 2026-10-18.
Retorno: `https://mol.uniacc.cl/api/rematricula/alumno/webpay/volver`.
Vigencia del token: 7 días desde la creación.

| Caso del formulario Transbank | Estado | Orden | Monto | Token |
|---|---|---|---:|---|
| Transacción aprobada crédito | autorizada (AUTHORIZED VN cuotas=0) | MOL1810CR01 | $1.500 | `01ab55f0fbf8f9b2e539a56af8ca3595bcd44197f95aa91e7c8de74022f03fa4` |
| Transacción aprobada con cuotas | AUTHORIZED (AUTHORIZED SI cuotas=3) | MOL1810CU02 | $30.000 | `01abf48206db22f2da49d5f8d555290c6a0a113edd7335d12a45aa58b6af8434` |
| Transacción aprobada débito | AUTHORIZED (AUTHORIZED VD cuotas=0) | MOL1810DB01 | $1.600 | `01ab4afdb0215eefb272be559d7c45c90c8655847a423c1377a761829205c5b5` |
| Transacción rechazada crédito | FAILED (FAILED VN cuotas=0) | MOL1810CR02 | $1.700 | `01ab57d7e0482cd9cb38015799df9d56e2e5d50b487d6070582c9038f36c051f` |
| Transacción rechazada débito | FAILED (FAILED VD cuotas=0) | MOL1810DB02 | $1.800 | `01abd41aa0c2a7be977c06209185c1c58bbb7726c74bb6f6e6a00dcd060d056b` |
| Transacción anulada desde formulario | anulada_formulario | MOL1810AN01 | $1.900 | `01ab63e78a622625a291ba1c52f112519ec1e8ff83863b53729193da70de5a6d` |
| Transacción reembolsada monto parcial | reembolsada_parcial (AUTHORIZED VN cuotas=None) refund=NULLIFIED | MOL1810RP01 | $10.000 | `01ab07e44e7b77f5997b1f987ae78e2e796741a0f8c12c7559118ec5a92855d9` |
| Transacción reembolsada monto total | reembolsada_total (AUTHORIZED VN cuotas=None) refund=REVERSED | MOL1810RT01 | $8.000 | `01aba03bbb7fd25e45e85b32b2b1a18c92f22e2ac86b748b90f60ed45d9fd2c5` |
| Transacción timeout desde formulario | creada | MOL1810TO01 | $2.100 | `01ab36766034da0f61c736577e8b1a31d4cdb6216543c80707725fbeb5acc52d` |

## Timeout pendiente

Abrir https://mol.uniacc.cl/webpay-qa-forms/timeout.html y dejar el formulario **sin pagar** al menos 10 minutos.
El token a ingresar en Transbank es el de creación de la fila timeout.

## Tarjetas usadas

- Crédito aprobado / cuotas / reembolsos: VISA `4051 8856 0044 6623` CVV 123
- Débito aprobado: Redcompra `4051 8842 3993 7763`
- Crédito rechazado: MASTERCARD `5186 0595 5959 0568` CVV 123
- Débito rechazado: Redcompra `5186 0085 4123 3829`
- Auth banco: RUT `11.111.111-1` clave `123`
