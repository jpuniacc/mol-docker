# Copy reserva descuento: aclarar que el monto es descuento

**Fecha:** 2026-11-19  
**Estado:** aprobado (diseño v1)  
**Proyecto:** mol-docker (front rematrícula alumno)  
**Rollout:** mol-dev → uniacc-mol tras merge `dev`/`qa`/`main` + rebuild front  

## Problema

La caja verde de reserva muestra:  
`Tienes reservado Matricula Anticipada Noviembre por 50.000 hasta el 31-01-2027.`

Los alumnos interpretan **50.000 como valor de la matrícula**, no como **monto del descuento**.

## Decisiones

| Tema | Decisión |
|------|----------|
| Alcance | Todos los sitios que usan ese mensaje (CAE + estatal vía el mismo prop) |
| Enfoque | Objeto tipado + UI de 3 filas etiquetadas (no solo cambiar el string) |
| Copy | Descuento / Monto / Reservado hasta |
| Mock | Sin cambio si no usa el prop hoy |
| API / SQL | Ninguno |

## Comportamiento

Cuando hay reserva válida (descuento + `reserva_hasta` formateable):

- **Descuento:** `{nombre}`  
- **Monto:** `$` + monto CLP (`fmtMontoClp`)  
- **Reservado hasta:** fecha calendario (`dd-mm-aaaa`)

Sin reserva o sin fecha usable → no se muestra la caja (`null`), igual que hoy.

## Componentes

- `FormaPagoAlumnoView.vue`: computed `reservaDescuento` (objeto) en lugar de `textoReservaMatricula` (string).  
- `MatriculaAlumnoVerificacionCaeStep.vue` y `MatriculaAlumnoVerificacionEstatalStep.vue`: prop `reservaDescuento` y render `<dl>` de 3 filas en el bloque emerald.

## Tests

- Helper o computed: con datos válidos expone nombre, monto formateado y hasta.  
- Sin `hasta` usable → `null`.

## Fuera de alcance

- Cambiar montos, catálogo o lógica de reserva.  
- Copy del alert naranja de espera CAE.  
- Flujo mock salvo que reutilice el mismo componente/prop.

## Verificación manual

1. Alumno con reserva CAE/estatal: caja verde con 3 líneas.  
2. Sin reserva: caja ausente.  
3. Monto se lee claramente como descuento.
