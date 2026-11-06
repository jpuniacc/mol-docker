# Export CSV leads HS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enviar por correo un CSV de `acc_uniacc_hs_leads` en prod: bootstrap acumulado total; lun-vie 08:00 CL solo leads del día anterior.

**Deployed:** 2026-08-31 prod (`uniacccl-prod`)

## Estado deploy

- [x] `functions/HS-Leads-Export.php` en AstraChildTheme
- [x] `scripts/export-hs-leads.php` (WP-CLI entry)
- [x] `functions.php` require añadido
- [x] Bootstrap `--full`: 182 filas → `flozada@martech.cl`
- [x] Cron `/etc/cron.d/uniacc-hs-leads-export` lun-vie 08:00
- [x] Smoke daily: 40 filas (2026-08-30)
- [x] CSV = `SELECT * ... ORDER BY id DESC` (41 columnas)
**Asunto:**
- Acumulado: `Formularios HubSpot en Uniacc.cl al YYYYMMDD - acumulado total`
- Diario mar–vie: `Formularios HubSpot en Uniacc.cl al YYYYMMDD - nuevos del YYYYMMDD` (día anterior)
- Diario lunes: `Formularios HubSpot en Uniacc.cl al YYYYMMDD - nuevos del YYYYMMDD al YYYYMMDD` (vie–dom)

## Diccionario de campos (Excel / tabla)

| Campo | Significado |
|--------|-------------|
| `id` | ID interno del lead en la BD local |
| `created_at` | Fecha/hora de guardado local post-envío |
| `form_id_hs` | ID del formulario HubSpot |
| `portal_id` | Portal HubSpot (`51464408`) |
| `region` | Región embed HS (`na1`) |
| `page_id` | ID página WordPress |
| `page_url` | URL de la página al enviar |
| `form_context` | `carrera_hero` o `descarga_malla` |
| `firstname` | Nombre |
| `lastname` | Apellido(s) |
| `email` | Correo |
| `phone` | Teléfono |
| `rut` | RUT / documento |
| `programa_codigo` | Código carrera/programa |
| `tipo_programa` | Tipo (ej. pregrado) |
| `categoria_programa` | Categoría (ej. diurno, advance) |
| `modalidad` | Modalidad (ej. DIURNA, A_DISTANCIA) |
| `extras_json` | Campos extra del form (JSON) |
| `utm_source` | UTM source |
| `utm_medium` | UTM medium |
| `utm_campaign` | UTM campaign |
| `utm_term` | UTM term |
| `utm_content` | UTM content |
| `gclid` | Google Ads click ID |
| `gad_source` | Google Ads `gad_source` |
| `gbraid` / `wbraid` | Atribución Google Ads |
| `fbclid` | Meta/Facebook click ID |
| `msclkid` | Microsoft Ads click ID |
| `ttclid` | TikTok click ID |
| `twclid` | Twitter/X click ID |
| `organic_source` / `organic_medium` | Fuente/medio orgánico |
| `landing_page` | Landing de la sesión |
| `referrer` | Referrer HTTP |
| `hutk` | Cookie HubSpot visitor |
| `hs_response` | Respuesta HS (JSON técnico) |
| `datalayer_payload` | Payload GTM (JSON) |
| `datalayer_pushed_at` | Timestamp armado dataLayer servidor |
| `ip` | IP del visitante |
| `user_agent` | User-Agent del navegador |

## Configuración

| Item | Ubicación |
|------|-----------|
| Destinatarios | `/etc/uniacc/hs-leads-export.env` |
| Wrapper cron | `/usr/local/bin/uniacc-hs-leads-export.sh` |
| Log | `/var/log/uniacc-hs-leads-export.log` |
| Bootstrap flag | WP option `uniacc_hs_leads_export_bootstrap_done` |

## Comandos manuales

```bash
# Acumulado total (re-bootstrap)
wp eval-file wp-content/themes/AstraChildTheme/scripts/export-hs-leads.php full --path=/usr/share/nginx/public_html

# Día anterior
wp eval-file wp-content/themes/AstraChildTheme/scripts/export-hs-leads.php daily --path=/usr/share/nginx/public_html

# Auto (daily post-bootstrap)
/usr/local/bin/uniacc-hs-leads-export.sh
```

## Rollback

```bash
THEME=/usr/share/nginx/public_html/wp-content/themes/AstraChildTheme
sudo cp -a $THEME/functions.php.bak.20260831 $THEME/functions.php
sudo rm -f $THEME/functions/HS-Leads-Export.php $THEME/scripts/export-hs-leads.php
sudo rm -f /etc/cron.d/uniacc-hs-leads-export /usr/local/bin/uniacc-hs-leads-export.sh
sudo rm -f /etc/uniacc/hs-leads-export.env
wp option delete uniacc_hs_leads_export_bootstrap_done --path=/usr/share/nginx/public_html
```

## Destinatarios (2026-08-31)

**Para:** cristian.ruizdegamboa@uniacc.cl, francisca.montero@uniacc.cl, martin.sobarzo@uniacc.cl, jacinta.iglesias@uniacc.cl

**CC:** roberto.nieto@uniacc.cl, juan.silva@uniacc.cl, juan.cordero@uniacc.cl

Configurados en `/etc/uniacc/hs-leads-export.env`:

```bash
HS_LEADS_EXPORT_RECIPIENTS="cristian.ruizdegamboa@uniacc.cl,francisca.montero@uniacc.cl,martin.sobarzo@uniacc.cl,jacinta.iglesias@uniacc.cl"
HS_LEADS_EXPORT_CC_RECIPIENTS="roberto.nieto@uniacc.cl,juan.silva@uniacc.cl,juan.cordero@uniacc.cl"
```
