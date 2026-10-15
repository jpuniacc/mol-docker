# Permanencia de más de 24 horas en el embudo KPI

Fecha: 2026-10-15  
Proyecto: `mol-docker`  
Estado: diseño aprobado (pendiente revisión del spec y plan de implementación)

## Problema

En el embudo de etapas del KPI de rematrícula, un alumno puede quedar detenido después de ingresar. El conteo de la etapa no dice cuánto tiempo lleva ahí. Operaciones necesita ver en rojo a quien lleva más de 24 horas seguidas en la misma etapa.

## Decisión

Guardar `etapa_desde` en `mnp_progreso_rematricula`: el instante en que el alumno entró a `etapa_actual`.

El reloj empieza al entrar en la etapa. Una actividad que no cambia la etapa no lo reinicia. Solo cambia cuando `etapa_actual` cambia.

La comparación es estricta: se marca cuando `now() - etapa_desde` es mayor a 24 horas.

## Alcance visual

Aplica al listado de alumnos que se abre dentro de cada etapa en `RematriculaKpiView`.

Etapas marcadas:

- Ingreso
- TyC aceptados
- Datos OK
- Forma de pago
- Contrato firmado

Etapas sin marca, aunque lleven más de 24 horas:

- Sin ingreso
- Matriculado

Cada alumno que supera el umbral se muestra con:

- fondo rojo suave en toda la fila
- una etiqueta roja con las horas enteras transcurridas, por ejemplo `31 h en esta etapa`

24 horas exactas no se marcan. 24 horas y un minuto se muestran como `24 h en esta etapa`. El cálculo se hace al renderizar la lista. No hay un reloj en vivo: si la página queda abierta, la marca se actualiza al volver a cargar el KPI o la etapa.

El número de la etapa no cambia. La búsqueda y la paginación se mantienen. El seguimiento y los otros embudos quedan fuera.

## Datos

`refresh_mnp_progreso_rematricula` hoy borra el periodo y lo vuelve a insertar. La columna nueva tiene que sobrevivir a ese refresco.

Antes de borrar, el refresco conserva `codcli`, `etapa_actual` y `etapa_desde` del periodo. Al insertar:

- si el alumno sigue en la misma etapa, conserva `etapa_desde`
- si cambió de etapa, `etapa_desde` queda en `now()`
- si el alumno no estaba en el snapshot, `etapa_desde` queda en `now()`

La migración agrega `etapa_desde timestamptz NOT NULL`. Las filas que ya existen se inician con `ultima_actividad_en`. Si esa fecha es nula, se usa `actualizado_en`.

`listar_mnp_progreso_rematricula` devuelve la tabla completa, así que la columna nueva sale sin cambiar la firma del RPC. El tipo `MnpProgresoRematriculaRow` la incluye.

La regla de color vive en una función pura del front: etapa, `etapa_desde` y el instante actual. Ahí se prueba el umbral, el redondeo a horas enteras y la exclusión de Sin ingreso y Matriculado.

## Errores

Si `etapa_desde` no viene en una fila, esa fila se muestra como hoy, sin rojo y sin etiqueta. El resto de la etapa sigue cargando.

## Pruebas

- misma etapa en dos refrescos: `etapa_desde` no cambia
- cambio de etapa: `etapa_desde` pasa a ser el instante del refresco
- 24 horas exactas: sin marca
- más de 24 horas en Ingreso, TyC, Datos, Forma de pago o Contrato firmado: fila marcada y etiqueta con horas enteras
- Sin ingreso y Matriculado: sin marca
