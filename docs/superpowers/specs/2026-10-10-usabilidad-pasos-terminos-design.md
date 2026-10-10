# Pasos, términos, resumen y cabecera

Fecha: 2026-10-10  
Proyecto: `mol-docker`  
Estado: aprobado

## Problema

En las pruebas de usabilidad, 4 de 5 leyeron los círculos del stepper como radios. El texto de términos ocupa hasta 28 rem y deja «Acepto» debajo del pliegue. La pantalla final abre abajo, en «Descargar el contrato», porque el scroll del paso anterior se conserva. La cabecera fija se achica al pasar de 24 px y vuelve a crecer, y eso la hace parpadear.

## Decisión

Solo el flujo del alumno. El mock no se edita.

El stepper sigue llevando a un paso ya abierto. Un paso cerrado no navega: un aviso dice en qué paso está el alumno y que el pulsado no está abierto. El dibujo deja de ser un círculo.

Los términos se leen en un acordeón cerrado. «Acepto» se ve al entrar y se habilita cuando el documento está disponible. Abrirlo no es requisito.

Al entrar a Resumen, la página vuelve arriba. La cabecera queda en un solo tamaño.

## Pasos

Archivo: `src/views/matricula-alumno/MatriculaAlumnoLayout.vue`.

`StepperIndicator.vue` no se modifica. También lo usan el mock y la línea de tiempo de postulación.

Cada paso muestra el número y el nombre en la misma línea, sin círculo relleno. El paso actual usa `text-uniacc-orange` y `font-semibold` en el número y en el nombre. Un paso ya abierto se lee en el color de texto normal. Un paso cerrado lleva la clase `opacity-40`. Esa opacidad la pone el layout: hoy sale de `data-[disabled]`, y ese atributo se quita.

Los nombres siguen siendo: Datos personales, Forma de pago, Firma de contrato, Resumen final.

La regla de qué está cerrado no cambia. Sigue en `pasoBloqueado` y en `pasoBloqueadoTrasEnvio`: un paso más allá del máximo alcanzado, los pasos 1 y 2 después de enviar a firmar, y los pasos 1 a 3 cuando la firma ya está completa.

El ítem cerrado no lleva `disabled`. Un botón deshabilitado no recibe el clic, y el aviso no podría abrirse. El setter de `stepModel` hace tres cosas. Si el paso está cerrado, no navega y abre el aviso. Si es el paso en el que ya se está, no navega y no abre el aviso. Si ya está abierto, navega como ahora, sin aviso. El clic y Enter o Espacio pasan por ese setter.

El aviso es un `AlertDialog`, el mismo tipo que el de deuda en forma de pago. Un solo botón.

- Título: «Paso no disponible».
- Texto: «Estás en {paso actual}. {Paso pulsado} no está abierto.»
- Botón: «Entendido».

No se usa «todavía». Después de enviar a firmar, los pasos 1 y 2 se cierran aunque ya se hayan recorrido.

«Entendido» cierra el aviso. El alumno se queda en el paso actual.

## Términos

Archivo: `src/views/matricula-alumno/MatriculaAlumnoTyCStep.vue`.

El bloque con `max-h-[min(28rem,60vh)]` y scroll interno sale. En su lugar, el acordeón de `src/components/ui/accordion/` arranca cerrado. El disparador dice «Leer términos y condiciones». Al abrirlo se ve el mismo `RichTextContent` de hoy.

«No acepto» y «Acepto términos y condiciones» quedan debajo del disparador, con `AccionesFlujo` y el mismo orden de ahora. `puedeAceptar` no cambia: el documento está disponible, no está cargando y no se está registrando. Con el acordeón cerrado, «Acepto» se puede pulsar.

Si el documento no está disponible, se mantiene el aviso de error. El acordeón no se muestra y «Acepto» sigue deshabilitado. Mientras carga, se mantiene el texto «Cargando términos y condiciones…».

## Resumen

Archivo: `src/views/matricula-alumno/ResumenAlumnoView.vue`.

Al mostrarse la vista, `window.scrollTo({ top: 0, left: 0, behavior: 'auto' })`. El salto es inmediato, sin animación desde abajo. Lo primero que se ve es «¡Felicitaciones!». «Descargar el contrato» sigue después del resumen. Los otros pasos no cambian su scroll.

## Cabecera

Mismo layout del alumno.

Se quitan `yScroll`, `isCompactHeader`, `actualizarScrollHeader` y el listener de `scroll`. Se quitan las clases que dependen de esa bandera y las `transition-all` que animaban relleno, logo, título y la línea naranja.

Queda el tamaño de hoy con la página arriba: `md:py-4`, logo `h-9 md:h-10`, título `text-lg`, línea `mt-1 h-1 w-24`. Nombre, RUT, carrera, periodo, Salir y el teléfono de ayuda no cambian. El botón de WhatsApp no se toca.

## Fuera de alcance

- Flujo mock, incluida su copia del stepper.
- Orden de botones y celular de 9 dígitos. Eso ya está en el spec del 2026-10-10 de acciones y teléfono.
- Scroll al cambiar entre Datos, Forma de pago y Firma.
- Tiempos del SMS, recupero de contraseña y textos de la firma.
- Cambiar `pasoBloqueadoTrasEnvio` o permitir abrir un paso cerrado.

## Pruebas

No hay test de montaje del layout. La regla de bloqueo ya está en `pasoAlumnoRematricula` y no se reescribe.

En el navegador, en el flujo del alumno:

- Un paso futuro se ve apagado, sin círculo. Al pulsarlo sale el aviso con el nombre del paso actual y el del pulsado. «Entendido» deja al alumno donde está.
- Un paso ya abierto se abre al pulsar, sin aviso.
- El paso actual se distingue por el naranja y no parece un radio.
- En términos, «Acepto» se ve al entrar y funciona con el acordeón cerrado. Abrir el acordeón muestra el texto.
- Resumen abre en «¡Felicitaciones!».
- Al bajar en cualquier paso, la cabecera no cambia de alto.
