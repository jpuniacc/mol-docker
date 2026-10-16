# Confirmación de datos de apoderado

Fecha: 2026-10-16  
Proyecto: `mol-docker` y `uniacc-api-docker`  
Estado: diseño aprobado, pendiente de implementación

## Problema

En Casos rematrícula, el botón **Datos actualizados** de un caso `APODERADO_DATOS` en `EN_REVISION` hace tres cosas seguidas, sin mostrar una comparación:

1. Consulta el ERP y reemplaza en `mnp_mv_plan_pagos_consolidado` los datos del apoderado.
2. Encola el aviso `APODERADO_ACTUALIZADO`.
3. Marca el caso como `APROBADO`.

El alumno solo recibe ese aviso si `REMATRICULA_AVISO_APODERADO_INCLUIR_ALUMNO` está en `true`. El destinatario, cuando entra, es `email_personal_alumno` del ERP, no el correo personal que validó en la rematrícula.

## Decisión

El botón solo consulta. Un cuadro de dos columnas muestra lo que el alumno vio y lo que trae el ERP. **Cancelar** no cambia nada. **Confirmar** actualiza MOL, encola el correo y después cierra el caso.

El correo va al correo personal validado por el alumno. La copia va a `mol@uniacc.cl` y al `email_ejecutivo` de `mnp_cartera_oficial`. No va a quien presiona el botón, salvo que esa persona sea el consejero de la cartera.

## Cuadro

Se abre desde el botón de la fila y desde el del detalle. Los dos usan el mismo flujo.

Columnas:

- Izquierda, **Vistos por el alumno**: `payload.apoderadoNombre`, `payload.apoderadoTelefono` y `payload.apoderadoEmail` del caso ya cargado.
- Derecha, **Nuevos en el ERP**: nombre completo (`nombre_apoderado`, `apellido_paterno_apoderado`, `apellido_materno_apoderado`), teléfono (`telefono_apoder` y, si viene vacío, `telefono_apoderado`) y correo (`mail_apoder`).

Un campo vacío se muestra como `—`. Si los dos lados coinciden, **Confirmar** sigue disponible.

## Consulta

Nuevo `POST /api/rematricula/apoderado/preview-from-erp`.

Lee el ERP con la misma vista y el mismo ambiente SP activo que usa hoy `refresh-from-erp`: `VW_ALUMNOS_PARA_MAT_{anio}_{semestre}`. También busca el correo validado con `CORREO_VALIDADO_ALUMNO_SQL`, usando el RUT y el `codcli` del caso.

No actualiza el consolidado, no inserta aviso y no cambia el estado del caso.

Respuesta útil para el cuadro: los tres datos nuevos y `puedeConfirmar`. `puedeConfirmar` es verdadero solo cuando existe correo personal validado.

Si el ERP no responde o no trae fila, la API responde error. La pantalla muestra ese error y no abre el cuadro.

## Confirmar

`POST /api/rematricula/apoderado/refresh-from-erp` sigue siendo el paso que escribe. El orden queda así:

1. Si no hay correo personal validado, responde `SIN_CORREO_VALIDADO` y no escribe.
2. Actualiza el consolidado con el ERP, igual que hoy.
3. Encola `APODERADO_ACTUALIZADO` con `emailAlumno` igual al correo validado. Si ya hay un aviso de ese tipo para el mismo `caso_id` en estado `pendiente` o `enviado`, reutiliza ese aviso y no inserta otro.
4. Si el aviso no queda encolado, responde `AVISO_ERROR`. El caso sigue en `EN_REVISION`.
5. Solo con respuesta `ok` y `avisoId`, la pantalla llama a `resolver_mnp_caso_rematricula` con estado `APROBADO`, motivo `Datos de apoderado actualizados desde ERP` y `resueltoPor` el correo de la sesión.

Si el paso 2 falla, el caso sigue abierto y no se encola correo. Un reintento después de un `AVISO_ERROR` vuelve a escribir los mismos datos del ERP, reutiliza el aviso si ya existe y entonces permite cerrar el caso.

La pantalla deshabilita **Confirmar** cuando `puedeConfirmar` es falso y explica que falta el correo personal validado. La API repite esa comprobación.

## Correo

`APODERADO_ACTUALIZADO` siempre incluye al alumno. Deja de depender de `REMATRICULA_AVISO_APODERADO_INCLUIR_ALUMNO`.

- Para: correo personal validado.
- Copia: `REMATRICULA_AVISO_CC` (por defecto `mol@uniacc.cl`) y el `email_ejecutivo` de la cartera, sin repetir el destinatario.

El texto sigue siendo el de la plantilla actual: los datos del apoderado ya están actualizados y el alumno puede continuar la rematrícula. El enlace del botón pasa de `/matricula-mock` a `/matricula-alumno`.

Si el aviso llegara a procesarse sin `emailAlumno`, queda `omitido` con el motivo `sin correo validado del alumno`. Confirmar no deja llegar a ese estado porque se detiene antes.

## Alcance

Aplica solo a `APODERADO_DATOS` en `EN_REVISION`. No cambia la aprobación de certificados, el mensaje que ve el alumno mientras el caso está abierto, ni el aviso que se envía cuando el alumno marca los datos como desactualizados.

## Pruebas

En `uniacc-api-docker`:

- La consulta no escribe en el consolidado, no inserta aviso y no cambia el caso.
- La consulta devuelve nombre, teléfono y correo del ERP, y `puedeConfirmar` según el correo validado.
- Confirmar sin correo validado responde `SIN_CORREO_VALIDADO` y no escribe.
- Confirmar actualiza el consolidado, encola el aviso con el correo validado y devuelve `avisoId`.
- Si encolar el aviso falla, la respuesta es `AVISO_ERROR` y el caso no se cierra.
- Un segundo confirmar con aviso ya encolado no inserta otro.
- El aviso `APODERADO_ACTUALIZADO` sale al alumno, con copia a MOL y al ejecutivo de la cartera, aunque la variable de entorno esté apagada.

En la vista, los dos botones abren el cuadro y **Cancelar** no llama a `refresh-from-erp` ni a resolver el caso.
