# Matricular desde la API cuando el contrato está completo

Fecha: 2026-10-21  
Proyectos: `uniacc-api-docker`, `mol-docker`  
Estado: implementado en código. El barrido corre al publicar la API.

## Problema

La firma del contrato no matricula. Hoy el navegador, al ver el contrato completo en TuFirma, arma el plan desde la sesión y llama a grabar. Si esa sesión no tiene el plan, U+ no recibe las cuentas ni el update de la ficha, y el KPI se queda en Contrato firmado.

Caso: Carlos Ademir Arévalo Madrid, RUT `15.608.279-1`, código `20251PSIC1VR015`, operación `981377`, periodo `2027-1`. TuFirma quedó completo y el log tiene `firma` / `firmado`. El borrador del servidor tiene el pagaré. No hay llamada a grabar ni evento `matricula` / `matriculado`.

Tamara Libertad Díaz Beltrami, código `20261DACO1DR009`, es otro caso: la grabación sí corre y U+ responde `Ya existe el beneficio en MT_POSBEN para este periodo.` Este diseño no cambia ese procedimiento. El barrido la va a intentar y, al rechazo, avisa una vez.

## Decisiones

| Tema | Decisión |
|------|----------|
| Quién decide y graba | La API. El navegador deja de armar el POST de grabación |
| Función | `matricularContratoFirmado` en `uniacc-api` |
| Escritura en U+ | La que ya hace `grabarPlanPagosErp`: cuentas y, si salen bien, ficha |
| Plan | Sale de `mol_borrador_rematricula`, no de la sesión del navegador |
| Carrera y RUT | Salen de `mnp_datos_alumnos` por el código académico |
| Caja | La del borrador. Si no trae una caja mayor que cero, `997` |
| Apoderado de la cuenta | RUT del alumno sin dígito verificador |
| Disparos | La consulta de estado de firma, y un barrido al partir el proceso y cada 2 minutos |
| Correo de error | Una vez por alumno y periodo, a Hans y Juan, con copia a `mol@uniacc.cl` |
| KPI | Pasa a Matriculado con el evento `matricula` / `matriculado`, y se refresca el embudo |
| Procedimientos de U+ | No se modifican |

La grabación sigue sujeta a la regla actual de `grabarPlanPagosErp`: solo corre en el ambiente TEST.

## Flujo

1. El alumno deja el plan en el borrador: pagaré, tarjeta o mixto.
2. Se envía el contrato a TuFirma. Firman el alumno y el sostenedor, o solo el alumno cuando el contrato no pide apoderado.
3. La API pregunta a TuFirma. Si el contrato está completo y el borrador tiene el plan, graba en U+ y actualiza la ficha.
4. Con la ficha confirmada, escribe `matricula` / `matriculado` y refresca el KPI. El alumno sale de Contrato firmado.
5. Si no se puede grabar, la ficha sigue abierta, el alumno sigue en Contrato firmado y sale un correo.

## Función

`matricularContratoFirmado` recibe el número de operación, el código académico y el periodo. La consulta de firma trae esos datos del request. El barrido los toma del evento `firma` / `firmado` (`payload.numOperacion`, `codcli`, año y semestre).

Pasos:

1. Pregunta a TuFirma si el contrato está completo para los firmantes de esa operación.
2. Lee `mol_borrador_rematricula` de ese código y periodo: pagaré (contrato, cuotas, fecha, montos y folios), medios, montos de tarjeta y beneficios.
3. Lee carrera (`codigo_carrera`) y RUT en `mnp_datos_alumnos`.
4. Arma la misma entrada que hoy arma la página: pagaré, mixto o ambos con tarjeta.
5. Llama a `grabarPlanPagosErp`. Si el plan ya está en U+, ese servicio cierra la ficha sin volver a crear las cuentas.
6. Si la ficha queda confirmada, refresca `refresh_mnp_progreso_rematricula` de ese año y semestre.

Se detiene antes de U+ cuando TuFirma no está completo, cuando el borrador no tiene pagaré ni pago con tarjeta, o cuando falta la carrera, el contrato, las cuotas o un folio.

## Disparos

La consulta `GET /api/rematricula/alumno/contrato/firma/:numOperacion`, cuando TuFirma responde completo, llama a la función antes de responder. La respuesta sigue trayendo el estado de TuFirma y agrega si la matrícula quedó actualizada o el motivo del fallo. Un rechazo de U+ no convierte esa consulta en HTTP 500.

El barrido vive en el mismo proceso de la API. Corre al partir y después cada 2 minutos. Toma alumnos con evento `firma` / `firmado` y sin evento `matricula` / `matriculado` en el mismo código y periodo, y llama a la misma función. Carlos entra por aquí.

Si la consulta y el barrido coinciden, corre una sola grabación por código y periodo. La otra espera el resultado. El cerrojo es del proceso.

