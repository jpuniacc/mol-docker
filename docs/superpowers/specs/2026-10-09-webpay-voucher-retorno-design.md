# Voucher al volver de Webpay

Fecha: 2026-10-09  
Proyecto: `mol-docker`  
Estado: aprobado en conversación, pendiente de revisión de este archivo  
Relacionado: `docs/superpowers/specs/2026-10-01-webpay-plus-design.md`, `docs/superpowers/specs/2026-10-07-webpay-forma-pago-cuenta-design.md`

## Problema

Al volver de Transbank, la pantalla de retorno dice que el pago quedó autorizado y sigue sola. Si el arancel también es Webpay, abre ese segundo pago sin que el alumno vea el resultado del primero. No hay un comprobante con la fecha, la autorización, el monto, el tipo de tarjeta ni los últimos dígitos, ni una forma de guardarlo.

## Alcance

Cada autorización de Webpay, de matrícula o de arancel, abre un modal en la pantalla de retorno que ya existe. El modal aparece antes de seguir. No hay un endpoint nuevo: usa la fila que esa pantalla ya consulta.

El selector de forma de pago no cambia. El resumen de felicitaciones tampoco. La cuenta en U+ tampoco.

Si un usuario del flujo mock cae en esta misma pantalla de retorno, ve el mismo modal. Volver lo lleva a la forma de pago mock, como hoy.

## Cuándo aparece

La pantalla lee el resultado y abre el modal. No sigue sola al otro pago ni al contrato.

El modal no se cierra con la X ni al tocar afuera. Solo avanza uno de sus botones.

**Aprobada.** Título: «Tu transacción fue aprobada». Botones: Descargar voucher y Continuar.

Continuar, si la matrícula acaba de aprobarse y el arancel también es Webpay y aún no está pagado, abre ese segundo pago. En cualquier otro caso sigue el avance que ya existe: el contrato si no queda pagaré, o la forma de pago si el otro concepto es pagaré.

**Rechazada.** Título: «Tu transacción fue rechazada». No hay descarga. El botón «Volver a forma de pago» deja el concepto sin pagar.

**Anulada.** Igual que la rechazada, con el título «Tu transacción fue anulada».

Si el resultado no se puede leer, o la transacción sigue creada, no hay modal. Queda la pantalla actual, con «Volver a forma de pago».

Refrescar la página de retorno vuelve a mostrar el modal de esa misma transacción. Continuar no cobra de nuevo: si el otro concepto ya está autorizado, sigue al contrato.

Si Continuar no logra abrir el siguiente pago, el modal permanece, se muestra el aviso que ya existe y aparece «Volver a forma de pago».

## Pantalla

El modal es usable en el teléfono, en la tablet y en el escritorio. Se revisa en 375, 768 y 1024 px de ancho.

En el teléfono ocupa el ancho de la ventana, con un margen chico a los lados. Desde la tablet queda centrado, con un ancho máximo que no se estira en una pantalla grande. Nunca aparece un scroll horizontal.

Si la ventana es baja, como un teléfono en horizontal, el título y los botones siguen visibles y las líneas del voucher se desplazan por dentro del modal.

Cada línea muestra la etiqueta y el valor. El valor puede pasar a la línea siguiente. Un código largo no se sale del cuadro.

En 375 px los botones van uno bajo el otro y ocupan el ancho del modal. Descargar queda arriba y Continuar abajo. Desde 768 px pueden ir en la misma fila, Continuar a la derecha. El botón de un rechazo o una anulación ocupa el ancho en el teléfono y se alinea a la derecha desde la tablet.

El PDF no imita el ancho de la pantalla. Es una hoja fija, la misma en el teléfono y en el escritorio.

## Contenido

Las líneas van en este orden:

| Línea | Origen |
| --- | --- |
| Concepto | Matrícula o Arancel, según la orden. |
| Fecha y hora | La de Transbank, en `America/Santiago`, como `dd-mm-aaaa hh:mm`. |
| Código de autorización | El código, sin espacios sobrantes. |
| Monto | El monto cobrado en esa orden, con separador de miles y sin decimales. En el arancel ya viene con el 5 % descontado. |
| Tipo de tarjeta | Débito o Crédito. |
| Tarjeta | Los últimos 4 dígitos, como `•••• 7763`. |
| Cuotas | Solo en crédito. |

`VD` es débito. `VP` (prepago) se muestra como Débito, igual que en la cuenta. `VN`, `VC`, `SI`, `S2` y `NC` son crédito.

En débito, y en prepago, la línea de cuotas no aparece. En crédito, si las cuotas vienen vacías o son menores que 2, la línea dice «1 cuota». Si son 2 o más, dice el número: «6 cuotas».

Si un dato no vino, la línea queda en «—». En un rechazo o una anulación puede faltar la autorización, la fecha o los dígitos. El monto y el concepto sí se muestran, porque son los de la orden enviada.

Si el tipo de tarjeta no es uno de los códigos de arriba, el tipo y las cuotas se muestran como «—». En ese caso la línea de cuotas sí aparece. El resto del voucher también.

## PDF

Solo la transacción aprobada se puede descargar. El PDF se arma en el navegador con jsPDF, que el proyecto ya tiene. No pasa por la API. Lleva el mismo título, el concepto y las mismas líneas del modal, en la misma hora.

El archivo se llama `voucher-matricula-1415.pdf` o `voucher-arancel-1819.pdf`, con el código de autorización. Si ese código no vino, se usa la orden de compra.

Descargar no cierra el modal ni avanza el flujo. Si el PDF no se puede generar, el modal permanece y se muestra un aviso. La persona puede continuar igual.

## Piezas

Una función pura arma el voucher a partir de la fila pública. Devuelve el título, si se puede descargar, el nombre del archivo y las líneas ya resueltas. El modal y el PDF leen ese resultado. No conocen el router.

La pantalla de retorno solo decide cuándo mostrar el modal y qué función existente llama cada botón. Continuar, en una aprobación, llama al avance actual. Volver, en un rechazo o una anulación, vuelve a forma de pago como hoy.

## Pruebas

La función del voucher se prueba sola, sin pantalla ni Transbank:

- Débito aprobado: concepto, fecha en hora de Chile, autorización, monto, tipo Débito, últimos 4 dígitos, y sin línea de cuotas. El prepago cae en este caso.
- Crédito de una cuota: tipo Crédito y la línea «1 cuota».
- Crédito de varias: «6 cuotas».
- Rechazo y anulación: el título correspondiente, sin descarga, y «—» donde falte la autorización, la fecha o los dígitos.
- Tipo de tarjeta desconocido: tipo y cuotas en «—», y el resto del voucher sí.
- El nombre del archivo: `voucher-matricula-1415.pdf` o `voucher-arancel-1819.pdf`.

El modal no se abre si el resultado no se pudo leer o la transacción sigue creada. El avance al siguiente pago y la vuelta a forma de pago no se reescriben. No se prueba un cobro real.

El ajuste a 375, 768 y 1024 px se revisa en el navegador. No lo cubre la prueba de la función.

## Fuera de alcance

- Mostrar Visa, Mastercard o Amex. Transbank no envía la marca. El voucher muestra los últimos 4 dígitos.
- Un voucher único al final, con las dos transacciones juntas.
- Cambiar el resumen de felicitaciones, el selector de forma de pago o la cuenta en U+.
- Elegir las cuotas dentro de MOL.
