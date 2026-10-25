# Diseño: roll-out conversión en `/gracias/` a producción

**Fecha:** 2026-09-04  
**Ambiente destino:** `uniacccl-prod` (`www.uniacc.cl`)  
**Origen validado:** `uniacccl-qa-docker` (`qasitioweb3.uniacc.cl`)  
**Relacionado:** `2026-09-03-gracias-conversion-carreras-design.md`, `mol-docker/docs/marcacion-conversion-gracias-plan-ejecutivo.md`

## Objetivo

Migrar a producción el comportamiento ya validado en QA:

1. Conversión de campaña (`registro_confirmado_servidor`) **solo** en `/gracias/`.
2. Redirect rápido (~100 ms) tras OK de HubSpot.
3. Save del lead **async** (`fetch` + `keepalive`), completable en `/gracias/` si no alcanzó.
4. Malla: PDF en paralelo al redirect + conversión en `/gracias/`.
5. Ajuste GTM coordinado el mismo día (contenedor `GTM-NS5SPR`).

## Alcance

| Incluye | Excluye |
|---------|---------|
| Child theme: JS HS + `Core.php` / `functions.php` / `HS-Leads-Ajax` / `HS-Funnel-Audit` | Docker, compose, puertos DB |
| Purga cache nginx fastcgi + Redis en prod | `.htaccess`, regeneración CSS Elementor |
| Coordinación / publicación GTM triggers `generate_lead` | `template-gracias-fast.php` / hijack por slug |
| Smoke prod + monitoreo 24–48h | Replaces de URL QA↔prod, embeds Elementor |

## Decisiones

| Tema | Decisión |
|------|----------|
| Activación | `fireConversionOnGraciasDefault => true` en prod (corte full, no flag off) |
| Deploy de PHP grandes | Parche quirúrgico en `Core.php` y `functions.php` (no overwrite ciego) |
| Archivos JS/Ajax/Audit | Copia íntegra desde QA |
| GTM | Mismo corte que el theme; Preview en evento `registro_confirmado_servidor` |
| `/gracias/` UI | Elementor existente (sin template fast) |
| Auditoría funnel | Incluir `HS-Funnel-Audit.php` + tabla `acc_uniacc_hs_funnel_events` |

## Arquitectura (prod = QA)

```
HS submit OK
  → sessionStorage token (+ pending_save)
  → si downloadUrl: PDF ya
  → setTimeout ~100ms → /gracias/
  → fetch guardar_lead_hs (keepalive)
  → /gracias/ (hs-gracias-conversion.js)
      → completar AJAX si falta
      → dataLayer.push registro_confirmado_servidor 1×
      → consumed (no doble en refresh)
```

Payload dataLayer relevante para GTM: clave `form_id` (= `gtm_form_id`, default `formulario_general`).

## Archivos

| Archivo | Acción en prod |
|---------|----------------|
| `assets/js/hs-native-forms.js` | Reemplazar desde QA |
| `assets/js/hs-malla-modal.js` | Reemplazar desde QA |
| `assets/js/hs-gracias-conversion.js` | Nuevo |
| `functions/HS-Funnel-Audit.php` | Nuevo |
| `functions/HS-Leads-Ajax.php` | Reemplazar desde QA |
| `functions/Core.php` | Parche enqueue + localize + versiones |
| `functions.php` | `require_once` Funnel Audit |

## Criterios de éxito

1. Carrera: 1× `registro_confirmado_servidor` en `/gracias/`; 0 en página form.
2. Malla: redirect `/gracias/` + PDF; misma marcación.
3. Refresh gracias: sin segundo evento.
4. `/gracias/` directo: sin conversión.
5. `GA4 | generate_lead` (y Ads/Meta asociados) disparan en Preview sobre el custom event.
6. Lead en `acc_uniacc_hs_leads`; opcional cadena funnel.

## Rollback

Restaurar `.bak.YYYYMMDD-HHMM` + purga cache + republish GTM versión previa (&lt; 30 min).

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| GTM desalineado → conteo 0 o doble | Deploy + publish mismo día; Preview obligatorio |
| Variable `form_id` vacía en `/gracias/` | Payload PHP ya incluye `form_id`; validar en Preview |
| Cache HTML viejo | Purga `/var/cache/nginx` + Redis `FLUSHDB` |
| CRM ≠ ads | Esperado: deal HS al submit; ads solo si llega a gracias |
