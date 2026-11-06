# Retención tras pago matrícula — wireframes para revisión

Solo diseño. Inspección por SSH exclusivamente en uniacc-desarrollo; no se modificó front/API/BD/servidor ni se accedió a prod. No grabar pagos antes en U+. Todo desarrollo futuro requiere aprobación y respaldo previo.

## Hallazgos reales
Front `/opt/mol-docker`:
- `src/views/matricula-alumno/MatriculaAlumnoLayout.vue`: cabecera blanca, barra navy, acento naranja/magenta/azul; escritorio “Salir” y logo llevan a dashboard-home. En móvil, menú de cuenta tiene “Volver al inicio” y “Salir”; este último hace auth.logout ANTES de router.replace(login). Debe posponerse logout hasta confirmar. Carga borrador con `void sincronizarBorradorServidor` desde watch: añadir estado de hidratación awaitable antes de decidir reingreso.
- Vistas `DatosPersonalesAlumnoView.vue`, `FormaPagoAlumnoView.vue`, `FirmaAlumnoView.vue`, `ResumenAlumnoView.vue`. Pasos actuales Datos / Pago / Firma / Resumen; el micro-stepper Matrícula / Arancel / Firma es solo subflujo tras pago, no reemplazar silenciosamente el global.
- `WebpayRetornoAlumnoView.vue`: consulta obtenerWebpay(buy_order), guarda estado y detalle, arma voucher. `VoucherWebpayDialog.vue` ocupa pantalla con comprobante, Descargar voucher y Continuar, sin cierre por overlay/Escape. CTA actual sigue `siguientePaso`.
- `stores/matriculaAlumnoContext.ts`: medios, estados Webpay, pagoMatricula (plan), firmaCompletada y envioFirmaIniciado; sessionStorage y sincronización remota del borrador; flushBorrador cancela debounce, persiste payload y devuelve boolean.
- `utils/webpaySiguientePaso.ts`: contempla arancel cubierto (neto ≤0), Webpay, plan pagaré y firma. `utils/pasoAlumnoRematricula.ts`: bloquea volver a Datos/Pago tras enviar a firma y manda al resumen tras firma completa. Reutilizar estas reglas.
- `router/index.ts`: autenticación, permisos, guardas de alumno/mock y pasos. No encontré un mecanismo de retención beforeunload en el flujo inspeccionado.

API: revisar el árbol ACTUAL `/opt/uniacc-api-docker/src`, no confundir con la copia vieja `/opt/uniacc-api/src`.
- `services/email.service.ts`: EmailService.enviarMailRematriculaAviso y OTP, nodemailer; infraestructura correo existente.
- `services/celmedia-sms.service.ts`: enviarSmsCelmedia y normalización móvil; usado por `rematricula-contacto-otp.service.ts`. SMS existe como integración OTP. No se probaron credenciales, saldo ni entregabilidad.
- `rematricula-aviso-outbox.service.ts`, `rematricula-aviso-templates.ts`, `rematricula-aviso-scheduler.service.ts`: outbox/escaneo firma cada minuto, digest de cartera lun–vie 09:00/16:00 America/Santiago. No equivale a recordatorio alumno a 2/24h.
- WhatsApp automático no encontrado en los servicios inspeccionados. Nuevo canal, no prometerlo como disponible.

## Estado único propuesto (front y backend)
Usar identidad autenticada + codcli + periodo, nunca solo sessionStorage ni query del enlace.
M = última transacción matrícula Webpay confirmada por servidor con estado autorizada.
F = contrato verificado con TODOS los firmantes requeridos listos (`ready`), reconciliado con firmaCompletada. Si las fuentes discrepan: resolver antes de redirigir/enviar; no duplicar cobro.
P = M && !F && periodo activo y alumno elegible.
Arancel pendiente si neto confirmado >0 y (medioArancel == null OR (medioArancel=='webpay' && webpayArancelEstado!='autorizada') OR (medioArancel=='pagare' && pagoMatricula==null)). En caso pagaré, validar que el plan corresponde al concepto/período actual (no solo objeto cualquiera).
No tratar monto desconocido/null como cubierto: cargarlo o mostrar reintento.
Si neto ≤0 o Webpay arancel autorizada o plan pagaré válido: falta firma, NO pedir arancel otra vez.
Si envioFirmaIniciado: continuar Firma, consultar contrato; no volver a elegir medios.
Si F pero aún falla matriculación U+: resumen/estado “firma completa, cierre en proceso” y seguimiento operativo. Detener mensajes al alumno para evitar hacerlo repetir; esto no adelanta grabación del pago.
Pendiente de firma del sostenedor: adaptar copia/destinatario, sin pedir al alumno firmar de nuevo.

