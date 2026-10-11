# Firma del alumno y del apoderado

Fecha: 2026-10-11  
Proyecto: `mol-docker`  
Estado: aprobado

## Problema

En las pruebas de usabilidad, 4 de 5 se trabaron en la doble firma. Después de enviar el contrato aparecen dos botones parecidos: «Haz click para que firme el alumno» y «Haz click para que firme el apoderado». Se leen como la misma acción.

## Decisión

Solo el flujo del alumno, en `src/views/matricula-alumno/FirmaAlumnoView.vue`. El mock no se edita.

Hay un botón naranja, «Firmar ahora», para el alumno. Si también firma un apoderado, el de él queda secundario: «El apoderado firma ahora». La frase de abajo dice quién falta.

Si el apoderado firma primero, el botón del alumno sigue solo. No se le dice que el apoderado firma después.

## Cuándo se muestra cada cosa

La regla vive en `src/utils/firmaDual.ts`, función `estadoFirmaDual`. La pantalla la usa. No elige el texto en el template.

Entrada: si hay un firmante con rol apoderado, si el alumno ya firmó, si el apoderado ya firmó.

| Alumno | Apoderado | Botón alumno | Botón apoderado | Frase |
|---|---|---|---|---|
| Pendiente | No hay | Firmar ahora | — | — |
| Pendiente | Pendiente | Firmar ahora | El apoderado firma ahora | Después firma el apoderado. Si no está contigo, le llega un correo. |
| Firmado | Pendiente | — | El apoderado firma ahora | Falta la firma del apoderado. Si no está contigo, le llega un correo. |
| Pendiente | Firmado | Firmar ahora | — | — |
| Firmado | No hay, o firmado | — | — | — |

«Firmar ahora» abre el enlace del alumno. «El apoderado firma ahora» abre el enlace del apoderado. El que ya está firmado no tiene botón.

## Botones

Van una sola vez, debajo de la lista de firmantes, en `AccionesFlujo`.

`secundaria` es «El apoderado firma ahora»: `variant="outline"`, `w-full sm:w-auto`. `primaria` es «Firmar ahora»: `bg-uniacc-orange hover:bg-uniacc-orange/90`, `w-full sm:w-auto`.

En escritorio el secundario queda a la izquierda y el naranja a la derecha. En celular el naranja queda arriba.

Cuando el alumno ya firmó y falta el apoderado, «El apoderado firma ahora» pasa al slot naranja, a la derecha. Es la acción que queda. En celular ocupa el ancho.

Los dos respetan la espera que ya existe: mientras dice «Podrás firmar en N segundos», siguen deshabilitados.

«El apoderado firma ahora» además permanece deshabilitado hasta que el alumno haya firmado. Mientras el alumno está pendiente, el botón se ve apagado.

La fila de cada persona ya no lleva el botón «Haz click…». Siguen el nombre, el correo y la marca. Firmado va en verde. Pendiente va en gris, no en naranja.

## Frases

La frase va debajo de los botones.

Sale el párrafo actual del recuadro «Antes de firmar»: «Si el apoderado no está contigo, no hay problema. Le enviaremos un correo para que firme después.»

Se mantiene el aviso de ventanas emergentes: «Activa las ventanas emergentes. El botón abre la firma en una ventana nueva del navegador.»

## Fuera de alcance

- El mock.
- La tarjeta «Enviar a firmar», el checkbox de aceptación y el botón «Enviar a firmar».
- Descargar el borrador, Anterior, y el aviso de ventanas emergentes.
- El orden en que TuFirma pide las firmas, y a quién le manda el correo.
- Plan de pagos, matrícula y arancel.

## Pruebas

Vitest sobre la función pura. No se monta la vista.

- Sin apoderado y con el alumno pendiente: solo «Firmar ahora», sin frase.
- Los dos pendientes: los dos botones y la frase «Después firma el apoderado…».
- Alumno firmado y apoderado pendiente: solo el botón del apoderado y la frase «Falta la firma del apoderado…».
- Apoderado firmado y alumno pendiente: solo «Firmar ahora», sin frase.
- Los dos firmados: ningún botón y ninguna frase.
