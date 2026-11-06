# Seguimiento rematrícula — CORTE 2 (composer + retención)

**Fecha:** 2026-11-06  
**Estado:** diseño aprobado (brainstorming)  
**Proyectos:** `mol-docker` (UI CRM) + `uniacc-api-docker` (API/envíos) + migraciones Supabase  
**Rollout:** **mol-dev / uniacc-desarrollo** only. No prod.  
**Wireframes:** `docs/wireframes/seguimiento-rematricula-v2/` (04–07 + `PROMPT-AGENTE-CURSOR-CORTE-2.md`)  
**Base UI:** CRM HubSpot-lite v5 (`docs/superpowers/specs/2026-11-06-seguimiento-rematricula-ux-v5-crm-design.md`)

## Problema

CORTE 1 dejó bandeja/indicadores de retención en lectura; el batch alumno-side escribe `mol_retencion_aviso` y la bandeja lee `mnp_retencion_outbox` (vacía). Falta envío manual Correo/SMS desde el drawer CRM y unificar retención automática hacia outbox con copy aprobado.

## Decisiones clavadas

| Tema | Decisión |
|------|----------|
| Montaje UI | Capas sobre CRM v5: Contactar ▾ en drawer (chips 1–7) |
| Fuente indicadores bandeja | **A:** `mnp_retencion_outbox` (única verdad) |
| `mol_retencion_aviso` | Solo histórico/lectura; batch **no** escribe más |
| Firma ejecutivo | Tabla PG `mnp_ejecutivo_firma` (email PK, bytea/mime) |
| From manual y T+2h | Email del **ejecutivo** de cartera; Reply-To = mismo |
| WhatsApp | Fuera (CORTE 3); botón «Próximamente» |
| Hotfix progreso | Track aparte; no mezclar |

## Arquitectura

### Front (`mol-docker`)

- Drawer CRM chips **1–7:** menú **Contactar ▾** → Correo | SMS | WhatsApp (disabled «Próximamente»).
- Chip **8 Matriculado U+:** sin Contactar ni envíos; solo Agregar nota + copy cerrado.
- Dialogs composer alineados a wireframes 04 (correo) y 05 (SMS).
- TipTap WYSIWYG: B/I/U, listas, enlace, deshacer; **nunca** HTML crudo editable.
- Firma: subir PNG/JPG o usar guardada (GET/PUT API).

### API (`uniacc-api-docker`)

| Endpoint | Rol |
|----------|-----|
| `POST /api/rematricula/seguimiento/casos/:codcli/enviar-correo` | Plantilla\|custom, asunto, HTML sanitizado, firma; From/Reply-To ejecutivo; bitácora |
| `POST /api/rematricula/seguimiento/casos/:codcli/enviar-sms` | Texto ≤139; Celmedia; bitácora |
| `GET/PUT /api/rematricula/seguimiento/ejecutivo/firma` | Firma por email de sesión |

Permisos: misma cartera CORTE 1 (perfil 3 forzado; 1/2 con filtro). Sin email/tel del caso → 400. Fuera cartera → 404/403. Fallo proveedor → 502 **sin** bitácora.

Reutilizar: `EmailService` (extender From/Reply-To por envío), `enviarSmsCelmedia` / `normalizarMovilSms`, `horaPermiteSmsChile`. **No** bypass SMS en caminos nuevos.

### Persistencia

- **`mnp_retencion_outbox`:** cola Mail 2h / SMS 24h (`pendiente|enviado|cancelado|error`). UNIQUE `(rut_norm, anio, semestre, tipo)`.
- **`mnp_seguimiento_contacto`:** envíos **manuales** → `origen=manual`, canal `correo|sms` (plantilla, asunto, preview en nota/campos).
- **`mnp_ejecutivo_firma`:** email PK, imagen ≤ ~500 KB, mime, `updated_at`.
- **`mol_retencion_aviso`:** no escribir; no usar para indicadores.

## Composer manual

### Correo

- Plantillas: Retención 2h · Recordatorio firma · Recordatorio forma de pago/arancel · Personalizado.
- De bloqueado = ejecutivo sesión; Para = `email_alumno` del caso enriquecido; CC default no.
- Al OK: bitácora canal `correo`.

### SMS

- Contador **139** chars; aviso tildes → UCS-2 / segmentos Celmedia.
- Ventana 09:00–21:00 America/Santiago (**igual que automáticos**).
- Al OK: bitácora canal `sms`.

## Retención automática

**Condición:** P = M (matrícula Webpay autorizada) && !F (firma incompleta). Cancelar pendientes si F completa. Nunca grabar pago temprano en U+.

**Batch** (scheduler existente, re-cableado a outbox):

1. Candidatos = lógica actual de retención (estado alumno).
2. Upsert outbox `mail_2h` (due T+2h) y `sms_24h` (due T+24h) en `pendiente` si no hay fila.
3. Vencidos: enviar → `enviado`+`sent_at`; error → `error`; sin contacto → `error`/`cancelado` + mensaje.
4. F completa → pendientes `cancelado`.
5. SMS solo si `horaPermiteSmsChile`.

**Copy** (reemplaza `rematricula-retencion-templates.ts`):

- Correo T+2h asunto: `¡Tu matrícula ya está pagada! Completa tu rematrícula 2027-1` + cuerpo wireframe 06 / PLAN.
- SMS T+24h (≤139):  
  `UNIACC: Tu matrícula 2027-1 está pagada, pero falta elegir forma de pago para tu arancel y firmar tu contrato. Completa aquí: …`  
  URL vía `REMATRICULA_RETENCION_URL_RETOMAR` (mol-dev vs prod sin hardcodear prod en dev).

**From automáticos:** email ejecutivo cartera (`mnp_cartera_oficial`); Reply-To = mismo.

Bandeja CRM: sin cambio de contrato de lectura (ya lee outbox).

## Tests

- Manual correo/SMS → bitácora + permisos cartera.
- Sanitización HTML (sin script / handlers).
- Batch: enqueue · envío 2h/24h · cancelación al firmar · idempotencia UNIQUE.
- Firma ejecutivo GET/PUT.
- From/Reply-To ejecutivo en mailer.

## Smoke mol-dev

1. Enviar correo/SMS a caso de **prueba** (no masivo a alumnos reales); dry-run/flag batch si aplica.
2. Verificar indicadores outbox en drawer + bitácora tras manual.
3. Opcional: capturas composers 04/05.

## Fuera de alcance

- WhatsApp real (**CORTE 3**).
- Deploy prod.
- Bypass SMS / commits de bypass.
- Hotfix progreso Webpay/`forma_pago_ok`.
- Dual-write o backfill obligatorio de `mol_retencion_aviso` → outbox (no requerido en este corte).

## Capas de implementación (orientativo)

1. Migración firma + grants outbox escritura service_role.
2. API firma + enviar-correo/sms + bitácora + tests.
3. Batch outbox + copy 06/07 + From ejecutivo + cancelación F.
4. UI Contactar + composers TipTap/SMS + firma.
5. Smoke mol-dev.

## Relación con otros tracks

- UX v5 CRM: base UI; este corte habilita Contactar real (excepto chip 8).
- CORTE 1: predicados chips y lectura outbox intactos.
- CORTE 3: WhatsApp.
