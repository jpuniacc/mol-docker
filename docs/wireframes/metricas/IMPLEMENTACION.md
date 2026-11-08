# Métricas de seguimiento — DEV

## Decisiones implementadas
- Atribución **autor del contacto**, nunca dueño vigente en agregados. Reasignar cartera no borra su actividad. Los casos del drill-down y registro de respuestas sí exigen acceso vigente al caso/período.
- Consejero perfil 3: solo propio. Jefatura perfiles 1/2: selector propio/todos/autor y comparativa. Mismo menú/grupos/guard que Seguimiento; no nuevos permisos de grupo.
- Contactos manuales por correo/SMS/WhatsApp/llamada/nota; presencial en Otros. Una próxima acción multicanal no multiplica contactos. Casos distintos no sumables entre autores/canales.
- Respuesta manual vinculada a UUID de contacto saliente (incluye llamada): numerador por contacto único respondido dentro de siete días civiles en America/Santiago / contactos salientes instrumentados del rango. Fecha no futura ni anterior al contacto; una respuesta por contacto. Sin vínculo se registra timeline, pero no afecta tasa. No inferir respuesta ni entrega desde SMTP, pago, firma o lectura.
- Corte estable de instrumentación en tabla config. Contactos existentes y nuevos backdated anteriores al corte: N/D, excluidos del denominador; cobertura/históricos visibles. Ventanas todavía abiertas se señalan parciales, sin convertir históricos en fracasos.
- Respuesta auditable por registrador/canal/fecha/comentario opcional; UUID de petición idempotente. Repetición idéntica devuelve existente; conflicto 409, nunca sobrescribe. No transporte ni scheduler nuevo.
- Hito: comparación real de etapa previa contra resultado del refresh, ON CONFLICT por caso/período. Línea base existente y recién aparecidos matriculados excluidos. Autor congelado = último contacto manual anterior a observación, o sin autor; es atribución operativa, no causal ni fecha oficial ERP. No trigger sobre DELETE/INSERT. TTL/advisory lock/RUT/Webpay existentes se conservan.
- Stock actual pendiente/vencida/hoy y casos actualmente matriculados con actividad del autor separado de flujos del rango (contactos, terminales por gestionada_en, hitos por detectado_en). Fecha local vence al finalizar día. No reconstrucción histórica de stock.
- Fechas reales, período obligatorio y rango hasta 366 días; SQL parametrizado. Resumen/serie en una consulta de lectura, agregación por conjuntos; sin cache persistente ni N+1 HTTP por consejero. Refresh único con TTL al consultar resumen.
- CSV exclusivamente agregado, con filtros/zona/corte, N/D y neutralización de fórmulas; sin RUT/teléfono/cuerpos/comentarios de alumnos.

## Menú y API
Rematrícula → **Métricas de seguimiento** (`/dashboard/metricas-seguimiento`). Roles/grupos copiados del item Seguimiento.
GET `/api/rematricula/seguimiento/metricas/{resumen,serie,consejeros,casos}`. Filtro `autor` explícito, no `emailEjecutivo` de dueño. Consejeros/casos paginados; casos filtrados por cartera vigente para perfil 3.
POST `/api/rematricula/seguimiento/casos/:codcli/respuestas?anio=…&semestre=…` únicamente registra, no envía mensajes. Drawer → **Alumno respondió**, disponible también en casos matriculados.

## Seguridad y despliegue
Migración aditiva `20261107234438_seguimiento_metricas_autor_respuesta.sql`, aplicada transaccionalmente en DEV. Tres tablas privadas nuevas con RLS y REVOKE PUBLIC/anon/authenticated; las 24 operaciones básicas de ambos roles deben ser denegadas. Acceso de API por pool existente y alcance explícito.
Se conserva el perímetro de sesión X-Mol heredado; no es autenticación criptográfica nueva. Endurecer ese perímetro global queda fuera de este cambio.
No envíos reales ni activación del digest. `SEGUIMIENTO_AVISOS_ENABLED` permanece false/default deshabilitado.

## Reproducción y evidencias
Backup: `/opt/mol-docker/backups/metricas-20261107` (fuentes, dumps, función anterior e imágenes etiquetadas).
`npm test` en API; `vitest run src --exclude '**/backups/**'` en front; `npm run type-check` compara los 80 diagnósticos globales preexistentes del front, exige cero adicionales. API tsc sin errores.
Script `src/scripts/seguimiento-metricas-verificar.ts`: transacción + ROLLBACK siempre, 67 comprobaciones (autor/reasignación, multicanal/casos, N/D, agenda, respuestas idempotentes, siete días/DST, bloque real de hitos y RLS), más 10.000 contactos sintéticos para tiempo de consulta. Ninguna persistencia ni transporte.
Logs y resultados en backup. No se afirma revisión visual táctil/pixel-perfect ni carga masiva productiva; fixtures SQL/DOM y build no sustituyen UAT móvil.

## Límites intencionales
- No webhooks ni lectura automática de conversaciones; WhatsApp/llamadas/respuestas son registros manuales.
- Sin SLA de matrícula ERP; hito solo al observar refresh. Sin cron adicional.
- Los PNG del plan son ejemplos, no capturas autenticadas de esta implementación.
- Los planes PLAN.md permanecen sin commit conforme instrucción anterior; este documento sí describe la implementación aprobada posterior.
