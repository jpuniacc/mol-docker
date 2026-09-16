# Task 3 — Badges en ConvenioVigenteUpload

## Estado

Completada en `/opt/mol-docker`, rama `dev`.

## Implementación

- `ConvenioVigenteUpload`: reemplazado el bloque verde “Documento cargado” por badges **Aprobado** / **Rechazado** / **En revisión** según `estadoCaso`.
- Mensaje de rechazo con `motivoRechazo` y CTA implícito de re-subida; mensaje amber para `EN_REVISION` o sin caso.
- Botón **Eliminar** oculto cuando `estadoCaso === 'APROBADO'`.
- Si `RECHAZADO`, se muestra de nuevo el bloque de file input + subir (re-upload sin borrar obligatorio).
- `FormaPagoMockView`: CardDescription ajustada a “para poder pagar la matrícula”.

## Commit

- `feat(rematricula): badges de estado en certificado convenio`
- Archivos: `ConvenioVigenteUpload.vue`, `FormaPagoMockView.vue`

## Verificación

- Linter: sin errores en archivos tocados.
- Smoke lógico: con doc + APROBADO → badge verde, sin eliminar ni re-upload; RECHAZADO → badge rojo + motivo + input; EN_REVISION/null → amber + sin implicar listo para pagar.

## Observaciones

- Re-upload en RECHAZADO delega al padre abrir nuevo caso `EN_REVISION` vía `@subido` (ya implementado en Task 2).
- Badge “En revisión” también aplica cuando hay documento pero aún no hay fila de caso (estado null).

## Corrección post-revisión (Important)

- **Problema:** al fallar `eliminar()` con documento visible y `estadoCaso` distinto de `RECHAZADO`, el `<p v-if="error">` solo vivía en el bloque de upload (oculto), así que el error no se veía inline.
- **Fix:** mensaje rojo junto al bloque de estado del documento cuando `documento && error && estadoCaso !== 'RECHAZADO'`. El bloque RECHAZADO conserva su `<p v-if="error">` existente.
- **Commit:** `fix(rematricula): mostrar error al eliminar certificado convenio`
- **Archivo:** `ConvenioVigenteUpload.vue`
