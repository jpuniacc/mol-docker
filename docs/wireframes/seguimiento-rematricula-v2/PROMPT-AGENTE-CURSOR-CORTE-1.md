# Prompt Cursor — Seguimiento rematrícula · CORTE 1

Usa `/usingsuperpowers`: brainstorming → writing-plans → specs → implementación en rama `dev` (luego merge a `qa` / `main` solo con OK explícito). **Solo CORTE 1.** No implementar composer de correo/SMS ni WhatsApp en este corte.

## Contexto
UNIACC MOL (Vue3/Vite/Tailwind/shadcn front `mol-docker` + API `uniacc-api-docker`). Trabajo solo en **uniacc-desarrollo / mol-dev**. No tocar prod (`uniacc-mol`) ni copiar commits con bypass SMS. Respaldo antes de cambios. Nunca mostrar secretos.

Wireframes + PLAN (fuente de verdad visual):
`/opt/mol-docker/docs/wireframes/seguimiento-rematricula-v2/`
- `01-bandeja-embudo-completo.png`
- `02-filtros-cartera-retencion.png`
- `03-panel-caso-bitacora.png`
- `PLAN.md`

(Composer 04/05 y automáticos 06/07 son CORTE 2 — solo lectura de contexto; no implementar UI de envío manual ni scheduler de retención aún, salvo dejar columnas/indicadores de Mail 2h y SMS 24h leyendo outbox si ya existe o stubs `n/a`/`pdte`.)

## Objetivo CORTE 1
Bandeja unificada de **toda la cartera del embudo** (no solo Pagos+Firmas) + panel de caso + bitácora de contacto + indicadores de retención 2h/24h (lectura).

### Embudo KPI (clicables)
1. Sin ingreso  
2. Ingresó (sin TyC)  
3. TyC OK · datos faltantes  
4. Datos OK · sin forma de pago  
5. Forma de pago — subchips: CAE · Beneficio min./gratuidad · Ambos · Resto (Webpay/pagaré pdte)  
6. Contrato / firma pendiente  
7. Firmado · pdte U+  
8. Matriculado U+  

Auxiliares: Sin contactar +7d · Mail 2h pdte/enviado · SMS 24h pdte/enviado.

### Cartera
Filtro por **email del ejecutivo** (mismo criterio que firmas/avisos de cartera). Ejecutivo ve solo lo suyo; rol supervisor (o equivalente existente) puede “Ver todas” + filtrar por ejecutivo. Columna Ejecutivo.

### Tabla
Alumno (nombre+RUT) · Carrera · Etapa · Subetapa F.pago · Mat. Webpay (sí/fecha) · Mail 2h · SMS 24h · Último contacto · Próxima acción · Ejecutivo · Abrir.

### Panel caso
Resumen contacto/medios/firmantes/ejecutivo · bloque “Retención automática” (estado correo 2h / SMS 24h si M&&!F, si no n/a) · botones: Enviar correo / Enviar SMS / WhatsApp **deshabilitados o “próximamente”** en este corte · Agregar nota habilitado · timeline bitácora (notas + eventos sistema si hay).

### Bitácora — tabla nueva
`mnp_seguimiento_contacto` (nombre a validar), append-only. No usar `mnp_caso_rematricula`. Campos orientativos: id, codcli/rut, anio/semestre, autor, canal (llamada|whatsapp|correo|sms|presencial|sistema|nota), origen (manual|auto), resultado, nota, respuesta_alumno, proxima_accion, proxima_accion_en, created_at. RLS staff.

Outbox retención `mnp_retencion_outbox` (mail_2h|sms_24h): **crear esquema** en este corte si encaja en el plan; el **scheduler de envío** es CORTE 2. La bandeja puede mostrar pdte/enviado/n/a según outbox o stub.

### Nombre / menú
**No** reutilizar `RematriculaSeguimientoView` (logs). Nueva vista p.ej. `BandejaSeguimientoRematriculaView` / ruta distinta. Menú: decidir en plan si reemplaza Gestión Pagos o coexiste (propuesta: nueva entrada; Firmas queda).

## Restricciones
- Condición retención P = M (matrícula Webpay autorizada) && !F (firma incompleta). **Nunca** grabar pago temprano en U+.
- Reutilizar criterios reales de progreso/KPI/gestión pagos/firmas/cartera; no inventar estados.
- API: árbol actual `/opt/uniacc-api-docker` (o repo equivalente). Front mol-docker.
- Flujo git: trabajar en `dev`.
- Tests para listado embudo, filtro cartera, CRUD nota, permisos ejecutivo vs supervisor.
- UI alineada a wireframes (naranja #FF5B00, navy).

## Entregables del agente
1. Plan + specs (superpowers) limitados a CORTE 1.  
2. Migración(es) + endpoints + vista + menú + tests.  
3. Notas de smoke en mol-dev (qué probar).  
4. Lista de archivos tocados.  
5. Lo que queda explícitamente para CORTE 2 (composer WYSIWYG+firma, envío Celmedia/Email From ejecutivo, scheduler 2h/24h con copy aprobado).

## Copy retención (referencia CORTE 2, no implementar envío aún)
Correo T+2h asunto: `¡Tu matrícula ya está pagada! Completa tu rematrícula 2027-1` (cuerpo en wireframe 06 / PLAN).  
SMS T+24h: `UNIACC: Tu matrícula 2027-1 está pagada, pero falta elegir forma de pago para tu arancel y firmar tu contrato. Completa aquí: mol.uniacc.cl` (139 chars; tildes → UCS-2 ~3 segmentos).

## Decisiones abiertas (preguntar una vez en el plan si bloquean)
- From de automáticos: DVU institucional (propuesto) vs ejecutivo.  
- ¿Reemplazar Gestión Pagos en menú?
