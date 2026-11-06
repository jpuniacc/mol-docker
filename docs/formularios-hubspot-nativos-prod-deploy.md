# Plan: Deploy formularios HS nativos a producción

> **Para ejecutar después de aprobación.** Pasos con checkbox. No migrar embeds Elementor en este plan.

**Goal:** Subir a producción (`uniacccl-prod`) la infraestructura del child theme (PHP + JS + requires/enqueue) para formularios HubSpot nativos → BD local + dataLayer, sin migrar aún los embeds de Elementor.

**Architecture:** Copiar desde QA (`qa3-uniacccl`) los 4 archivos ya validados; cablear `functions.php` + `Core.php` en prod; la tabla `acc_uniacc_hs_leads` ya existe.

**Tech Stack:** WordPress child theme `AstraChildTheme`, HubSpot Forms v2, AJAX `guardar_lead_hs`, `dbDelta` (ya aplicado).

**Hosts:**
- Origen QA: `qa3-uniacccl` → `/usr/share/nginx/public_html/wp-content/themes/AstraChildTheme/`
- Destino prod: `uniacccl-prod` (`192.168.135.18`) → misma ruta
- Usuario SSH prod: `cl159906175` (escrituras con `sudo`, dueño destino `nginx:nginx`)

## Global Constraints

- Solo producción web UNIACC; no tocar QA salvo lectura.
- No migrar widgets Elementor en este deploy.
- No cambiar redirects HubSpot en este paso.
- Backups `.bak.YYYYMMDD-HHMM` antes de editar cualquier archivo existente.
- No usar `--no-verify` ni force; no commits git (cambios solo en servidor).
- Tabla ya creada: `acc_uniacc_hs_leads` en BD `uniacc`, opción `uniacc_hs_leads_db_version=1.0.0`.

---

## Decisión previa (gate) — Collected Forms

`HS-Disable-Collected-Forms.php` hace dos cosas:

1. **Stub** `uniaccHsNativeQueue` en `wp_head` (necesario para embeds Elementor que llaman `bindForm` antes del JS del footer).
2. **Bloqueo global** de `collectedforms.js` (en QA se apagó a propósito).

En prod, `scripts.js` v`1.8.25` aún contempla scrape Collected Forms (comentario malla).

| Opción | Qué se sube | Efecto |
|--------|-------------|--------|
| **A — Como QA** | Archivo completo | Nativos OK + Collected Forms OFF global. Riesgo en `#formContact` / malla si aún dependen del scrape. |
| **B — Infra segura (recomendada)** | Subir archivo completo **pero** comentar/desactivar solo el bloqueo de collectedforms; **mantener el stub** `uniaccHsNativeQueue` | Nativos listos sin romper scrape legacy. |
| **C — Stub mínimo** | Extraer stub a un PHP corto (`HS-Native-Stub.php`) y no subir Disable | Más limpio; requiere archivo nuevo distinto a QA. |

**Decisión tomada (2026-08-27): opción A** — Disable completo como QA (Collected Forms OFF global + stub).

---

## Archivos

### Nuevos (copiar desde QA)

| Archivo | Rol |
|---------|-----|
| `functions/HS-Leads-DB.php` | Schema + `dbDelta` (idempotente; tabla ya existe) |
| `functions/HS-Leads-Ajax.php` | Endpoint `guardar_lead_hs` |
| `functions/HS-Disable-Collected-Forms.php` | Stub + (opcional) bloqueo Collected Forms |
| `assets/js/hs-native-forms.js` | `uniaccHsNative.bindForm` → AJAX → dataLayer |

### Modificar en prod

| Archivo | Cambio |
|---------|--------|
| `functions.php` | 3× `require_once` tras `CRM.php` |
| `functions/Core.php` | Bloque `enqueue_hs_native_forms` (prioridad 5, v `1.0.2`) |
| `header.php` | Solo comentario (opcional) |

### Fuera de scope

- Embeds Elementor (`hbspt.forms.create` → `uniaccHsNative.bindForm`)
- Redirects HubSpot
- Limpieza de lógica scrape en `scripts.js`
- Documentación pública / GTM tags

---

## Paso 0 — Ya hecho

