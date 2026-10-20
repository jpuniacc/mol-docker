# Espera CAE y ministerial desde el consolidado

Fecha: 2026-10-20  
Proyecto: `mol-docker`  
Estado: diseño aprobado (pendiente plan de implementación)

## Problema

La forma de pago deja pasar a alumnos con beca ministerial. BECA 1 y BECA 2 son becas internas de UNIACC. La marca de CAE y de beca ministerial vive en el consolidado de la cartera.

Caso: RUT `21830791-4`, código `20241DGMU1DR018`, periodo `2027-01`. El consolidado dice `BECA MINISTERIAL`. BECA 1 dice `Sin beca`. No tiene resolución ministerial. Llegó hasta el pago.

En la cartera 2027-1, BECA 1 y BECA 2 no traen ninguna beca estatal. Hay 456 filas con consolidado ministerial (229 `BECA MINISTERIAL` y 227 `CAE/BECA MINISTERIAL`). La espera actual no las toma.

## Decisiones

| Tema | Decisión |
|------|----------|
| Señal | Columna `consolidado` ya guardada en `mnp_cartera_beneficios` |
| BECA 1 / BECA 2 | Siguen solo para el descuento interno |
| `CAE` | Espera de CAE. Sale con resolución CAE del código y periodo |
| `BECA MINISTERIAL` | Espera ministerial. Sale con resolución ministerial del código y periodo |
| `CAE/BECA MINISTERIAL` | Primero espera de CAE. Si esa resolución está, después espera ministerial |
| `SUBDERE` | Fuera de esta regla |
| Consolidado vacío | Sigue al pago, salvo que el plan de U+ traiga CAE |
| Plan con CAE | `alumno_cae` en `Si` o `Sí` también entra a la espera de CAE, aunque el consolidado venga vacío |
| Cartera ilegible | No se abre el pago |
| Caso | La espera ministerial abre `ESTATAL_MINEDUC` si no hay uno abierto |
| Quien ya pagó | No se devuelve |

## Puerta

La forma de pago del alumno y la de prueba usan la misma decisión. El texto del consolidado se lee sin distinguir mayúsculas.

| Consolidado | CAE | Ministerial |
|-------------|-----|-------------|
| `CAE` | sí | no |
| `BECA MINISTERIAL` | no | sí |
| `CAE/BECA MINISTERIAL` | sí | sí |
| `SUBDERE` | no | no |
| vacío o fila ausente | no | no |

Una fila ausente, con la cartera cargada, es consolidado vacío. Un error al consultar la cartera no es consolidado vacío: se muestra el error y se puede reintentar. El pago no se abre.

Orden:

1. Si el consolidado trae CAE, o el plan trae `alumno_cae` en `Si` o `Sí`, corre la verificación de CAE que ya existe.
2. Sin resolución CAE, queda en la espera de CAE.
3. Con resolución CAE, o sin CAE, si el consolidado trae ministerial, consulta la resolución ministerial que ya existe.
4. Sin resolución ministerial, queda en la espera ministerial.
5. Si no corresponde ninguna espera, sigue a becas y pago.

La pantalla ministerial muestra el texto del consolidado. El mensaje deja de decir que la beca está en el plan. BECA 1 y BECA 2 no se listan en esa pantalla.

## Reserva y caso

Al entrar en espera se reserva el descuento de matrícula anticipada, como hoy. CAE usa motivo `CAE`. Ministerial usa motivo `ESTATAL`. Si ya hay una reserva para ese código y periodo, se conserva. Al continuar, el pago usa esa reserva.

BECA 1 y BECA 2 se calculan igual que ahora, como becas internas.

Al quedar en espera ministerial se abre un caso `ESTATAL_MINEDUC` en estado abierto. El periodo del caso es `YYYY-0S`, por ejemplo `2027-01`, el mismo que ya usa el tablero para reconocer la espera. Si ya existe uno abierto o en revisión para ese código y periodo, se reutiliza. Reintentar no abre otro. El tablero de rematrícula lo muestra como «En espera Ministerial».

La espera de CAE sigue dejando su verificación. El tablero ya la lee por esa verificación cuando el resultado es `pendiente_resolucion`.

## Fuera de alcance

- Recargar el Excel o guardar la columna `BECA MINISTERIAL`.
- Cambiar la regla de SUBDERE.
- Crear otra pantalla.
- Escribir la resolución CAE o ministerial desde MOL.
- Devolver a quien ya pagó.

## Criterios de éxito

- `21830791-4`, consolidado `BECA MINISTERIAL`, sin resolución ministerial: espera ministerial, un caso `ESTATAL_MINEDUC` abierto, sin medios de pago.
- Consolidado `CAE`, sin resolución CAE: espera de CAE.
- Consolidado `CAE/BECA MINISTERIAL`, con resolución CAE y sin resolución ministerial: espera ministerial.
- Consolidado vacío y plan sin CAE: llega al pago; BECA 1 y BECA 2 se calculan como becas internas.
- Plan con CAE y consolidado vacío: espera de CAE.
- Error al cargar la cartera: mensaje de error, pago cerrado, reintento posible.
- Reintentar la espera ministerial no duplica el caso.
