# Smoke CORTE 2 — composer + retención outbox

**Fecha:** 2026-11-07  
**Plan:** `docs/superpowers/plans/2026-11-07-seguimiento-rematricula-corte2.md`

## Seguridad envíos automáticos

- `RETENCION_OUTBOX_DRY_RUN=1` (default en mol-dev) → batch **no** envía a alumnos reales; solo enqueue/log.
- Envío real acotado: `RETENCION_OUTBOX_DRY_RUN=0` + `RETENCION_OUTBOX_RUTS=<rut_prueba>`.
- **Sin backfill** `mol_retencion_aviso` → outbox: casos avisados por el job viejo pueden verse n/a/pdte hasta el próximo ciclo.

## From

- Manual = email de **sesión**.
- Auto = ejecutivo de **cartera**.
- SMTP: `SEGUIMIENTO_FROM_MODE=relay_reply_to` (plan B) hasta probar From directo (SPF). Probe SMTP pendiente de buzón interno.

## Checklist UI (login BO)

1. Chip ≠ 8: Contactar ▾ → Correo / SMS; WhatsApp «Próximamente»
2. Enviar correo prueba → bitácora
3. Enviar SMS (09–21 Santiago) → bitácora  
4. Chip Matriculado: sin Contactar
5. Outbox dry-run: filas pendiente sin spam masivo

## CORTE 3

WhatsApp real.
