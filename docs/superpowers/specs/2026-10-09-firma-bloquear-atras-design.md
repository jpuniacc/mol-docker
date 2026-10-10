# Bloquear el regreso después de enviar el contrato a firmar

Fecha: 2026-10-09  
Proyecto: `mol-docker`  
Estado: aprobado

## Problema

Al pulsar **Enviar a firmar**, el botón **Anterior** de la pantalla queda deshabilitado. El atrás del navegador, y una URL directa a datos personales o a forma de pago, siguen abriendo esos pasos. La cuenta en U+ ya está grabada y el contrato ya puede estar en TuFirma. Un regreso permite cambiar el pago o disparar otro cargo, y un nuevo envío podría crear otro contrato.

## Decisión

Desde que se pulsa **Enviar a firmar**, el alumno se queda en la firma. El atrás del navegador, la URL de un paso anterior y un refresh no abren datos personales ni forma de pago.

El contrato ya enviado no se vuelve a crear. La cuenta grabada no se vuelve a escribir.

Antes de ese clic, el atrás sigue abriendo forma de pago.

## Cuándo se traba

El clic en **Enviar a firmar** guarda `envioFirmaIniciado` en el contexto del alumno, en la misma sesión que ya persiste el resto del flujo. La bandera se escribe al empezar el envío, antes de que responda TuFirma.

El botón **Anterior** lee esa bandera. Sigue deshabilitado después de refrescar, y también cuando ya hay firmantes.

Si el envío falla antes de que exista un documento, la bandera queda igual. El alumno reintenta desde la firma. Ese reintento crea el primer contrato, no un segundo.

## Pasos

Hay cuatro pasos en la barra: datos personales, forma de pago, firma y resumen.

Con `envioFirmaIniciado`, los pasos 1 y 2 quedan deshabilitados en la barra, igual que el botón **Anterior**. Un clic ahí no navega. El paso 3, la firma, sigue siendo el activo.

El paso 4, el resumen, sigue cerrado hasta que todos firman. Cuando `firmaCompletada` es verdadero, manda el guard que ya existe y el único paso abierto es el resumen.

**Salir** sigue llevando al inicio. No crea otro contrato. Al volver a entrar, el acceso los deja en la firma.

El retorno de Webpay sigue permitido. No es un paso de la barra.

## Guard

El `beforeEach` del flujo alumno, si `envioFirmaIniciado` está activo y el destino es datos personales o forma de pago, reemplaza la ruta por la de firma. Cubre el atrás del navegador y una URL directa, que la barra deshabilitada no alcanza.

No llama a `ensure`. No llama a grabar el plan. No borra el Webpay ni el número de operación.

Si `firmaCompletada` ya es verdadero, sigue ganando el guard actual: el destino es el resumen. El retorno de Webpay sigue permitido.

El atrás que caería en forma de pago, y el siguiente que caería en datos personales, se reemplazan por la firma. Si el alumno insiste, sale del asistente hacia el inicio. Desde ahí, el acceso que ya existe lo devuelve a la firma porque el pago ya está elegido.

## Contrato

El documento de TuFirma queda asociado al número de operación.

Al entrar a la firma, la pantalla consulta el estado de esa operación, como hoy. Esa consulta no crea un documento.

Si se vuelve a pulsar **Enviar a firmar** y ya hay una fila para ese número, `ensure` devuelve el mismo documento con `created: false`. No se envía otro PDF a TuFirma. Ese comportamiento ya existe y no se reemplaza.

## Fuera de alcance

- El flujo mock.
- Borrar la sesión del navegador. En ese caso U+ conserva la cuenta y TuFirma conserva el documento, pero el guard deja de ver la bandera.
- Cambiar el contenido del contrato o el momento en que se graba la cuenta.

## Pruebas

- Antes de enviar, el atrás abre forma de pago.
- Después de pulsar **Enviar a firmar**, la barra deshabilita datos personales y forma de pago. El atrás y la URL de esos pasos terminan en la firma.
- El resumen sigue cerrado hasta que la firma está completa.
- Ese regreso no llama a `ensure` ni a grabar el plan.
- Un segundo **Enviar a firmar** sobre una operación que ya tiene documento no crea otro.
- Con la firma completa, el destino sigue siendo el resumen.
