# Prompt Cursor — Seguimiento rematrícula · CORTE 2

Usa `/usingsuperpowers`: brainstorming → writing-plans → specs → implementación en rama **`dev`**. **Solo CORTE 2.** No WhatsApp real (botón sigue “próximamente”). Aplicar **después** (o en paralelo solo si no choca) de los ajustes UI v3 si aún no están en `dev`.

## Contexto
UNIACC MOL (Vue3/Vite/Tailwind/shadcn front `mol-docker` + API `uniacc-api-docker`). Solo **uniacc-desarrollo / mol-dev**. No tocar prod. Respaldo antes de cambios. Nunca mostrar secretos. Git: `dev` → `qa` → `main` con OK explícito.

CORTE 1 hecho: bandeja embudo + cartera + panel + bitácora + indicadores 2h/24h (lectura).  
Ajustes UI v3 (si pendientes): `docs/wireframes/seguimiento-rematricula-v3-ajustes/PROMPT-AGENTE-CURSOR-AJUSTES-UI-V3.md`.


## Contexto UI actual (post UX v5 CRM — ya en `dev`)
La bandeja es CRM HubSpot-lite (`docs/wireframes/seguimiento-rematricula-v5-crm/`): lista/board + drawer.
- Composer Correo/SMS desde drawer: menú **Contactar ▾** (chips 1–7).
- Chip **Matriculado U+**: sin Contactar ni envíos; solo Agregar nota.
- Reemplazar “Próximamente” de Contactar por Correo/SMS reales; WhatsApp sigue “próximamente”.
- Wireframes composer: 04–07 en `seguimiento-rematricula-v2/`.

## Decisión From (cerrada 2026-11-06)
**From automáticos T+2h = email del ejecutivo** (igual que envíos manuales). No DVU institucional. Reply-To coherente con el ejecutivo.

## Wireframes (fuente visual)
`/opt/mol-docker/docs/wireframes/seguimiento-rematricula-v2/`
- `04-composer-correo-plantillas.png` — composer correo + plantillas + WYSIWYG + firma imagen
- `05-composer-sms.png` — composer SMS 139 chars
- `06-correo-automatico-2h-preview.png` — copy correo T+2h
- `07-sms-automatico-24h.png` — copy SMS T+24h
- `PLAN.md` · este prompt

## Objetivo CORTE 2
1. **Envío manual** desde el panel: correo y SMS → bitácora `mnp_seguimiento_contacto`.
2. **Retención automática** T+2h correo / T+24h SMS cuando P = M (matrícula Webpay autorizada) && !F (firma incompleta); cancelar si F se completa antes. Nunca grabar pago temprano en U+.
3. Unificar / alinear lo que **ya existe** en API con lo del corte 1 (ver “Estado actual”).

## Estado actual en el código (no reinventar)
Ya hay retención alumno-side y batch:
- `rematricula-retencion.service.ts` → `procesarRetencionBatch`
- `rematricula-retencion-scheduler.service.ts` (arranca en `index.ts`)
- `rematricula-retencion-templates.ts` (asunto/cuerpo/SMS **distintos** del copy aprobado en wireframes 06/07)
- Persistencia histórica: tabla **`mol_retencion_aviso`** (ventana 2h|24h × canal correo|sms)
- Bandeja CORTE 1 lee **`mnp_retencion_outbox`** (tipo mail_2h|sms_24h, estados pendiente|enviado|cancelado|error) — hoy vacía / sin enqueue desde el batch

**Decisión de diseño obligatoria en el plan:** una sola fuente de verdad para indicadores de la bandeja.
- Opción A (preferida): el batch existente escribe también (o migra a) `mnp_retencion_outbox` y la bandeja sigue leyendo outbox.
- Opción B: la bandeja pasa a leer `mol_retencion_aviso` (+ estados derivados) y se depreca outbox.
Documentar migración/compatibilidad; no dejar dos verdades.

Reutilizar: `EmailService`, `enviarSmsCelmedia` / `normalizarMovilSms`, `horaPermiteSmsChile` (SMS solo 09:00–21:00 America/Santiago).