## 1. Beforeunload — 01-*.png
- Activa: P verificado y documento visible. Añadir listener solo mientras P; e.preventDefault y returnValue genérico.
- Ve: diálogo del navegador para cerrar/recargar/navegar fuera. No personalizable; captura ilustrativa, texto/idioma/botones varían.
- Desactiva: F, limpieza del componente, salida confirmada una sola vez o navegación intencional Webpay/TuFirma. No desarmar para navegación cualquiera sin confirmar.
- Archivos: nuevo `src/composables/useRetencionRematricula.ts` y MatriculaAlumnoLayout.vue. Restaurar listener si falla la transferencia externa.
- Límite: requiere activación por usuario, móvil/cierre proceso no garantizado, puede afectar bfcache; no ejecutar flush async ni enviar recordatorios dentro del unload.
- Métrica: tasa de abandono tras pago y recuperación de cohortes con listener (no medir “diálogo mostrado”: el navegador no lo confirma). Evento de intento no equivale a cierre real.

## 2. Modal router — 02-*.png
- Activa: P y navegación que abandona el contexto de rematrícula por Salir/logo/menú/atrás SPA; no al avanzar a Arancel/Firma/Resumen ni transferencias legítimas.
- Ve copia exacta solicitada si falta arancel; variante “Falta firmar tu contrato” si arancel listo. Primario Completar ahora; secundario Salir igual.
- Completar ahora: cancelar salida y resolver paso. Salir igual: await flush si hay cambios, conservar destino pendiente, bypass de UNA navegación; no borrar borrador. Si falla guardado: explicar y ofrecer reintento o salir igualmente, sin afirmar que el pago falló.
- Logout móvil: confirmar ANTES de auth.logout; de lo contrario guard no puede recuperar identidad. Salir escritorio hoy es dashboard, no cerrar sesión: respetar esa diferencia.
- Desactiva al F o tras confirmación puntual; resetear bypass incluso si navegación cancelada.
- Archivos: MatriculaAlumnoLayout.vue, router/index.ts (coordinación guard global con auth), nuevo modal y composable/estado retención compartido. No registrar guard duplicado por montaje.
- Límite: Atrás hacia otro documento del navegador no garantiza modal propio, cae en beforeunload. No atrapar al alumno ni romper enlaces a soporte/accesibilidad.
- Métrica: Completar ahora / modal mostrado y firma completa dentro de 24h; vigilar Salir igual y errores.

## 3. Retorno — 03-*.png y persistencia
- Activa solo para concepto matrícula y autorizada verificada. Rechazadas/abortadas conservan UI de fallo, no “pago recibido”.
- Ve Pago de matrícula recibido · Paso 1 de 3, micro-stepper ✓ Matrícula → Arancel → Firma, CTA grande Continuar con el arancel; comprobante secundario colapsable/descargable. Si siguientePaso retorna firma, CTA Continuar a la firma; si plan pagaré, continuar a plan; si ya firmó, Ver resumen.
- Desactiva al navegar al paso correcto o finalizar. Descargar no debe ocultar CTA ni marcar proceso completo.
- Archivos: WebpayRetornoAlumnoView.vue, VoucherWebpayDialog.vue (reusar detalle sin modal obligatorio para éxito), nuevo bloque progreso. Tests webpaySiguientePaso y de retorno.
- await flushBorrador: **en el dev inspeccionado YA está implementado**: guardarEstadoConcepto retorna Promise<boolean> de flushBorrador; onMounted hace await guardarEstadoConcepto(fila); avanzarSiAutorizada hace await asegurarBorradorPersistido antes de ruta y antes de submit externo. No volver a “corregir” agregando flush duplicado. Pendiente: si persistido=false el montaje actual solo console.warn y sigue mostrando voucher. Mostrar recuperación visible; mantener prueba de no redirigir hasta flush exitoso (o reconciliación servidor). Añadir prueba contra cierre justo tras autorización.
- No confiar en ese flush para un alumno que nunca vuelve de Webpay: el scheduler debe partir de transacción backend autorizada del callback/commit (no de la visita al voucher).
- Límite: confirmación/guardado con red lenta; no confundir fallo de borrador con rechazo del pago. Nunca cobrar matrícula otra vez.
- Métrica: continuar_ok / retornos matrícula autorizada y firma dentro de 24h; errores de persistencia.