## Errores

| Situación | U+ | Ficha | Correo |
|-----------|----|-------|--------|
| Faltan firmas y no existe `firma` / `firmado` | No se llama | Sigue abierta | No |
| Ya existe `firmado` y TuFirma no está completo, el borrador no tiene plan o falta un dato | No se llama | Sigue abierta | Una vez |
| U+ rechaza la grabación | Se intenta | Sigue abierta | Una vez |
| Las cuentas quedaron y falló el update de la ficha | El ciclo siguiente solo cierra la ficha | Sigue abierta hasta que cierre | Una vez, en el primer fallo |
| El ciclo siguiente cierra la ficha | No crea cuentas de nuevo | Cerrada | No hay segundo correo |
| Ficha confirmada | Ya grabado | Cerrada | No |
| El refresco del KPI falla después de confirmar la ficha | Ya grabado | Cerrada | No |

El intento rechazado por U+ queda en el log `cuenta` / `grabar`, con el mensaje del procedimiento. El barrido vuelve a intentar en el ciclo siguiente. Dentro del mismo ciclo no reintenta.

## Correo

Sale por `EmailService.enviarMailRematriculaAviso`.

- Para: `hans.vidal@uniacc.cl`, `juan.silva@uniacc.cl`
- Copia: `mol@uniacc.cl`

Un correo por alumno. Incluye nombre, RUT, código académico, carrera, periodo, número de operación, el plan que iba a grabar (medio, contrato, cuotas, montos y folios) y el motivo exacto, con fecha y hora de Chile.

La marca de avisado es un evento `log_mol_evento` con categoría `matricula` y acción `aviso_no_grabado`, para ese código, año y semestre. Se escribe después de que el envío sale bien. Un reinicio de la API no manda otro correo. Si el motivo cambia y el alumno sigue sin matrícula, no sale un segundo correo. Si el envío falla, no se escribe la marca y el ciclo siguiente lo intenta de nuevo.

Mientras el contrato sigue en espera de firmas, sin evento `firmado`, no se avisa.

## KPI

El embudo no cambia de regla. Contrato firmado es `firma` / `firmado` sin matrícula. Matriculado es el evento `matricula` / `matriculado`, o una fila en `mv_matriculados_sync` cuando esa vista existe.

Ese evento lo escribe `grabarPlanPagosErp` solo después de que `SP_MOL_ACTUALIZA_MATRICULA_FIRMADA` responde OK. Luego la API llama a `refresh_mnp_progreso_rematricula`. El tablero muestra al alumno en Matriculado en la siguiente lectura. Si el refresco falla, el evento ya está y el próximo refresco del tablero lo toma.

## Página

`FirmaAlumnoView` sigue consultando el estado de la firma. Deja de llamar a `postGrabarPlanPagos`. Cuando la respuesta dice que la matrícula quedó actualizada, avanza. Si trae un motivo, lo muestra.

## Fuera de alcance

- Corregir el rechazo `Ya existe el beneficio en MT_POSBEN para este periodo.`
- Modificar procedimientos de SQL Server.
- Habilitar la grabación del plan fuera de TEST.
- La página de prueba de Pixarrón.

## Pruebas

En la API, con TuFirma, el borrador, U+ y el correo simulados:

- Contrato sin todas las firmas: no llama a U+ y no envía correo.
- Borrador sin pagaré ni tarjeta, o con un dato obligatorio vacío, habiendo ya un `firmado`: no llama a U+ y envía un correo.
- U+ rechaza: la ficha sigue abierta, el intento queda en el log y sale un correo con el mensaje del procedimiento.
- El mismo alumno y periodo falla otra vez: se reintenta la grabación y no sale un segundo correo.
- El envío del correo falla: el ciclo siguiente lo reintenta. Cuando uno sale, no se repite.
- El plan ya está en U+ y solo faltaba la ficha: cierra la ficha y no envía correo.
- Ficha confirmada: existe `matricula` / `matriculado` y se pide el refresco del embudo.
- U+ rechaza: no existe ese evento.
- Dos llamadas a la vez por el mismo alumno: una sola grabación.

La consulta de firma, si U+ rechaza, responde el estado de TuFirma y el motivo, con HTTP 200.

En la página se comprueba que ya no arma el POST de grabación y que avanza cuando la API confirma la matrícula.

## Criterios de éxito

- Carlos, con TuFirma completo y el pagaré en el borrador, queda con cuentas en U+, ficha actualizada, evento `matricula` / `matriculado` y etapa Matriculado en el KPI, sin abrir el navegador.
- Un rechazo deja la ficha abierta, el KPI en Contrato firmado y un solo correo a Hans y Juan con copia a `mol@uniacc.cl`.
- La página de firma ya no envía el plan.
