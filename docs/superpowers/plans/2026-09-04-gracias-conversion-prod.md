# Gracias conversion — Implementation Plan (producción)

> **For agentic workers:** Execute task-by-task. Steps use checkbox syntax.

**Goal:** Desplegar en `uniacccl-prod` la marcación en `/gracias/` validada en QA, con GTM coordinado.

**Architecture:** Copiar JS/Ajax/Audit desde QA; parche quirúrgico `Core.php` + `functions.php`; purga cache; Preview/publish GTM-NS5SPR.

**Tech Stack:** WordPress child theme `AstraChildTheme`, HubSpot Forms, GTM, nginx fastcgi cache, Redis.

## Global Constraints

- Destino solo `uniacccl-prod` (`192.168.135.18` / host `uniacccl-prod`).
- Origen: `/opt/uniacccl-qa-docker/data/wordpress/wp-content/themes/AstraChildTheme/`.
- Backups `.bak.YYYYMMDD-HHMM` antes de cada overwrite/parche.
- Owner destino `nginx:nginx`, mode `644`.
- No Docker, no `.htaccess`, no `template-gracias-fast.php`, no embeds Elementor.
- Asset versions: `hs-native-forms` / `hs-gracias-conversion` = `20260903-ty6`; `hs-malla-modal` = `20260903-ty4`.

---

### Task 1: Spec (done in repo)

- [x] Spec en `docs/superpowers/specs/2026-09-04-gracias-conversion-prod-design.md`

---

### Task 2: Gate QA (antes de prod)

**Verify assets QA:**

```bash
curl -sS -m 15 "http://127.0.0.1:9513/facultad-de-negocios-y-tecnologia/ingenieria-comercial/" \
  -H "Host: qasitioweb3.uniacc.cl" | grep -oE 'hs-native-forms\.js\?ver=[^"]+|fireConversionOnGraciasDefault[^,]*'
# Expected: ver=20260903-ty6 y fireConversionOnGraciasDefault":"1"

curl -sS -m 15 "http://127.0.0.1:9513/gracias/" \
  -H "Host: qasitioweb3.uniacc.cl" | grep -oE 'hs-gracias-conversion\.js\?ver=[^"]+'
# Expected: hs-gracias-conversion.js?ver=20260903-ty6
```

- [x] HTML carrera: flag default + native ty6
- [x] HTML gracias: hs-gracias-conversion ty6
- [ ] GTM Preview QA: evento `registro_confirmado_servidor` (no pageview) — checklist para marketing si no hay firma T10

---

### Task 3: Backup + deploy theme

```bash
TS=$(date +%Y%m%d-%H%M)
QA=/opt/uniacccl-qa-docker/data/wordpress/wp-content/themes/AstraChildTheme
TMP=/tmp/gracias-prod-deploy-$TS
THEME=/usr/share/nginx/public_html/wp-content/themes/AstraChildTheme

mkdir -p "$TMP"
cp "$QA/assets/js/hs-native-forms.js" \
   "$QA/assets/js/hs-malla-modal.js" \
   "$QA/assets/js/hs-gracias-conversion.js" \
   "$QA/functions/HS-Funnel-Audit.php" \
   "$QA/functions/HS-Leads-Ajax.php" \
   "$TMP/"

# Parche local Core.php / functions.php desde copias prod
scp uniacccl-prod:$THEME/functions/Core.php "$TMP/Core.php.prod"
scp uniacccl-prod:$THEME/functions.php "$TMP/functions.php.prod"
cp "$TMP/Core.php.prod" "$TMP/Core.php"
cp "$TMP/functions.php.prod" "$TMP/functions.php"
```

**Parche `Core.php`:** reemplazar bloque `enqueue_hs_native_forms` … fin de `enqueue_hs_malla_modal` por el de QA (con `fireConversionOnGraciasDefault`, `enqueue_hs_gracias_conversion`, skip malla en gracias, versiones ty6/ty4).

**Parche `functions.php`:** tras `HS-Leads-Ajax.php` añadir:

```php
require_once THEME_DIR . 'functions/HS-Funnel-Audit.php';
```

