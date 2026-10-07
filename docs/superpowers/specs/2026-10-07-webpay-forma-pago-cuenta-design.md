# Webpay en forma de pago, contrato y cuenta corriente

Fecha: 2026-10-07  
Proyecto: `mol-docker` + `uniacc-api-docker`  
Estado: aprobado en conversación, pendiente de revisión de este archivo  
Relacionado: `docs/pago webpay.md`, `docs/pago-credito-15776837.md`, `docs/superpowers/specs/2026-10-01-webpay-plus-design.md`

## Problema

El diálogo de forma de pago deja elegir matrícula y arancel al mismo tiempo. Webpay no avisa que el alumno va a salir de MOL, y al volver el arancel ya tenía que estar elegido. La firma todavía no arma el contrato ni la cuenta corriente según el medio de cada concepto. En producción, el arancel pagado con Webpay lleva un 5 % por forma de pago, y el crédito en cuotas deja un calendario con folios distintos del pago que salda la boleta.

## Alcance

Rematrícula del alumno. El mock de forma de pago no cambia.

La grabación en U+ ocurre al firmar, en una sola transacción, junto con la boleta, los beneficios y el pagaré de los conceptos que correspondan. Si una fila falla, no queda nada escrito.

Cada intento deja una fila en Supabase, en `log_mol_intento`, fuera de la transacción de U+. Si U+ revierte las filas, el intento sigue visible. Un `console.log` no alcanza.

La tabla es genérica, para este guardado y para los temas que vengan después. El API solo inserta ahí. No llama a `registrar_log_mol_evento`. Un trigger `AFTER INSERT` copia la fila a `log_mol_evento`, con `origen_tabla = 'log_mol_intento'` y `origen_id` igual al id del intento. Si esa copia falla, la fila del intento permanece.

| Columna | Uso |
| --- | --- |
| `tema` | Asunto. En este guardado es `cuenta`. |
| `accion` | Qué se intentó. En este guardado es `grabar`. |
| `resultado` | `ok` o `error`. |
| `mensaje` | Texto del error, vacío cuando salió bien. |
| `payload` | Detalle del tema. Aquí: número de operación si ya existe, medio de matrícula y medio de arancel. |
| RUT, código académico, año y período | Para encontrar el intento del alumno. |

No se guarda el número de tarjeta ni la llave de Transbank. Si el insert del intento falla, la grabación de U+ no se deshace por eso: ese fallo queda en el log del API.

## Diálogo de forma de pago

Al abrir, matrícula está habilitada y arancel está apagado. Un botón apagado se ve con menos opacidad y un cursor que no invita a pulsar. El total a financiar sigue visible.

Si la matrícula queda en pagaré, se encienden Pagaré y Webpay del arancel. Si los dos quedan en pagaré, Continuar abre el plan de cuotas, como hoy.

Si el alumno toca Webpay, en matrícula o en arancel, el mismo diálogo reemplaza las opciones por este aviso: «Vas a salir de MOL hacia el sitio seguro de Webpay. Al terminar, volverás a la rematrícula.» Se ve un contador de 3 segundos y Cancelar. Cancelar y la X detienen el contador y devuelven las opciones. A los 3 segundos la misma pestaña va a Webpay. El aviso no habla de ventanas emergentes.

Al volver:

| Resultado | Qué se abre | Elección que queda |
| --- | --- | --- |
| Matrícula autorizada | El mismo diálogo | Matrícula pagada y apagada. Arancel habilitado, sin elección previa. |
| Matrícula abortada | El mismo diálogo | Aviso: «El pago con Webpay se canceló. Debes seleccionar la opción de pago.» Matrícula otra vez elegible. Arancel apagado. |
| Matrícula rechazada | El mismo diálogo | Aviso: «El pago con Webpay fue rechazado. Debes seleccionar la opción de pago.» Matrícula otra vez elegible. Arancel apagado. |
| Arancel abortado o rechazado | El mismo diálogo | La matrícula se conserva, pagada o en pagaré. El aviso corresponde al resultado y pide elegir de nuevo solo el arancel. |

Después de un arancel autorizado, si la matrícula está en pagaré, se abre el plan de cuotas solo de la matrícula. Si la matrícula ya se pagó con Webpay y el arancel queda en pagaré, Continuar abre el plan solo del arancel. Si los dos quedaron autorizados en Webpay, se sigue a la firma.

Si crear el pago falla antes de salir, la pestaña no se va. Vuelven las opciones y un aviso breve indica el error. Si el regreso no trae un resultado legible, se mantiene la pantalla de resultado que ya existe, con reintento.

## Datos que Webpay tiene que dejar guardados

No se abre otra tabla. Cada cobro sigue en `mnp_webpay_transaccion`, una fila por orden. Esa fila ya guarda el monto, el estado, el código de autorización, la fecha, el tipo de tarjeta y los últimos 4 dígitos.

Al confirmar se agregan dos columnas:

| Columna | Qué guarda |
| --- | --- |
| `installments_number` | Las cuotas que informa Transbank. Cero o uno es crédito de una cuota. Dos o más arman el calendario. |
| `respuesta` | El JSON completo de la confirmación. Conserva `vci`, `accounting_date` y lo que Transbank agregue después. |

