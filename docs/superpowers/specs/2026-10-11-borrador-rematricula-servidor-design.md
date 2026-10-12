# Borrador de rematrícula en el servidor

Fecha: 2026-10-11  
Proyecto: `mol-docker`  
Estado: aprobado

## Problema

El avance del alumno vive en `sessionStorage` (`rematricula-alumno-matricula`). Otra ventana, una ventana privada u otro navegador entran con la misma cuenta y ven todos los pasos en Pendiente.

## Decisión

Solo el flujo real del alumno. El mock no se guarda ni se lee. La tabla `mnp_progreso_rematricula` no se toca: sigue siendo el resumen del personal.

Una fila por alumno y periodo. Al entrar en cualquier navegador, el inicio muestra el mismo Listo, En curso o Pendiente.

## Tabla

`public.mol_borrador_rematricula`

- Clave: `codcli`, `anio_periodo`, `semestre_periodo`.
- `payload jsonb`: el mismo objeto que hoy guarda la sesión (`StoredAlumnoMatriculaContext`).
- `actualizado_en timestamptz`: lo pone la base al guardar.

Los convenios quedan como la ruta y el nombre de archivo que ya van en el objeto. No se guarda el archivo otra vez. No se guarda la contraseña.

Sin lectura directa para `anon` ni `authenticated`. Dos funciones, el mismo acceso que `registrar_log_mol_tyc_respuesta` (`anon` y `authenticated`):

- `guardar_mol_borrador_rematricula(codcli, anio, semestre, payload)` hace upsert y devuelve `actualizado_en`.
- `consultar_mol_borrador_rematricula(codcli, anio, semestre)` devuelve `payload` y `actualizado_en`, o nada si no hay fila.

Si falta `codcli` o el periodo activo, no se escribe ni se lee.

## Cuándo se guarda

Cada cambio que hoy llama `persistToSessionStorage` también sube la fila. Varios cambios seguidos se juntan en una sola escritura. Si la red falla, la sesión del navegador sigue y el flujo no se bloquea. La próxima escritura reintenta.

La sesión recuerda el `actualizado_en` de la última respuesta buena del servidor.

## Cuándo se lee

Al tener `codcli` y periodo activo, antes de mostrar el avance del inicio:

- Sesión sin avance (la misma regla que hoy descarta una sesión vacía) y hay fila: se usa la fila y se copia a la sesión.
- Hay sesión y hay fila, y `actualizado_en` del servidor es posterior al que recuerda la sesión: gana el servidor.
- La sesión tiene cambios todavía no confirmados por el servidor: se queda la sesión y se sube.

## Lo que no cambia

- La regla de Listo, En curso y Pendiente.
- El cálculo del paso máximo.
- El mock.
- Los indicadores del personal.
