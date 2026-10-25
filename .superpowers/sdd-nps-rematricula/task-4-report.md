# Task 4 Report: Tarjeta en resumen del alumno (NPS rematrícula)

**Status:** DONE_WITH_CONCERNS  
**Branch:** `dev`  
**Date:** 2026-10-18  
**Commit:** `f95643c` — feat(nps): tarjeta de evaluación en resumen del alumno

## Summary

Tarjeta opcional de evaluación de facilidad en el resumen del alumno, no bloqueante respecto a la descarga del contrato.

## Deliverables

| Acción | Archivo |
|--------|---------|
| Creado | `src/components/rematricula/NpsRematriculaCard.vue` |
| Modificado | `src/views/matricula-alumno/ResumenAlumnoView.vue` |

### Comportamiento

1. Al montar: si hay `codcli` + periodo → `estadoNpsRematricula`; si faltan → mensaje de preparación sin formulario.
2. Si `respondio` → «Gracias, ya registramos tu evaluación.»
3. Si no → título «Evalúa tu experiencia», pregunta exacta del spec, botones 1–5, «Ahora no» (solo `omitidoLocal`, sin POST).
4. Calificación 1–3 → `Textarea` opcional maxlength 500.
5. «Enviar evaluación» → `guardarNpsRematricula` con identidad MNP + periodo + `periodoLabel` + `sesionId`.
6. Identidad incompleta (antes de formulario o al enviar) → «No pudimos preparar la evaluación. Reintenta más tarde.» sin POST de guardar.
7. Error de guardado → toast + mensaje; mantiene selección para reintento.
8. Éxito → estado confirmado.

### Sesión

`useMatriculaAlumnoContextStore` **no** expone `sesionId`. Se usa `obtenerSesionLogId()` (`molAuditContext` / `auth.sessionLogId`), mismo patrón que discapacidad/TyC.

### Montaje

`<NpsRematriculaCard />` después del bloque RUT/carrera/codcli y antes de Webpay/plan/descarga.

## Tests / verificación

- Lint IDE: sin errores en los archivos tocados.
- `vue-tsc --noEmit` (filtrado a archivos NPS/resumen): sin diagnósticos.
- **Smoke browser no ejecutado** (requiere sesión alumno en resumen). Autorevisión de código contra brief/spec.

## Concerns

- Verificación manual E2E pendiente: omitir local, respuesta 5, respuesta 2+comentario, persistencia tras refresh, descarga de contrato intacta.
- Smoke de unicidad (doble guardar) diferido desde Task 3 sigue pendiente hasta prueba con sesión real.
