# Smoke — Bandeja seguimiento CORTE 1 (mol-dev)

## Pre
- Migración `20261106120000_seguimiento_bandeja_corte1.sql` aplicada en supabase-dev
- `uniacc-api` recreado con rutas `/api/rematricula/seguimiento/*`
- `mol-dev` rebuild

## Checklist
1. Ejecutivo (perfil 3): solo su cartera; pedir otro email → 403
2. Supervisor (1/2): ver todas; filtrar por email ejecutivo
3. Chip Forma de pago → subchip CAE → Abrir → Agregar contacto canal `llamada` → aparece en bitácora
4. Caso P (mat. Webpay, sin firma): retención **n/a**; botones envío disabled
5. Menú: **Seguimiento rematrícula** + Gestión Pagos + Gestión Firmas
6. Sin prod / sin Celmedia / sin enqueue outbox

## CORTE 2 (no en este corte)
Composer WYSIWYG+firma, From DVU/ejecutivo, enqueue al autorizar Webpay, scheduler 2h/24h, WhatsApp, copy wireframes 06/07.
