# Seguimiento rematrícula v2 — bandeja unificada (PROPUESTA / NO IMPLEMENTADO)
Reemplaza el alcance de `../seguimiento-rematricula/PLAN.md` (que cubría solo Pagos+Firmas). Wireframes: `gen.py` → `html/` + PNG. Datos ficticios.

## Cambios de alcance vs. v1
- **Embudo completo** (8 KPI): Sin ingreso · Ingresó sin TyC · TyC OK/datos faltantes · Datos OK/sin forma de pago · Forma de pago (subetapas: CAE · Beneficio min./gratuidad · Ambos · Resto Webpay/pagaré pdte) · Firma pendiente · Firmado pdte U+ · Matriculado U+.
- KPI auxiliares: Sin contactar +7d · Mail 2h pdte/enviado · SMS 24h pdte/enviado.
- **Cartera = email del ejecutivo** (el mismo de firmas/avisos). El ejecutivo ve solo su cartera; el supervisor tiene “Ver todas” + filtro por ejecutivo. Columna Ejecutivo.
- **Retención automática (fase 2 de la salida)**: tras matrícula Webpay autorizada, si aún M && !F → correo a las **T+2h** y SMS a las **T+24h**. Se cancela si se completa F antes. Copy exacto en 06/07.
  - **Decisión pendiente**: From de los automáticos = DVU institucional (propuesto) vs. ejecutivo. Envíos manuales desde la bandeja = From del ejecutivo (bloqueado).
- La bandeja muestra el estado Mail 2h / SMS 24h (✓ enviado+fecha / — pdte / n/a).
- **Composer manual**: plantillas (Retención 2h, Recordatorio firma, Recordatorio forma de pago/arancel, Personalizado), editor WYSIWYG (B/I/U, listas, enlace, deshacer; nunca HTML crudo) y firma como imagen (subir PNG/JPG o usar la guardada).
- SMS: 139 caracteres. Por las tildes se codifica en UCS-2 (70/67 por segmento) → ~2–3 segmentos en Celmedia; sin tildes (GSM-7) es 1 segmento.

## Datos
- `mnp_seguimiento_contacto` (append-only): id, codcli/rut, periodo, canal (nota|correo|sms|whatsapp|sistema), origen (manual|auto), ejecutivo_email, plantilla, asunto, cuerpo, estado, próxima_accion, created_at.
- `mnp_retencion_outbox`: rut, periodo, tipo (mail_2h|sms_24h), due_at, estado (pendiente|enviado|cancelado|error), sent_at, provider_id, error. Idempotente por (rut, periodo, tipo).
- Firma del ejecutivo: imagen guardada por email del ejecutivo.

## Cortes
1. Bandeja (embudo completo + cartera) + panel + bitácora + indicadores 2h/24h (scheduler/outbox).
2. Envío manual de correo/SMS (plantillas, WYSIWYG, firma) → bitácora.
3. WhatsApp (botón deshabilitado “próximamente”).

No implementar código: solo wireframes. Stamp “DATOS FICTICIOS · PROPUESTA / NO IMPLEMENTADO”.
