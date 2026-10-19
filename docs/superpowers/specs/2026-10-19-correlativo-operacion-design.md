# Correlativo de operación al entrar a la forma de pago

Fecha: 2026-10-19  
Proyecto: `mol-docker` y `uniacc-api-docker`  
Estado: spec aprobado, pendiente de implementación

## Problema

MOL lee `MT_PARAME_DET` (`CORRELATIVO`), le suma uno y no lo escribe. Varios alumnos que entran juntos ven el mismo número. Webpay necesita ese número antes de salir a Transbank. Si TuFirma falla, pedir otro correlativo esconde la causa y quema números.

## Decisión

Al entrar a la forma de pago, MOL escribe el correlativo de U+ y ese valor queda como el número de operación del alumno. Es el mismo número que después usan Webpay, el pagaré, la firma y la cuenta.

El procedimiento `sp_mol_grabar_plan_pagos` recibe ese número y graba la cuenta con él. El correlativo de U+ permanece en el valor que ya tenía.

## Cuándo se pide

La petición ocurre al montar la forma de pago del alumno, antes de mostrar los medios.

Mientras la API responde, la pantalla muestra:

«Estamos procesando tu operación para continuar con el pago»

Los medios aparecen cuando el número ya está guardado.

## Identidad del número

La identidad es RUT + código de cliente + período activo (`anio` y `semestre`).

Si ese alumno ya tiene número para el período, la API lo devuelve y no escribe en U+.

El RUT se compara sin puntos, recortado y en mayúsculas, conservando el guion del dígito verificador. El código de cliente se compara recortado.

## Cómo se escribe

El número sale del mismo SQL Server donde después se graba el plan de pagos.

Orden de una petición nueva:

1. MOL inserta una reserva del alumno. La unicidad es RUT + código de cliente + período. Si dos pestañas llegan juntas, una sola gana la reserva.
2. La ganadora ejecuta un solo `UPDATE` sobre la fila vigente de `CORRELATIVO`: la de mayor `NumLinea` cuya fecha cubre hoy. Hace `Valor = Valor + 1` y se queda con el valor nuevo (`OUTPUT`). SQL Server bloquea esa fila hasta el `COMMIT`. Los demás alumnos esperan ahí, aunque vengan de otro proceso de la API.
3. MOL guarda ese valor en la reserva y responde.

El lock dura solo ese `UPDATE`. TuFirma no se llama con la fila tomada.

La otra pestaña no ejecuta otro `UPDATE`. Lee la reserva. Si el número ya está, lo devuelve. Si la primera petición murió antes de escribir en U+, la reserva sigue vacía y un reintento del mismo alumno hace el único `UPDATE`.

La tabla de MOL es `mnp.rematricula_operacion`, distinta del documento de TuFirma, porque Webpay necesita el número antes de que exista el contrato. Guarda RUT, código de cliente, año, semestre y número de operación. El número es único. La identidad del alumno y el período también.

## Después de obtenerlo

**Webpay.** Matrícula y arancel siguen siendo dos cobros. Cada uno conserva su buy order de Transbank. Al crear el cobro, la fila de `mnp_webpay_transaccion` copia el número de operación ya guardado. Si ese número no existe, la API rechaza el cobro y no sale a Transbank.

**Pagaré.** Al confirmar el plan, el número que viaja a la firma es el de `rematricula_operacion`. El peek de `MT_PARAME_DET` deja de ser la fuente.

**Firma.** TuFirma usa ese número. Si el documento queda en `render_status: FAILED` o el enlace viene vacío, se muestra el modal «El enlace se quedó en el sobre». El reintento vuelve a pedir el enlace de ese mismo documento. No se pide otro número de operación. El parámetro que hoy pide otro correlativo cuando la firma está en error deja de hacerlo.

**Grabado.** `sp_mol_grabar_plan_pagos` recibe el número y lo deja en la cuenta. No ejecuta otro `Valor + 1`.

Si el alumno cierra y vuelve, ve el mismo número.

## Número de otro alumno

Si la sesión trae un número de otra persona, se cambia en silencio. La pantalla sigue en «Estamos procesando tu operación para continuar con el pago». No aparece el aviso de número asociado a otro alumno.

El cambio ocurre solo cuando se cumplen las cuatro condiciones:

1. El número de la sesión tiene un dueño guardado.
2. Ese dueño tiene RUT y código de cliente, los dos con valor.
3. El RUT normalizado o el código de cliente no coinciden con el alumno que está en la forma de pago.
4. Ese alumno no tiene ya un número propio para el período. Si lo tiene, se usa ese y no se escribe otro.

El número se conserva cuando:

- RUT y código de cliente coinciden.
- TuFirma respondió `render_status: FAILED` o dejó el enlace vacío.

Si al registro viejo le falta el RUT o el código de cliente, no se consume otro correlativo por esa vía. La forma de pago permanece en el mensaje de proceso y no abre los medios.

## Otros fallos

Si U+ no alcanza a escribir, no queda número. El alumno puede reintentar desde la misma pantalla.

Si U+ escribió y MOL no alcanzó a guardar el valor, ese número queda usado. El reintento escribe el siguiente para el mismo alumno.

## Alcance

Incluye:

- Reserva y escritura del correlativo al entrar a la forma de pago
- El mensaje de espera acordado
- Guardar el número en los cobros Webpay, en el pagaré, en la firma y en el grabado
- El cambio silencioso cuando el número es de otro alumno, con las cuatro condiciones
- El procedimiento de grabado usa el número ya escrito

No incluye:

- Corregir por qué TuFirma deja documentos en `render_status: FAILED`
- Cambiar el formato del buy order de Transbank
- Devolver a U+ un número ya escrito

## Prueba

1. Treinta peticiones de alumnos distintos, al mismo tiempo, reciben treinta números seguidos. `MT_PARAME_DET` sube en treinta.
2. El mismo alumno, al entrar otra vez, recibe su número. U+ no se mueve.
3. Dos pestañas del mismo alumno dejan un solo número.
4. Webpay de matrícula y Webpay de arancel guardan ese número y tienen buy orders distintos. Sin número guardado, el cobro se rechaza.
5. Pagaré, firma y grabado usan ese número. El procedimiento no vuelve a incrementar el correlativo.
6. Con TuFirma en `render_status: FAILED`, el reintento sigue en el mismo documento y en el mismo número.
7. Un número de sesión con RUT y código de cliente, si alguno no coincide, entrega otro número y no muestra el error de otro alumno.
8. Un registro viejo sin RUT o sin código de cliente no consume otro correlativo. Los medios no se abren.