El token ya está en la fila. No se guarda la llave del API ni el número completo de la tarjeta.

Si al firmar falta el código de autorización, la fecha o el tipo de tarjeta, no se graba la cuenta y la firma no sigue. Ese rechazo también inserta un `log_mol_intento` con tema `cuenta`, acción `grabar` y resultado `error`, antes de abrir la transacción de U+.

Débito y prepago usan el camino de una sola fila. Crédito sin cuotas informadas, o con cero o una cuota, usa el camino de una cuota. Crédito con dos o más cuotas agrega el calendario.

## Contrato

Los valores de matrícula y arancel son el bruto. El mandato para llenar un pagaré entra solo si al menos un concepto quedó en pagaré.

| Caso | Matrícula | Arancel |
| --- | --- | --- |
| Los dos en pagaré | Beneficios, saldo en pagaré y plan de cuotas | Igual |
| Matrícula pagaré, arancel Webpay | Beneficios, saldo en pagaré y plan de cuotas | Beneficios, el 5 % por forma de pago y el saldo como «Pagado con Webpay» |
| Matrícula Webpay, arancel pagaré | Beneficios y «Pagado con Webpay» | Beneficios, saldo en pagaré y plan de cuotas |
| Los dos en Webpay | Beneficios y «Pagado con Webpay» | Beneficios, el 5 % por forma de pago y «Pagado con Webpay» |

El calendario 440 no se lista como plan de cuotas del alumno. Hoy el contrato solo se arma si hay un plan de pagaré. El caso de los dos conceptos en Webpay tiene que producir contrato igual.

## Cuenta corriente

La boleta 41 lleva siempre los dos ítems por el bruto. Cada beca, convenio o descuento interno va a `MT_POSBEN` y a un pago con el tipo de `MT_BENEFICIO`, aplicado a su ítem. El CAE no baja el saldo que paga el alumno.

El apoderado, la sede y la caja de estas filas siguen la regla ya usada en el plan de pagos.

### Pagaré

El saldo del concepto, después de sus beneficios, va a un pago tipo 5 y a sus cuotas tipo 14, aplicados a la boleta. No lleva 434, 435, 809, 810 ni 811.

### 5 % por Webpay en el arancel

Solo el arancel pagado con Webpay, sea débito, prepago o crédito. La matrícula no lo lleva.

Se calcula sobre el arancel bruto menos becas, convenios y descuentos internos de ese ítem. El CAE no entra en esa resta. El 5 % se redondea al peso. Webpay paga el saldo menos ese descuento, de modo que boleta = beneficios + descuento 20 + pago con tarjeta.

Se graba como pago tipo 20, «DESCUENTO POR FORMA DE PAGO», saldo 0 y estado 1, aplicado a la boleta del arancel. No tiene fila en `MT_POSBEN`. En producción está así en Felipe Aranda, RUT 15776837-9, operación 918341 (crédito, 133.350 sobre el saldo de 2.667.000) y en Catalina González Meneses, RUT 21349347, operación 914813 (débito, 132.000 sobre el saldo de 2.640.000).

### Débito o prepago

Un pago 435 por el monto de la tarjeta, aplicado a la boleta, con la fecha de la transacción. El folio es el código de autorización más 01. En la misma firma va un cargo 810 por ese mismo monto, con el mismo folio y la misma fecha.

### Crédito de una cuota

Un pago 434 por el monto de la tarjeta, aplicado a la boleta. El folio es el código de autorización más 01. La fecha es la de la transacción. Al lado, un cargo 809, «tarjeta de crédito total por conciliar», cuota 1 de 1, con ese folio y esa fecha.

### Crédito de varias cuotas

La boleta se salda con un solo 434 por el monto de la tarjeta. El folio de ese 434 es el código de autorización más 01. El 440 de la cuota 1 usa ese mismo folio. Se distinguen por el tipo de documento, como el 434 y el 440 `4882501` de Felipe Aranda.

El calendario no se aplica a la boleta. Por cada cuota hay un pago 440 y un cargo 811, «tarjeta de crédito múltiple por conciliar». El folio es la autorización más 01, 02, y así hasta la última. La fecha de registro de todas las filas es la de la transacción. El vencimiento de la primera cuota es ese día. El de las siguientes es el mismo día del mes siguiente. Si el mes no tiene ese día, vence el último día del mes. El monto de la tarjeta se reparte en partes iguales y la última cuota absorbe el resto. La suma de los 440 es el 434. Cada concepto usa su propia autorización.

En producción, Felipe Aranda tiene este calendario en la operación 919758: folios 4882501 a 4882510, registrados el 4 de diciembre de 2025, con vencimientos el día 4 de cada mes. Esos 440 se aplican a los cargos por conciliar, no a la boleta. MOL los graba en la misma firma, no en una operación posterior.

## Fuera de alcance

- Elegir las cuotas del crédito dentro de MOL. Las informa Webpay.
- El documento por conciliar de caja en una operación de días después. MOL lo escribe al firmar.
- Cambiar operaciones ya grabadas.
- El flujo mock.