```bash
# Subir
scp "$TMP"/* uniacccl-prod:/tmp/gracias-prod-deploy/

ssh uniacccl-prod "
TS=$TS
THEME=/usr/share/nginx/public_html/wp-content/themes/AstraChildTheme
SRC=/tmp/gracias-prod-deploy
sudo cp -a \$THEME/assets/js/hs-native-forms.js \$THEME/assets/js/hs-native-forms.js.bak.\$TS
sudo cp -a \$THEME/assets/js/hs-malla-modal.js \$THEME/assets/js/hs-malla-modal.js.bak.\$TS
sudo cp -a \$THEME/functions/HS-Leads-Ajax.php \$THEME/functions/HS-Leads-Ajax.php.bak.\$TS
sudo cp -a \$THEME/functions/Core.php \$THEME/functions/Core.php.bak.\$TS
sudo cp -a \$THEME/functions.php \$THEME/functions.php.bak.\$TS
sudo install -o nginx -g nginx -m 644 \$SRC/hs-native-forms.js \$THEME/assets/js/
sudo install -o nginx -g nginx -m 644 \$SRC/hs-malla-modal.js \$THEME/assets/js/
sudo install -o nginx -g nginx -m 644 \$SRC/hs-gracias-conversion.js \$THEME/assets/js/
sudo install -o nginx -g nginx -m 644 \$SRC/HS-Funnel-Audit.php \$THEME/functions/
sudo install -o nginx -g nginx -m 644 \$SRC/HS-Leads-Ajax.php \$THEME/functions/
sudo install -o nginx -g nginx -m 644 \$SRC/Core.php \$THEME/functions/
sudo install -o nginx -g nginx -m 644 \$SRC/functions.php \$THEME/
php -l \$THEME/functions/Core.php
php -l \$THEME/functions.php
php -l \$THEME/functions/HS-Funnel-Audit.php
php -l \$THEME/functions/HS-Leads-Ajax.php
"
```

**Purga cache:**

```bash
ssh uniacccl-prod '
sudo rm -rf /var/cache/nginx/*
redis-cli FLUSHDB
# o el DB index que use WP object cache — confirmar con deploy previo
'
```

- [x] Backups creados (TS=20260904-1133)
- [x] Archivos instalados nginx:nginx (sha256 = QA)
- [x] `php -l` OK
- [x] Cache purgada (nginx + Redis FLUSHDB)

---

### Task 4: GTM cutover (Go Point)

Contenedor `GTM-NS5SPR`. Etiqueta `GA4 | generate_lead` + Ads/Meta con mismos triggers.

Activadores a revisar:

1. `registro_confirmado_servidor FORM Carreras`
2. `registro_confirmado_servidor FORM Landing`
3. `registro_confirmado_servidor MALLA`

Checklist:

- [ ] Evento personalizado = `registro_confirmado_servidor`
- [ ] Condición `form_id` / `NATIVO - 2 | [form_id]` sigue resolviendo desde dataLayer (`form_id`)
- [ ] Filtros Page Path permiten `/gracias/` (o no bloquean el path de gracias)
- [ ] Preview en `www.uniacc.cl`: mirar el evento custom, no el page view
- [ ] Publicar contenedor en la misma ventana del deploy
- [ ] Revisar secuencia `previousTag` si aparece Undefined

---

### Task 5: Smoke prod

```bash
curl -sS -m 20 "https://www.uniacc.cl/facultad-de-negocios-y-tecnologia/ingenieria-comercial/" \
  | grep -oE 'hs-native-forms\.js\?ver=[^"]+|fireConversionOnGraciasDefault[^,]*'
# Expected: ty6 + default true

curl -sS -m 20 "https://www.uniacc.cl/gracias/" \
  | grep -oE 'hs-gracias-conversion\.js\?ver=[^"]+|hs-malla-modal'
# Expected: gracias-conversion ty6; NO hs-malla-modal
```

Browser / manual:

| # | Caso | Esperado |
|---|------|----------|
| 1 | Submit carrera | Redirect `/gracias/`; 1× evento; 0 en form |
| 2 | Malla | PDF + `/gracias/` + 1× evento |
| 3 | `/gracias/` directo | Sin conversión |
| 4 | Refresh post-conv | Sin segundo evento |
| 5 | BD | Fila `acc_uniacc_hs_leads` |

Monitoreo 24–48h: comparar eventos GTM vs inserts BD.

---

### Task 6: Rollback

```bash
ssh uniacccl-prod '
TS=<TS_DEL_DEPLOY>
THEME=/usr/share/nginx/public_html/wp-content/themes/AstraChildTheme
sudo install -o nginx -g nginx -m 644 $THEME/assets/js/hs-native-forms.js.bak.$TS $THEME/assets/js/hs-native-forms.js
sudo install -o nginx -g nginx -m 644 $THEME/assets/js/hs-malla-modal.js.bak.$TS $THEME/assets/js/hs-malla-modal.js
sudo rm -f $THEME/assets/js/hs-gracias-conversion.js
sudo install -o nginx -g nginx -m 644 $THEME/functions/HS-Leads-Ajax.php.bak.$TS $THEME/functions/HS-Leads-Ajax.php
sudo rm -f $THEME/functions/HS-Funnel-Audit.php
sudo install -o nginx -g nginx -m 644 $THEME/functions/Core.php.bak.$TS $THEME/functions/Core.php
sudo install -o nginx -g nginx -m 644 $THEME/functions.php.bak.$TS $THEME/functions.php
sudo rm -rf /var/cache/nginx/*
redis-cli FLUSHDB
'
# + republish GTM versión anterior
```
