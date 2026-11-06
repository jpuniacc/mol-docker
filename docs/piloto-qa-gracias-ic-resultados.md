# Piloto QA — Marcación en `/gracias/` (solo Ingeniería Comercial)

**Fecha:** 2026-09-03 (reinstalado en QA nuevo)  
**Host QA:** `uniacccl-qa-docker` (`qasitioweb3.uniacc.cl`, puerto local `9513`)  
**Paridad baseline vs prod:** `hs-native-forms.js`, `Core.php`, `functions.php`, `HS-Leads-Ajax.php` coincidían en SHA256 **antes** del piloto; `hs-gracias-conversion.js` y `HS-Funnel-Audit.php` ausentes en ambos (esperado).  
**IC:** `/facultad-de-negocios-y-tecnologia/ingenieria-comercial/` (post `18421`, formId `923abacb-25e8-4ef0-8016-3dba9c505951`)  
**JS:** `hs-native-forms.js` + `hs-gracias-conversion.js` ver `20260903-ty2`  
**Flag:** `fireConversionOnGracias: true` en embed Elementor IC  
**Gracias fast:** template `page-gracias.php` + dequeue assets pesados; piloto IC redirect **~100ms** con save async (`pending_save`)  

## Deploy

| Artefacto | Ruta QA |
|-----------|---------|
| Auditoría | `functions/HS-Funnel-Audit.php` → tabla `acc_uniacc_hs_funnel_events`, AJAX `uniacc_hs_funnel_log` |
| Hook `lead_saved` | `functions/HS-Leads-Ajax.php` |
| Require | `functions.php` |
| Enqueue gracias | `functions/Core.php` (`is_page('gracias')`) |
| Cliente | `assets/js/hs-native-forms.js`, `assets/js/hs-gracias-conversion.js` |

## Matriz T01–T10 (reinstalación 2026-09-03, `uniacccl-qa-docker`)

Evidencia de backend/SQL (el dominio público HTTPS no resolvió desde el host de despliegue; T10 browser/GTM pendiente).

| ID | Resultado | Evidencia |
|----|-----------|-----------|
| T01 Happy path | **PASS (SQL)** | Lead `723`, session `8a660ee8-…`. Cadena: `form_bound`→`hs_submitted`→`lead_saved`→`token_queued`→`redirect_started`→`gracias_landed`→`conversion_fired`. |
| T02 Lead BD | **PASS** | `acc_uniacc_hs_leads.id=723` email `piloto+ty01.…@uniacc.test`. |
| T03 Refresh | **PASS (SQL)** | `gracias_duplicate` en lead `723`. |
| T04 Directo gracias | **PASS (SQL)** | Evento `gracias_no_token`. |
| T05 Cerrar post-save | **PASS** | Lead `724`: `lead_saved`+`token_queued`, sin `gracias_landed` → `abandoned_after_save`. |
| T06 Redirect roto | **PASS** (equivalente T05) | Mismo patrón audit. |
| T07 Storage bloqueado | **PASS (SQL)** | Lead `725`, `token_queued` con `queued=false`. |
| T08 Control negativo | **PASS (SQL)** | Lead `726` form `control-form`, sin cadena piloto `token_queued`/`gracias_landed`. |
| T09 Doble envío | **PASS** | Leads `727` y `728`, dos `session_key`, dos `conversion_fired`. |
| T10 GTM Preview | **PENDIENTE firma marketing** | Código encolado (`20260903-ty1`). Validar tag draft 1× en `/gracias/`, 0 en IC. |

### Nota timezone

WP QA: eventos funnel ~`17:20`, lead `created_at` puede mostrar ~`18:20` (desfase `gmt_offset`). Usar misma referencia al interpretar “10 minutos” de abandono.

## Go / No-go

| Criterio | Estado |
|----------|--------|
| T01, T02, T03, T04, T08 verdes | Sí |
| T05 con evidencia SQL | Sí (lead 724 + `abandoned_after_save`) |
| Sin regresión obvia IC (AJAX + BD) | Sí |
| Marketing firma T10 Preview | **Pendiente** |

**Decisión técnica:** **GO condicionado** — listo para ampliar piloto en QA tras firma T10 de marketing. **No roll-out prod** hasta esa firma.

### Acción marketing (T10)

1. Abrir GTM Preview → `qasitioweb3.uniacc.cl`.
2. Submit IC (o pedirnos email de prueba).
3. Confirmar: tag draft dispara **1 vez en `/gracias/`**, **0 en IC**.
4. Responder OK en el hilo del piloto.

---

## Riesgo TI — CRM (HubSpot) vs conversión de campaña

**Área emisora:** TI / Web  
**Contexto:** Cada submit exitoso en HubSpot genera contacto/deal. La conversión de campaña solo se marca al llegar a `/gracias/` (y si el navegador permite la medición).

### Hecho

| Sistema | Cuándo registra |
|---------|-----------------|
| HubSpot (contacto / deal) | Al envío exitoso del formulario |
| GA4 / Ads / Meta (conversión) | Solo si carga `/gracias/` y la marcación no está bloqueada |

**Deal en CRM ≠ conversión pagada.**

### Riesgos levantados

1. **Gap CRM vs plataformas de pago (alto)**  
   Usuario envía → deal en HS → cierra antes de Gracias / falla redirect → **sin conversión**.  
   En auditoría: “hay deals sin `generate_lead`”. Esperable por diseño, no bug. Cubierto en piloto por **T05/T06**.

2. **Adblockers / bloqueo de scripts (medio–alto)**  
   Deal sí; conversión no o parcial. Merma estructural de industria. No se mitiga disparando en el submit (reintroduce inflación 2026-1/2026-2).

3. **Bloqueo de almacenamiento del navegador (medio)**  
   Sin ticket anti-duplicado usable → se prioriza **no marcar** (evitar sobremedición). Deal sí; conversión no. Cubierto en piloto por **T07**.

4. **Consentimiento (medio)**  
   Sin consentimiento válido no disparan tags ads. Deal puede existir igual.

5. **Riesgo reputacional TI**  
   El gap se puede interpretar como falla de implementación si no hay aceptación explícita del modelo.

### Matriz

| Escenario | Deal HS | Conversión campaña | ¿Esperable? | Prueba |
|-----------|---------|-------------------|-------------|--------|
| Envío OK + llega a Gracias | Sí | Sí (1 vez) | Sí | T01 |
| Envío OK + cierra antes de Gracias | Sí | No | Sí | T05 / T06 |
| Envío OK + storage bloqueado | Sí | No | Sí | T07 |
| Gracias sin enviar form | No | No | Sí | T04 |
| Gracias + F5 | Sí (1 deal) | No segunda vez | Sí | T03 |

### Posición TI

- Se implementa el camino pedido: éxito HS → Gracias → marcar ahí.
- TI **no garantiza** paridad 1:1 deals HS ↔ conversiones GA4/Ads.
- Forzar conversión en el submit para “cuadrar” CRM reintroduce inflación de campañas (2026-1 / 2026-2).

### Decisión requerida (Marketing / Martech)

| # | Pregunta | Estado |
|---|----------|--------|
| 1 | ¿KPI de campaña = conversión en Gracias (no deal HS)? | Pendiente |
| 2 | ¿Se acepta gap deals sin conversión (cierre, adblock, etc.)? | Pendiente |
| 3 | ¿Prioridad ante duda: no sobremedir (recomendado TI) vs máxima captura? | Pendiente |
| 4 | ¿Firma GTM Preview T10? | Pendiente |