- [x] Tabla `acc_uniacc_hs_leads` creada en prod (`TABLE_OK`, 41 columnas, versión `1.0.0`)

---

## Paso 1 — Congelar decisión Collected Forms

- [x] Confirmado **A** (Disable completo como QA)
- [ ] Smoke-testear un `#formContact` / malla post-deploy (riesgo scrape legacy)

---

## Paso 2 — Backups en prod

Backup real: `TS=20260827-0838`

- [x] Backups creados: `functions.php.bak.20260827-0838`, `Core.php.bak.20260827-0838`, `header.php.bak.20260827-0838`

---

## Paso 3 — Copiar archivos desde QA a prod

Desde la máquina local (o saltando QA→prod):

```bash
# En local / jump host
TMP=/tmp/hs-native-prod-deploy
mkdir -p $TMP/functions $TMP/js
scp qa3-uniacccl:/usr/share/nginx/public_html/wp-content/themes/AstraChildTheme/functions/HS-Leads-DB.php $TMP/functions/
scp qa3-uniacccl:/usr/share/nginx/public_html/wp-content/themes/AstraChildTheme/functions/HS-Leads-Ajax.php $TMP/functions/
scp qa3-uniacccl:/usr/share/nginx/public_html/wp-content/themes/AstraChildTheme/functions/HS-Disable-Collected-Forms.php $TMP/functions/
scp qa3-uniacccl:/usr/share/nginx/public_html/wp-content/themes/AstraChildTheme/assets/js/hs-native-forms.js $TMP/js/

# Si opción B: editar Disable en $TMP antes de subir (quitar/comentar bloqueo collectedforms)

scp $TMP/functions/HS-*.php uniacccl-prod:/tmp/
scp $TMP/js/hs-native-forms.js uniacccl-prod:/tmp/

ssh uniacccl-prod '
THEME=/usr/share/nginx/public_html/wp-content/themes/AstraChildTheme
sudo install -o nginx -g nginx -m 644 /tmp/HS-Leads-DB.php $THEME/functions/
sudo install -o nginx -g nginx -m 644 /tmp/HS-Leads-Ajax.php $THEME/functions/
sudo install -o nginx -g nginx -m 644 /tmp/HS-Disable-Collected-Forms.php $THEME/functions/
sudo install -o nginx -g nginx -m 644 /tmp/hs-native-forms.js $THEME/assets/js/
ls -la $THEME/functions/HS-*.php $THEME/assets/js/hs-native-forms.js
'
```

- [x] 4 archivos en destino con owner `nginx:nginx` (md5 = QA)
- [x] Disable completo (opción A)

---

## Paso 4 — Cablear `functions.php`

Insertar **después** de `require_once THEME_DIR . 'functions/CRM.php';`:

```php
require_once THEME_DIR . 'functions/HS-Leads-DB.php';
require_once THEME_DIR . 'functions/HS-Leads-Ajax.php';
require_once THEME_DIR . 'functions/HS-Disable-Collected-Forms.php';
```

(Si opción C: el tercer require apunta al stub nuevo.)

- [x] Requires añadidos
- [x] `php -l` OK

---

## Paso 5 — Cablear `Core.php`

Insertar **después** de `enqueue_tracking_manager` y **antes** de `add_action( 'wp_enqueue_scripts', 'custom_scripts');` — bloque idéntico a QA:

```php
// JPS 20260827: formularios nativos HubSpot → AJAX local + dataLayer
add_action('wp_enqueue_scripts', 'enqueue_hs_native_forms', 5);
function enqueue_hs_native_forms() {
    if (is_admin()) {
        return;
    }
    wp_enqueue_script(
        'hs-native-forms',
        get_stylesheet_directory_uri() . '/assets/js/hs-native-forms.js',
        array('tracking-manager'),
        '1.0.2',
        true
    );
    $page_id = get_the_ID();
    wp_localize_script('hs-native-forms', 'uniaccHsNativeVars', array(
        'ajaxurl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('uniacc_hs_leads'),
        'currentPageId' => $page_id ? $page_id : 0,
        'portalId' => '51464408',
    ));
}
```

- [x] Bloque insertado
- [x] `scripts.js` sigue en `1.8.25`
- [x] `php -l` OK

---

## Paso 6 — Header (opcional)

