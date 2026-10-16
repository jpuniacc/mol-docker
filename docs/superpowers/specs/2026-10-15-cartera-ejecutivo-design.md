# Cartera visible por ejecutivo

Fecha: 2026-10-15  
Proyecto: `mol-docker` y `uniacc-api-docker`  
Estado: diseño aprobado e implementado

## Problema

Los ejecutivos de rematrícula ya existen en el mantenedor con perfil 3. Hoy las pantallas que listan alumnos muestran la cartera completa a Superadmin, Administrador y Ejecutivo.

Cada alumno de `mnp_cartera_oficial` ya tiene `email_ejecutivo`. Ese correo es el de su ejecutivo.

## Decisión

Un store de Pinia calcula el alcance de la sesión. Las consultas lo usan y recortan en la base o en la API, antes de responder.

- Perfil 1 (Superadmin) y perfil 2 (Administrador): sin filtro. Ven la cartera completa.
- Perfil 3 (Ejecutivo): solo los alumnos cuyo `email_ejecutivo`, en minúsculas y sin espacios, coincide con el correo de su sesión.
- Perfil 3 sin correo en la sesión: las listas quedan vacías y la pantalla dice que el usuario no tiene correo para asociar la cartera. No se abre la cartera completa.
- Un alumno sin `email_ejecutivo` no aparece para ningún ejecutivo. Lo ven Superadmin y Administrador.

El store no filtra una lista ya descargada. Entrega `emailFiltro`: el correo del ejecutivo, o `null` cuando no hay recorte.

## Corrección de Francisca

El usuario de Francisca ya es `francisca.silvab@uniacc.cl`. En la cartera, 1.562 alumnos tienen `francisca.silva@uniacc.cl` y 1 tiene el correo correcto.

Corrección única, en la cartera viva:

```sql
UPDATE public.mnp_cartera_oficial
SET email_ejecutivo = 'francisca.silvab@uniacc.cl'
WHERE lower(trim(email_ejecutivo)) = 'francisca.silva@uniacc.cl';
```

La misma corrección se aplica en la columna `EJECUTIVO MATRICULA` del Excel que carga `scripts/load_cartera_email_ejecutivo.py`, para que una recarga no vuelva a escribir el correo sin la b. No se reescriben avisos ya enviados.

## Store

Archivo nuevo: `src/stores/carteraEjecutivo.ts`, Composition API.

Lee el perfil y el correo desde el store de auth. El alcance tiene tres estados:

- `completo`: perfil 1 o 2. Las consultas van sin correo.
- `ejecutivo`: perfil 3 con correo. Las consultas van con ese correo en minúsculas.
- `sin_correo`: perfil 3 sin correo. No se llama a las consultas. Las listas quedan vacías y se muestra el aviso.

Un caso sin `rut_alumno` no cruza con la cartera, así que un ejecutivo no lo ve. Superadmin y Administrador sí.

## Pantallas

El filtro entra en la consulta de estas pantallas:

- KPI de rematrícula, incluidos los totales del embudo y el listado de cada etapa
- Seguimiento de alumnos
- Casos de rematrícula
- Gestión de firmas
- Matriculados, incluidos el detalle, las estadísticas y la exportación
- Estado de firma del contrato, incluido el documento de un alumno
- Encuesta de discapacidad
- Desbloqueo de toma de ramos, incluida la búsqueda por RUT y las acciones de bloquear, desbloquear y quitar

Quedan fuera los mantenedores y catálogos: convenios, aranceles, beneficios, CAE, período, usuarios, términos, contacto OTP y Próximamente.

El refresco del progreso y las sincronizaciones que no devuelven filas de alumnos siguen recalculando el universo completo. La lectura posterior igual sale recortada.

## Consultas de Supabase

Estas funciones ganan un argumento opcional `p_email_ejecutivo text default null`:

- `kpi_mnp_progreso_rematricula`
- `listar_mnp_progreso_rematricula`
- `listar_mnp_casos_rematricula`

Con `null`, el resultado es el de hoy. Con correo, la fila entra solo si existe en `mnp_cartera_oficial` un `rut_norm` igual al del alumno y el correo coincide. El progreso ya tiene `rut_norm`. Los casos se cruzan normalizando `rut_alumno` con la misma regla de la cartera.

El timeline de un alumno se abre solo desde una fila que ya pasó el filtro.

## Consultas de uniacc-api

Estas lecturas aceptan `emailEjecutivo` en la query. La API lee los RUT de `mnp_cartera_oficial` para ese correo y deja fuera el resto antes de responder. Si el parámetro no viene, la respuesta sigue completa.

- Listado, detalle, estadísticas y exportación de matriculados
- Listado y documento de estado de firma
- Listado de gestión de firmas
- Listado de encuesta de discapacidad
- Listado, búsqueda y cambios de desbloqueo de toma de ramos

Si el ejecutivo busca o modifica un RUT que no está en su cartera, la API responde como si no existiera.

## Errores

Si la lectura de la cartera falla, la API y la pantalla no devuelven la lista completa. Muestran el error.

## Pruebas

- Función pura del store: perfil y correo producen `null`, el correo o el bloqueo.
- SQL: correo de Nicole devuelve solo sus filas; `null` devuelve todas; un correo inexistente devuelve cero; un alumno sin ejecutivo no sale para el perfil 3.
- API: con `emailEjecutivo` el listado y la exportación excluyen al resto; sin el parámetro el listado sigue completo.

## Fuera de este diseño

No se cambia el inicio de sesión ni se cierra la llave de Supabase del navegador. Un llamado directo que omita el correo sigue pudiendo pedir la cartera completa, igual que hoy.