## Composer manual (UI + API)
### Correo
- Plantillas: Retención 2h · Recordatorio firma · Recordatorio forma de pago/arancel · Personalizado.
- Editor **WYSIWYG** (B/I/U, listas, enlace, deshacer). **Nunca** HTML crudo editable por el usuario.
- Firma = **imagen** (subir PNG/JPG o usar la guardada por email del ejecutivo). Guardar firma asociada al ejecutivo.
- **From** de envíos manuales = email del **ejecutivo** (bloqueado / no editable). Reply-To coherente con eso.
- Destinatario = correo del alumno del caso; CC opcionales solo si el plan lo justifica (default: no).
- Al enviar OK: insertar contacto en bitácora (canal `correo`, origen `manual`, plantilla, asunto, preview cuerpo).

### SMS
- Contador 139 caracteres (copy wireframe 05).
- Tildes → UCS-2 (~2–3 segmentos Celmedia); el servicio ya normaliza/alfabeto Celmedia — respetar contrato existente.
- Al enviar OK: bitácora canal `sms`, origen `manual`.

### Botones panel
Habilitar “Enviar correo” / “Enviar SMS”. WhatsApp permanece deshabilitado “próximamente”.

## Retención automática
### Copy aprobado (reemplazar el de `rematricula-retencion-templates.ts` si difiere)
**Correo T+2h**
- Asunto: `¡Tu matrícula ya está pagada! Completa tu rematrícula 2027-1`
- Cuerpo: el de wireframe `06` / PLAN (pago recibido, no volver a pagar, falta forma de pago arancel y/o firma, CTA retomar, aviso de login / no pedimos claves).

**SMS T+24h** (≤139 chars; ver wireframe 07):
`UNIACC: Tu matrícula 2027-1 está pagada, pero falta elegir forma de pago para tu arancel y firmar tu contrato. Completa aquí: mol.uniacc.cl`

(Ajustar URL retomar con `REMATRICULA_RETENCION_URL_RETOMAR` / mol-dev vs prod sin hardcodear prod en dev.)

### Reglas
- Condición P = M && !F; cancelar pendientes si F completa.
- Idempotencia por alumno+periodo+tipo/ventana+canal.
- Encolar / disparar sin romper el scheduler existente.
- **From automáticos:** preguntar una vez en el plan si bloquea — **DECIDIDO: email del ejecutivo** (igual que manuales); no DVU. Misma casilla From para automáticos y manuales.

## Endpoints orientativos (validar nombres en plan)
- `POST .../casos/:codcli/enviar-correo` (plantilla|custom, asunto, html sanitizado, adjunto firma)
- `POST .../casos/:codcli/enviar-sms` (texto)
- Firma ejecutivo: GET/PUT recurso por email sesión
- Jobs: reutilizar scheduler; tests de batch + cancelación

## Restricciones
- No bypass SMS (`OTP_SMS_BYPASS_SIN_SALDO` / commits de bypass) en caminos nuevos.
- No desplegar a prod ni copiar árbol completo.
- Tests: envío manual → bitácora; batch 2h/24h; cancelación al firmar; permisos cartera; sanitización HTML.
- UI alineada a wireframes 04–07 (naranja `#FF5B00`).

## Entregables
1. Spec + plan CORTE 2 (superpowers) con decisión outbox vs `mol_retencion_aviso` y From automáticos.
2. Migraciones si hacen falta + API + UI composer + firma ejecutivo + copy actualizado.
3. Smoke mol-dev: enviar correo/SMS de prueba a caso de cartera propia; verificar bitácora; simular/inspeccionar retención (sin spamear alumnos reales — usar flags/dry-run o alumno de prueba).
4. Lista de archivos tocados.
5. Explicitar CORTE 3 = WhatsApp.

## Decisiones abiertas (una pregunta en el plan si bloquean)
1. From de automáticos: **CERRADO → ejecutivo** (igual que manuales).  
2. Fuente de verdad indicadores bandeja: unificar outbox ↔ `mol_retencion_aviso`.