## 4. Recordatorios — 04-*.png
- Propuesta mostrada: correo + SMS disponibles como canales, con versiones a 2 y 24h. NO son cuatro envíos aprobados; decidir combinación/cap (recomiendo correo 2h + SMS 24h si sigue pendiente; fallback correo si no hay móvil válido).
- Activa: a partir de authorized_at/fecha transacción backend; >=2h o >=24h && P revalidado justo antes del envío. Verificar estado real arancel/contrato, monto, periodo y elegibilidad. No exigir que exista borrador si hay pago autorizado: reconstruir/conciliar con identidad de servidor.
- Ve copia contextual “Falta arancel y firma”, “Falta firma” o “Falta firma de sostenedor”, según dato actual. PNG muestra caso arancel vacío; no usar esa copia en otros estados.
- Enlace nuevo `/retomar` (ejemplo mol.example.com, no operativo): login estándar si hace falta, redirect conservado y resolución server-side tras autenticar; no ruta con RUT/email ni token con permiso de pago/firmar. Nunca enviar enlace de firma del sostenedor al alumno.
- Desactiva: F, baja/inhabilitación/periodo no vigente, contacto inválido/opt-out según política; cancelar restantes. Contrato enviado pero no firmado NO desactiva si sigue pendiente; adaptar al firmante faltante.
- Archivos: nuevos API `services/rematricula-retencion.service.ts` y templates; extender outbox/scheduler existentes, email.service.ts para plantilla, adaptar SMS Celmedia para recordatorio. Migración futura de log/outbox con clave única (codcli,periodo,pago,ventana,canal) y fechas; aprobación previa. Reutilizar contactos validados OTP, no destinos desde browser. Ningún envío en este trabajo.
- Reintentos acotados, dedupe/concurrencia, colas con horario America/Santiago (p.ej. 09–20, decidir), excluir alumnos aún activos recientemente (heartbeat opcional por aprobar) y revalidar antes del despacho. Horario nocturno aplaza, no duplica. Fuera de servicio/saldo SMS: registrar y fallback aprobado, sin bypass OTP.
- Límite: canales existentes ≠ automatización lista. SMS longitud/segmentos y costo a validar; WhatsApp requiere integración, consentimiento y plantilla aprobada. No se verificó config runtime.
- Métrica: entregados, clicks autenticados y cierre de firma en 24/48h por cohorte/ventana/canal vs control; costo por cierre incremental, rebotes y quejas.

## 5. Reingreso — 05-*.png
- Activa: login/landing después de esperar hidratación y reconciliación remota, si P. Banner de recuperación al llegar al paso; router.replace al resolver (sin cuenta regresiva engañosa).
- Ve Tu matrícula ya está pagada, falta paso X, Retomar mi rematrícula; destino Arancel o Firma según siguientePaso. Si ya F, resumen sin alarma. Si sin señal M, flujo normal; si servidor falla, estado de verificación con Reintentar, no nuevo cobro.
- Desactiva: F o resolución de P; banner permanece contextual mientras termina, no vuelve a redirigir dentro de flujo permitido. Respetar ruta de soporte y auth.
- Archivos: MatriculaAlumnoLayout.vue (watch awaitable), dashboard/home/HomeView.vue (banner alumno), router/index.ts (retomar/login redirect), utils/webpaySiguientePaso.ts (reusar), store matriculaAlumnoContext.ts (estado de hidratación) y nuevo resolver compartido. Validar carrera/periodo de sesión antes del replace.
- Límite: borrador obsoleto, varias pestañas/dispositivos, saldo cero, contrato en progreso y retraso U+ requieren datos servidor, no heurística de browser.
- Métrica: reingresos P que llegan al paso correcto, firma dentro de 24h, bucles de router = 0, pagos duplicados = 0.

## Validación antes de implementar
Pruebas: matrícula autorizada sin retorno; arancel null / webpay pendiente / autorizado / pagaré con y sin plan / cubierto / monto desconocido; firma alumno y sostenedor; contrato enviado, firmado, firmado con error U+; logout móvil; atrás interno/externo; refresh; multi-tab; red caída al flush; link expirado/otro alumno; doble scheduler; envío nocturno y cierre entre encolado y despacho. Piloto en dev primero, respaldo de archivos/BD antes de cualquier cambio. Sin prod, sin adelantar U+.

## Decisiones
1. Aprobar copy y secuencia CTA/modal sin bloquear salida.
2. Canal/cadencia/cap: correo 2h + SMS 24h recomendado; no enviar ambas vías ambas horas por defecto.
3. Horario SMS y política consentimiento/contactos/fallback; medir costo/segmentos.
4. Dominio real y ruta /retomar; login obligatorio, sin tokens de firma en mensajes.
5. Cuándo considerar completado: firma completa vs matrícula U+ confirmada. Recomendación: detener presión al firmar, gestionar cierre U+ como incidente operativo.
6. Alcance: empezar retorno+persistencia+reingreso (alto valor), luego modal/unload y piloto recordatorios; alternativa solo recordatorios es menos efectiva y más costosa.
