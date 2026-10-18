# NPS transaccional de rematrícula

Fecha: 2026-10-18  
Proyecto: `mol-docker`  
Estado: diseño aprobado, pendiente de implementación

## Problema

Al terminar el flujo de rematrícula no hay una medición inmediata de la facilidad o calidad del proceso. Operaciones y producto necesitan un indicador accionable, ligado a esa experiencia concreta, no a la relación general del estudiante con UNIACC.

## Decisión

Medir un **NPS transaccional (tNPS) de facilidad**, opcional, integrado en la pantalla de resumen del alumno (`matricula-alumno-resumen`).

No es un NPS relacional (recomendación de la institución). La pregunta evalúa el proceso de rematrícula que acaba de completar.

## Experiencia del estudiante

En la pantalla de resumen, debajo del mensaje de finalización y junto a la descarga del contrato, aparece una tarjeta «Evalúa tu experiencia».

1. Pregunta: «¿Qué tan fácil fue completar tu proceso de rematrícula?»
2. Respuesta: botones del 1 al 5 (1 = muy difícil, 5 = muy fácil).
3. Omitir: el estudiante puede continuar sin responder. La descarga del contrato no se bloquea.
4. Comentario: si elige 1, 2 o 3, aparece un campo opcional de hasta 500 caracteres para explicar el problema.
5. Envío: al guardar, la tarjeta muestra confirmación de evaluación registrada.
6. Revisita: si ya respondió, la tarjeta muestra solo la confirmación; no puede modificar ni volver a enviar.

Omitir la encuesta no se persiste como respuesta. Si el estudiante vuelve al resumen sin haber respondido, la tarjeta vuelve a mostrarse.

## Reglas de negocio

- Una respuesta por estudiante, periodo académico y proceso finalizado.
- Solo aplica cuando la rematrícula está finalizada (`firmaCompletada` y acceso a resumen).
- Calificaciones 4 y 5 no solicitan comentario.
- Comentario opcional solo para 1–3; máximo 500 caracteres; se guarda recortado de espacios.
- Fallo al guardar: mensaje de error y opción de reintentar; no se pierde la selección local hasta un envío exitoso o salida de la pantalla.

## Persistencia

Nueva tabla, por ejemplo `mnp_nps_rematricula`, con:

- Identidad del alumno: `rut` y `codcli` (ambos obligatorios)
- Contexto académico: `codigo_carrera` y `jornada` (desde la fuente MNP del alumno al momento de responder)
- Periodo (`anio`, `semestre`)
- Calificación `1..5`
- Comentario nullable
- Marca de tiempo de creación
- Restricción de unicidad por `codcli` + periodo

API mínima:

- `GET` estado: si ya respondió para el periodo activo
- `POST` respuesta: valida rango, unicidad y que el flujo esté finalizado
- `GET` agregado administrativo: promedio, distribución 1–5, total de respuestas, tasa sobre finalizados del periodo, listado de comentarios de calificaciones 1–3

Seguir el patrón de RPCs `SECURITY DEFINER` ya usado en encuestas MNP (p. ej. discapacidad).

## Administración

Nueva vista en el dashboard de rematrícula, por periodo activo:

- Promedio de facilidad
- Distribución de respuestas 1–5
- Cantidad de respuestas
- Tasa estimada: respuestas / procesos finalizados del periodo
- Tabla o listado de comentarios asociados a 1, 2 y 3

Acceso: mismo criterio que las demás vistas administrativas de rematrícula (menú BO + perfil DVU/TI).

## Alcance

Incluye:

- Tarjeta en resumen del alumno
- Persistencia y API
- Vista de reporte administrativo

No incluye:

- NPS relacional de recomendación de UNIACC
- Encuesta por correo o SMS
- Modal bloqueante
- Flujo mock de staff (opcional dejarlo fuera en la primera entrega; el alumno real es el objetivo)

## Criterios de éxito

- El alumno puede omitir sin fricción y sigue pudiendo descargar el contrato.
- Quien responde una vez no ve de nuevo el formulario en ese periodo.
- El reporte administrativo muestra promedio, distribución, volumen y comentarios de notas bajas.
- La pregunta y la escala miden facilidad del proceso, no lealtad a la marca.

## Prueba

1. Alumno en resumen sin respuesta previa ve la tarjeta y puede omitirla.
2. Respuesta 5 se guarda sin pedir comentario; al volver solo aparece confirmación.
3. Respuesta 2 muestra comentario opcional; con o sin texto se guarda.
4. Segundo `POST` del mismo alumno/periodo es rechazado.
5. Vista admin muestra promedio, barras 1–5 y comentarios de 1–3 del periodo.
