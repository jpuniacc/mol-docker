# Deploy report — conversión `/gracias/` prod

**TS backup:** `20260904-1133`  
**Host:** `uniacccl-prod` (`puacsclwebuniacc`)  
**Origen:** `/opt/uniacccl-qa-docker/.../AstraChildTheme`

## Instalado

| Archivo | Acción |
|---------|--------|
| `assets/js/hs-native-forms.js` | replace (sha QA) |
| `assets/js/hs-malla-modal.js` | replace |
| `assets/js/hs-gracias-conversion.js` | new |
| `functions/HS-Funnel-Audit.php` | new |
| `functions/HS-Leads-Ajax.php` | replace |
| `functions/Core.php` | patch enqueue + flag true + ty6/ty4 |
| `functions.php` | require Funnel Audit |

## Smoke HTML (post-purge)

- IC: `hs-native-forms.js?ver=20260903-ty6` + `fireConversionOnGraciasDefault":"1"` + malla `ty4`
- Periodismo: mismos assets flag/ty6
- `/gracias/`: `hs-gracias-conversion.js?ver=20260903-ty6` (sin malla-modal)
- AJAX `guardar_lead_hs` / `uniacc_hs_funnel_log` → `-1` (registrados; nonce inválido esperado)

## GTM

Handoff: `docs/superpowers/plans/2026-09-04-gtm-cutover-gracias.md`  
Pendiente Go Point: Preview + reparar secuencia previousTag + publicar.

## Rollback

Restaurar `*.bak.20260904-1133` + borrar `hs-gracias-conversion.js` y `HS-Funnel-Audit.php` + purga cache.
