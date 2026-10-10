# Acciones del flujo y celular de 9 dígitos

Fecha: 2026-10-10  
Proyecto: `mol-docker`  
Estado: aprobado

## Problema

En las pruebas de usabilidad, la acción para seguir se veía a la izquierda o en gris, y la de volver o rechazar a la derecha. En el celular el orden también cambiaba según la pantalla.

En el celular, el campo muestra `+569` y pide 8 dígitos. Quien escribe el número completo parte por el 9, ese 9 ocupa el primer lugar y el último dígito no entra.

## Decisión

Solo el flujo del alumno.

Las parejas de botones usan un solo componente, `AccionesFlujo`. En escritorio, volver, cancelar o reenviar queda a la izquierda. Aceptar, confirmar o generar queda a la derecha, en naranja. En celular, la acción principal queda arriba y la secundaria abajo. Las dos ocupan el ancho del bloque.

El prefijo visible del celular pasa a `+56`. El estudiante escribe 9 dígitos. El primero puede ser 9, 8, 7 u otro. No se rechaza por ese dígito.

Los tiempos del SMS no se cambian.

## AccionesFlujo

Archivo: `src/components/rematricula/AccionesFlujo.vue`.

Tiene dos espacios. `secundaria` es opcional. `primaria` es obligatoria. El componente no elige el texto ni el clic. Solo ordena.

La fila es `flex flex-col-reverse gap-3 sm:flex-row sm:justify-end`. Cada botón lleva `w-full sm:w-auto`. En escritorio la primaria queda a la derecha. En celular queda arriba.

El color lo pone la pantalla, no el componente. La primaria usa `bg-uniacc-orange hover:bg-uniacc-orange/90`. La secundaria sigue en `outline`.

Lo usan estas pantallas:

| Pantalla | Archivo | Secundaria | Principal |
|---|---|---|---|
| Confirmar datos del sostenedor | `MatriculaAlumnoApoderadoStep.vue` | No, necesito actualizarlos | Sí, estos datos son correctos |
| Términos y condiciones | `MatriculaAlumnoTyCStep.vue` | No acepto | Acepto términos y condiciones |
| Verificación estatal | `MatriculaAlumnoVerificacionEstatalStep.vue` | Volver a datos personales | Reintentar verificación |
| Verificación CAE | `MatriculaAlumnoVerificacionCaeStep.vue` | Volver a datos personales | Reintentar verificación |
| Seguir sin validar correo | `DatosPersonalesAlumnoView.vue` | Cancelar | Aceptar |
| Seguir sin validar celular | `DatosPersonalesAlumnoView.vue` | Cancelar | Aceptar |
| Código de correo | `DatosPersonalesAlumnoView.vue` | Reenviar código | Confirmar código |
| Código SMS | `DatosPersonalesAlumnoView.vue` | Reenviar SMS | Confirmar código SMS |
| Generar cuotas | `FormaPagoAlumnoView.vue` | — | Generar cuotas |

«Generar cuotas» hoy es `variant="secondary"`. Pasa a la clase naranja y queda alineado a la derecha. Es una acción sola: solo se llena `primaria`.

No se reescriben estos pies, porque ya cumplen la regla:

- El pie que solo tiene **Anterior**, en forma de pago y en firma.
- **Enviar a firmar**.
- El pie del diálogo de pago: Volver y Cancelar, luego Continuar o Confirmar plan.

## Celular

La regla vive en `src/utils/telefonoChile.ts`. La pantalla que cambia es `DatosPersonalesAlumnoView.vue`.

`TELEFONO_CHILE_PREFIJO` pasa a `+56`. `TELEFONO_CHILE_DIGITOS_TRAS_PREFIJO` pasa a `9`.

`extraerDigitosTelefonoChile` deja solo dígitos y después:

- Si hay 11 dígitos y parten con `56`, quita ese `56` y devuelve los 9 restantes.
- Si hay 9 dígitos, los devuelve tal cual. También si parten con `56`, `8` o `7`.
- En cualquier otro largo, devuelve esos dígitos recortados a 11. No inventa un número de 9.

`normalizarTelefonoChile` devuelve `+56` más lo que extrajo. `telefonoChileEsValido` es verdadero solo con `+56` y exactamente 9 dígitos.

Ejemplos:

| Entrada | Dígitos en el campo | Guardado | Válido |
|---|---|---|---|
| `987654321` | `987654321` | `+56987654321` | sí |
| `+56987654321` | `987654321` | `+56987654321` | sí |
| `56987654321` | `987654321` | `+56987654321` | sí |
| `561234567` | `561234567` | `+56561234567` | sí |
| `812345678` | `812345678` | `+56812345678` | sí |
| `12345678` | `12345678` | `+5612345678` | no |

Un número ya guardado como `+56987654321` se muestra `987654321` al lado de `+56`. El valor guardado no cambia.

Al ERP sigue yendo `fonoactParaSp`: los dígitos, sin `+`. `+56987654321` sale `56987654321`. `+56812345678` sale `56812345678`. Esa función no se reescribe.

La máscara de auditoría, `enmascararTelefonoChile`, queda `+56*****` más los últimos 4 dígitos. `+56987654321` se ve `+56*****4321`. Si el número no es válido, sigue devolviendo `***`.

El input del alumno no usa `maxlength` 9. Un tope de 9 cortaría el pegado de `+56987654321` antes de que la función lo vea. El tope del input es 20. El handler escribe de vuelta lo que devolvió `extraerDigitosTelefonoChile`.

El texto de ayuda es: «Ingresa los 9 dígitos del celular.» Si al salir del campo no hay 9 dígitos, el error es: «El celular debe tener 9 dígitos después de +56.» Con menos de 9 no se envía el SMS. No hay un aviso cuando el sistema quita el `56` de un pegado.

## Fuera de alcance

- Tiempos de vigencia y de reenvío del SMS.
- Editar pantallas del flujo mock. La función del teléfono es compartida, así que si alguien abre el mock verá el prefijo `+56` y 9 dígitos. Los textos fijos del mock que dicen «8 dígitos» no se corrigen.
- Stepper, términos desplegables, scroll de la pantalla final, temblor del header, recupero de contraseña y textos de la firma.
- El pie que solo tiene Anterior, Enviar a firmar y el pie del diálogo de pago.

## Pruebas

Vitest, en `src/utils/telefonoChile.test.ts`. No se monta el componente de botones: el orden queda en `AccionesFlujo` y se revisa en las pantallas.

- Nueve dígitos se quedan igual, partan con 9, 8, 7 o 56.
- `+56987654321` y `56987654321` pasan a `987654321`.
- Un número ya guardado como `+56987654321` se extrae como `987654321`.
- `telefonoChileEsValido` acepta `+56` más 9 dígitos y rechaza un largo distinto.
- `fonoactParaSp` sobre el valor normalizado devuelve `56987654321` o `568…` si el nacional parte con 8.
- Un pegado de 10 dígitos no se recorta a un número válido.
- La máscara de un número válido es `+56*****` más los últimos 4.