Actualizar comentario de la línea HubSpot, p.ej.:

```html
<!-- JPS 20260827: HubSpot tracking (portal 51464408) — analytics/hutk; nativos vía uniaccHsNative -->
```

- [x] Comentario actualizado

---

## Paso 7 — Smoke test infra (sin enviar form nativo aún)

Post-deploy: se purgó `fastcgi_cache` nginx (`/var/cache/nginx`) y Redis `FLUSHDB` (había HTML viejo en cache).

### 7.1 Sitio no caído

```bash
curl -sI https://www.uniacc.cl/ | head -5
# o página carrera conocida
```

- [x] HTTP 200 / sin 500

### 7.2 JS encolado

- [x] Aparece `hs-native-forms.js?ver=1.0.2` (home + Ingeniería Comercial)
- [x] Aparece `uniaccHsNativeVars` (ajaxurl, nonce, portalId `51464408`)

### 7.3 Stub

- [x] `uniaccHsNativeQueue` / stub en `wp_head`

### 7.4 Collected Forms según decisión

- [x] Opción A: script de bloqueo de `collectedforms.js` presente en HTML

### 7.5 Endpoint AJAX existe

- [x] `action=guardar_lead_hs` → `-1` (nonce inválido; action registrada; `ajax_logged=yes` / `ajax_nopriv=yes`)

### 7.6 Tabla intacta

- [x] `TABLE_OK ver=1.0.0`

---

## Paso 8 — Rollback (si falla)

```bash
THEME=/usr/share/nginx/public_html/wp-content/themes/AstraChildTheme
TS=<el_de_backup>
sudo cp -a $THEME/functions.php.bak.$TS $THEME/functions.php
sudo cp -a $THEME/functions/Core.php.bak.$TS $THEME/functions/Core.php
sudo cp -a $THEME/header.php.bak.$TS $THEME/header.php
# Opcional: quitar archivos nuevos
sudo rm -f $THEME/functions/HS-Leads-DB.php \
           $THEME/functions/HS-Leads-Ajax.php \
           $THEME/functions/HS-Disable-Collected-Forms.php \
           $THEME/assets/js/hs-native-forms.js
```

- [ ] Procedimiento anotado (no ejecutar salvo fallo)

**Nota:** La tabla se deja; es inocua sin el AJAX activo.

---

## Paso 9 — Post-deploy / siguiente fase (otro plan)

Cuando la infra esté estable:

1. Migrar embeds Elementor carrera por carrera a `uniaccHsNative.bindForm`
2. Verificar INSERT + `registro_confirmado_servidor` + redirect `/gracias/`
3. Decidir apagado definitivo de Collected Forms en prod (si se eligió B)

Plantilla embed (referencia QA): ver `docs/formularios-hubspot-nativos-qa.md`.

---

## Criterio de éxito de este plan

| Criterio | Esperado |
|----------|----------|
| Sitio responde | Sin 500 |
| JS nativo cargado | `hs-native-forms.js` + `uniaccHsNativeVars` |
| Ajax action | `guardar_lead_hs` registrado |
| Tabla | Sigue existiendo |
| Collected Forms | Según A/B/C acordado |
| Forms Elementor legacy | Siguen igual (aún sin `bindForm`) |

---

## Orden de ejecución resumido

```
0 Tabla (DONE)
1 Decidir A/B/C  ← gate
2 Backup
3 Copiar 4 archivos (+ patch Disable si B)
4 Patch functions.php
5 Patch Core.php
6 Header opcional
7 Smoke tests
8 Rollback listo
9 Embeds = fase 2
```

---

## Export CSV leads (cron) — 2026-08-31

Job lun-vie 08:00 que envía CSV de `acc_uniacc_hs_leads` por correo. Ver [`docs/superpowers/plans/2026-08-31-export-csv-leads-hs.md`](superpowers/plans/2026-08-31-export-csv-leads-hs.md).

**Rollback export:** restaurar `functions.php.bak.20260831`, eliminar `HS-Leads-Export.php`, `scripts/export-hs-leads.php`, cron en `/etc/cron.d/uniacc-hs-leads-export`.

---

*Plan para revisión — deploy prod HS nativos — 2026-08-27*
