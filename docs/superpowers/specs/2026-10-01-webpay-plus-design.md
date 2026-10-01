# Webpay Plus en la matrícula del alumno

Fecha: 2026-10-01  
Proyecto: `mol-docker` + `uniacc-api-docker`  
Estado: aprobado. Plan: [`docs/superpowers/plans/2026-10-01-webpay-plus.md`](../plans/2026-10-01-webpay-plus.md)  
Referencia de flujo: [`docs/webpay-plus-flujo.md`](../../webpay-plus-flujo.md)  
Fuente Transbank: [Referencia API Webpay Plus](https://www.transbankdevelopers.cl/referencia/webpay#webpay-plus_1) y [documentación Webpay Plus](https://www.transbankdevelopers.cl/documentacion/webpay-plus).

## Problema

En la matrícula del alumno, WebPay no cobra. El diálogo real solo ofrece pagaré para matrícula y arancel. Las tarjetas WebPay, Pagaré y TOKU de más abajo simulan el pago y saltan a la firma. No hay cliente de Transbank en MOL ni en `uniacc-api`.

## Decisiones

| Tema | Decisión |
| --- | --- |
| Producto | Webpay Plus. Una transacción normal por cobro. |
| Qué se cobra | Matrícula y arancel por separado. Cada uno puede ser Webpay o pagaré. |
| Una transacción por concepto | Si ambos van por Webpay, Transbank recibe dos transacciones. |
| Orden | Si hay Webpay, ese cobro va primero. Con los dos en Webpay, la matrícula va antes que el arancel. El plan de pagaré se arma después de que ese Webpay quedó autorizado. Los dos en pagaré siguen el flujo actual. |
| `buy_order` | `{codcli}{anio}-{periodo}-{correlativo}`. Ejemplo: `123456782027-1-15`. El correlativo lo asigna MOL al crear la fila. No usa el peek de `CORRPAGNUM`. |
| Firma | Se habilita cuando cada concepto Webpay está `autorizada` y cada concepto pagaré tiene su plan confirmado, como hoy. |
| Arancel abortado o rechazado | La matrícula `autorizada` se conserva. El reintento del arancel crea otra orden. |
| Persistencia | Tabla `mnp_webpay_transaccion` en Supabase. El ERP no se escribe en este paso. |
| Dónde vive la llamada | `uniacc-api`, bajo `/api/rematricula/alumno/webpay`. El navegador no llama a Transbank. |
| Ambiente | Integración, `https://webpay3gint.transbank.cl`, con tarjetas de prueba. |
| Producción | Código de comercio `597053102249` en variable de entorno del API. No se usa mientras el ambiente sea integración. Host: `https://webpay3g.transbank.cl`. |

Las credenciales (código de comercio y llave) viven solo en el entorno de `uniacc-api`. En integración se usan las credenciales públicas de Transbank. El código `597055555532` y su llave no se copian al frontend ni a este spec.

## Fuera de alcance

- Grabar el pago en el ERP (`mnp_mt_ctapag` y el resto del cierre de matrícula).
- Anular o reversar desde el flujo del alumno. La operación existe en Transbank y no se implementa ahora.
- Captura diferida.
- Webpay Plus Mall.
- La pantalla mock de WebPay, Pagaré y TOKU. El medio se elige en el diálogo real de forma de pago.
- Recalcular en el servidor becas, convenios o descuentos. El monto es el neto que la pantalla ya muestra.

## Piezas

1. **Cliente Transbank en `uniacc-api`.** Crea, confirma y consulta estado. Headers `Tbk-Api-Key-Id` y `Tbk-Api-Key-Secret`. TLS 1.2.
2. **Tabla `mnp_webpay_transaccion`.** Solo la escribe el API, por su conexión a Postgres. El rol `anon` no lee ni inserta.
3. **Rutas** `POST /api/rematricula/alumno/webpay/crear` y `POST /api/rematricula/alumno/webpay/retorno`.
4. **MOL.** El diálogo real ofrece Webpay o pagaré en matrícula y en arancel. Webpay pide crear, redirige con un formulario `POST` (`token_ws`) y, al volver, pide el retorno.

## Monto

Crear recibe el neto del concepto, en pesos enteros, mayor que cero. El API lo guarda y se lo envía a Transbank. Confirmar acepta la autorización solo si Transbank devuelve ese mismo monto, `status` `AUTHORIZED` y `response_code` `0`. `vci` se guarda si viene y no decide el resultado.

## Orden de compra

`codcli` es el RUT sin dígito verificador, solo dígitos. `anio` tiene 4 dígitos. `periodo` es `1` o `2`.

El `correlativo` sale de una secuencia de Postgres al insertar la fila. Es único en la tabla. Dos intentos no comparten orden. Con un `codcli` de 8 dígitos la orden mide 17 caracteres en el ejemplo `123456782027-1-15` y sigue bajo el máximo de 26 mientras el correlativo tenga hasta 11 dígitos.

`session_id` es `{codcli}-{anio}-{periodo}-{concepto}-{correlativo}`. Ejemplo: `12345678-2027-1-matricula-15`. Cabe en 61. Transbank lo devuelve igual.

Al crear un intento nuevo del mismo `codcli`, periodo y concepto, la fila anterior que siga en `creada` pasa a `abortada` antes de llamar a Transbank. Esa fila no se anuló en Transbank: el alumno no llegó a pagar. La fila nueva se inserta en `creada` con la orden y el monto, y después se llama a Transbank. Si Transbank rechaza el create, esa fila pasa a `abortada` y el API informa el error. Si ya existe una fila `autorizada` de ese concepto y periodo, crear responde error y no abre otro cobro.

## Tabla

| Columna | Qué guarda |
| --- | --- |
| `buy_order` | Orden única. |
| `session_id` | Identificador interno. |
| `concepto` | `matricula` o `arancel`. |
| `codcli`, `anio_periodo`, `semestre_periodo` | Alumno y periodo. |
| `correlativo` | Entero de la secuencia. |
| `monto` | Neto enviado a Transbank. |
| `token` | Token de crear. |
| `estado` | `creada`, `autorizada`, `rechazada` o `abortada`. |
| `authorization_code`, `response_code`, `payment_type_code`, `card_last4`, `transaction_date` | Respuesta de confirmar, cuando existe. |
| `ambiente` | `integracion` en esta entrega. |

## Operaciones Transbank

| Acción MOL | HTTP Transbank |
| --- | --- |
| Crear | `POST /rswebpaytransaction/api/webpay/v1.2/transactions` |
| Confirmar | `PUT /rswebpaytransaction/api/webpay/v1.2/transactions/{token}` |
| Estado | `GET /rswebpaytransaction/api/webpay/v1.2/transactions/{token}` |

Crear responde `token` y `url`. La fila queda `creada`. MOL redirige al `url` con `token_ws`.

Confirmar solo corre cuando el regreso trae únicamente `token_ws`. El token va en la URL de Transbank, no en el body.

Estado se usa cuando el regreso es ambiguo, cuando no hay `token_ws`, o cuando confirmar responde que la transacción ya fue confirmada. No reemplaza a confirmar en el flujo normal.

## Regreso

Ruta de Vue: nombre `matricula-alumno-webpay-retorno`, path `/dashboard/matricula-alumno/webpay/retorno`. Acepta `GET` y `POST`. No habla con Transbank. Llama a `POST /api/rematricula/alumno/webpay/retorno`.

El login está en `sessionStorage` y el redirect a Webpay es en la misma pestaña. Si al volver no hay sesión, MOL guarda `token_ws` o los `TBK_*` y manda al login. Al entrar, retoma el retorno.

| Qué llegó | Qué hace el API | Qué ve el alumno |
| --- | --- | --- |
| Solo `token_ws`, y confirmar cumple monto, `AUTHORIZED` y `response_code` `0` | Fila `autorizada` | El concepto quedó pagado y MOL sigue al paso siguiente sin volver a pedir el medio |
| Solo `token_ws`, y confirmar no cumple eso | Fila `rechazada` | El pago no se completó. Puede reintentar ese concepto. El paso siguiente no se arma |
| Solo `TBK_ID_SESION` y `TBK_ORDEN_COMPRA` | Fila `abortada`. No confirma | El mismo reintento |
| `TBK_TOKEN`, `TBK_ID_SESION`, `TBK_ORDEN_COMPRA` | Consulta estado con `TBK_TOKEN`. No confirma. Fila `abortada` | El mismo reintento |
| `token_ws` junto con `TBK_TOKEN`, `TBK_ID_SESION` y `TBK_ORDEN_COMPRA` | Consulta estado y no confirma. Si el estado es `AUTHORIZED`, `response_code` `0` y el monto coincide, fila `autorizada`. Si no, fila `abortada` | Si quedó `autorizada`, sigue al paso siguiente. Si no, ofrece reintentar |

`TBK_ORDEN_COMPRA` es el `buy_order`. `TBK_ID_SESION` es el `session_id`.

Si la fila ya está `autorizada`, `rechazada` o `abortada`, el retorno muestra ese resultado y no vuelve a confirmar.

## Secuencia

1. **Matrícula pagaré y arancel pagaré.** Flujo actual. Sin filas de Webpay.
2. **Matrícula Webpay y arancel pagaré.** Webpay de la matrícula. Si queda `autorizada`, el plan de pagos del arancel.
3. **Matrícula pagaré y arancel Webpay.** Webpay del arancel. Si queda `autorizada`, el plan de pagos de la matrícula.
4. **Matrícula Webpay y arancel Webpay.** Webpay de la matrícula. Si queda `autorizada`, Webpay del arancel. La firma espera las dos filas `autorizada`.

El plan de pagos incluye solo el concepto que quedó en pagaré. Si el primer Webpay no queda `autorizada`, el paso siguiente no se arma.

## Pruebas

1. **`uniacc-api`, sin red.** El `buy_order` no pasa de 26 caracteres. Confirmar rechaza un monto distinto al guardado. Timeout y anulación no llaman a confirmar. Una recarga no confirma dos veces. Un segundo intento del mismo concepto deja la fila `creada` anterior en `abortada`. Crear con una fila ya `autorizada` del mismo concepto y periodo no abre otro cobro.
2. **Integración de Transbank, a mano, con tarjetas de prueba.** Un pago autorizado, un rechazo y una anulación en el formulario. No corre en CI.
3. **MOL.** Una función elige el paso siguiente para las cuatro combinaciones, sin entrar a Transbank.
