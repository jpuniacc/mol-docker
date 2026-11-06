# Guía QA: Formularios HubSpot nativos + registro local + dataLayer

Documento de handoff para quien migra los embeds de formularios nativos de HubSpot en Elementor (ambiente QA).

**Ambiente:** `https://qasitioweb3.uniacc.cl`  
**Servidor:** `qa3-uniacccl` → `/usr/share/nginx/public_html`  
**Theme:** `AstraChildTheme`  
**Portal HubSpot:** `51464408`  
**Región:** `na1`

---

## 1. Objetivo

Cada formulario **nativo de HubSpot** embebido en Elementor debe:

1. Enviar el lead a HubSpot (comportamiento normal del form HS).
2. Guardar una copia local en MySQL (`acc_uniacc_hs_leads`).
3. Disparar el evento GTM `registro_confirmado_servidor` con `lead_id` real (generado en BD).
4. Redirigir a `/gracias/` (configurado en HubSpot y/o en el embed).

**No usar** `hbspt.forms.create` directo en Elementor. Usar siempre `uniaccHsNative.bindForm(...)`.

---

## 2. Qué ya está implementado (no tocar)

La infraestructura global ya está en el child theme del servidor QA:

| Archivo | Función |
|---------|---------|
| `functions/HS-Leads-DB.php` | Crea tabla `acc_uniacc_hs_leads` |
| `functions/HS-Leads-Ajax.php` | Endpoint AJAX `guardar_lead_hs` |
| `functions/HS-Disable-Collected-Forms.php` | Bloquea Collected Forms / scraping global |
| `assets/js/hs-native-forms.js` | `uniaccHsNative.bindForm()` + dataLayer |
| `functions/Core.php` | Carga el JS y variables (`ajaxurl`, nonce, etc.) |
| `functions.php` | Incluye los archivos anteriores |

**Collected Forms está desactivado globalmente en QA.** No reactivarlo.

---

## 3. Qué debes hacer por cada carrera/página

Por cada página Elementor que tenga un form HS nativo:

1. Editar el widget **HTML** de Elementor.
2. Reemplazar el embed crudo por el patrón con `uniaccHsNative.bindForm`.
3. En HubSpot, configurar el redirect post-submit a QA.
4. Probar envío y validar BD + consola + redirect.

---

## 4. Plantilla del embed (copiar y adaptar)

### Incorrecto (no usar)

```html
<script charset="utf-8" type="text/javascript" src="//js.hsforms.net/forms/embed/v2.js"></script>
<script>
  hbspt.forms.create({
    portalId: "51464408",
    formId: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
    region: "na1"
  });
</script>
```

### Correcto (usar siempre)

```html
<script charset="utf-8" type="text/javascript" src="//js.hsforms.net/forms/embed/v2.js"></script>

<div id="uniacc-hs-form-NOMBRE-CARRERA"></div>

<script>
  uniaccHsNative.bindForm({
    portalId: "51464408",
    formId: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
    region: "na1",
    target: "#uniacc-hs-form-NOMBRE-CARRERA",
    formContext: "carrera_hero",
    gtmFormId: "formulario_general",
    redirectUrl: "/gracias/"
  });
</script>
```

### Parámetros a cambiar por carrera

| Parámetro | Qué cambiar |
|-----------|-------------|
| `formId` | ID del form en HubSpot (único por carrera) |
| `id` del `<div>` | Identificador único, ej. `uniacc-hs-form-danza-y-coreografia` |
| `target` | Debe coincidir con el `#id` del div |

### Parámetros que normalmente se repiten

| Parámetro | Valor habitual |
|-----------|----------------|
| `portalId` | `"51464408"` |
| `region` | `"na1"` |
| `formContext` | `"carrera_hero"` |
| `gtmFormId` | `"formulario_general"` |
| `redirectUrl` | `"/gracias/"` |

---

## 5. Ejemplos reales

### Ingeniería Comercial — ya migrado y probado

- **Página Elementor:** post `18421`
- **formId:** `b34b1763-7527-4cf5-ab02-e7c741232281`
- **Estado:** OK (BD + dataLayer + redirect)

```html
<script charset="utf-8" type="text/javascript" src="//js.hsforms.net/forms/embed/v2.js"></script>

<div id="uniacc-hs-form-ingenieria-comercial"></div>

<script>
  uniaccHsNative.bindForm({
    portalId: "51464408",
    formId: "b34b1763-7527-4cf5-ab02-e7c741232281",
    region: "na1",
    target: "#uniacc-hs-form-ingenieria-comercial",
    formContext: "carrera_hero",
    gtmFormId: "formulario_general",
    redirectUrl: "/gracias/"
  });
</script>
```

### Danza y Coreografía — pendiente de migrar

- **Página Elementor:** post `21830`
- **formId:** `a8c87273-fe27-4736-a9b4-d3f2b96b4dea`
- **Estado actual:** embed crudo (`hbspt.forms.create`) — no guarda en BD ni dispara dataLayer

```html
<script charset="utf-8" type="text/javascript" src="//js.hsforms.net/forms/embed/v2.js"></script>

<div id="uniacc-hs-form-danza-y-coreografia"></div>

<script>
  uniaccHsNative.bindForm({
    portalId: "51464408",
    formId: "a8c87273-fe27-4736-a9b4-d3f2b96b4dea",
    region: "na1",
    target: "#uniacc-hs-form-danza-y-coreografia",
    formContext: "carrera_hero",
    gtmFormId: "formulario_general",
    redirectUrl: "/gracias/"
  });
</script>
```

**Campos ocultos del form en HubSpot (no van en Elementor):**

- `programa_pregrado_v2` = `danza_y_coreografia`
- `tipo_de_programa` = `pregrado`
- `categoria_programa_pregrado` = `diurno`
- `modalidad_pregrado` = `DIURNA`

El JS los lee automáticamente al enviar.

---

## 6. Configuración en HubSpot (por cada form)

En HubSpot → Formulario → Opciones → **Redirect after submission**:

```
https://qasitioweb3.uniacc.cl/gracias/
```

**Importante:** Si el redirect apunta a producción (`www.uniacc.cl`), se pierde el contexto de QA y no se verá bien el dataLayer en DevTools.

---

## 7. Flujo técnico (referencia)

```
Usuario envía form HS
    ↓
HubSpot procesa OK
    ↓
onFormSubmitted (hs-native-forms.js)
    ↓
POST admin-ajax.php?action=guardar_lead_hs
    ↓
INSERT en acc_uniacc_hs_leads → lead_id
    ↓
dataLayer.push({ event: "registro_confirmado_servidor", lead_id: N, ... })
    ↓
Redirect a /gracias/
```

---

## 8. Checklist de prueba (por cada form migrado)

### Antes de enviar

- [ ] El form se renderiza dentro del `<div id="uniacc-hs-form-...">`
- [ ] En consola aparece algo como: `[UNIACC HS] bindForm OK <formId>`
- [ ] En Network **no** aparece `collectedforms.js`

### Después de enviar

- [ ] Consola: `[UNIACC HS] registro_confirmado_servidor` con `lead_id` numérico
- [ ] Redirect a `https://qasitioweb3.uniacc.cl/gracias/` (no a prod)
- [ ] Nueva fila en BD (ver sección 9)
- [ ] Contacto visible en HubSpot

### Errores que se pueden ignorar

- `ERR_BLOCKED_BY_CLIENT` en YouTube, Clarity, Facebook, contadores HS → suele ser adblocker; no afecta el flujo principal.

---

## 9. Verificación en base de datos

| Campo | Valor |
|-------|-------|
| Host (vía túnel SSH) | `localhost:3306` |
| SSH | `jsilva@172.16.0.209:22` |
| Base de datos | `qasitioweb20` |
| Usuario | `qasitioweb20` |
| Tabla | `acc_uniacc_hs_leads` |

Consulta de ejemplo:

```sql
SELECT id, created_at, firstname, lastname, email, programa_codigo, form_id_hs, page_id
FROM acc_uniacc_hs_leads
ORDER BY id DESC
LIMIT 10;
```

Registros de prueba ya validados:

| id | email | programa_codigo |
|----|-------|-----------------|
| 2 | juanpablo@sudoers.cl | — |
| 3 | jpsilvafe@outlook.com | ingenieria_comercial |

---

## 10. Shape esperado del dataLayer

Evento disparado tras INSERT exitoso:

```javascript
{
  event: "registro_confirmado_servidor",
  lead_id: 3,                    // ID real de acc_uniacc_hs_leads
  tecnologia: "php_custom",
  form_id: "formulario_general",
  // + nombre, email, teléfono, programa, modalidad, UTMs, etc.
}
```

El payload lo arma el **servidor** (PHP), no el cliente. No modificar manualmente en Elementor.

---

## 11. Reglas importantes

1. **Form nativo = embed de HubSpot** (`js.hsforms.net`), no el `#formContact` de WordPress.
2. **Cada form nuevo en Elementor** debe usar `uniaccHsNative.bindForm` o la clase `.uniacc-hs-form` (si aplica auto-bind).
3. **Los hidden fields** se configuran en HubSpot, no en el HTML de Elementor.
4. **No reactivar Collected Forms** en QA.
5. **Producción está fuera de scope** — solo QA por ahora.
6. Si prod y QA comparten el mismo `formId`, revisar redirects por ambiente (ideal: forms/clones separados por ambiente).

---

## 12. Páginas pendientes

Migrar todas las carreras que aún tengan este patrón:

```javascript
hbspt.forms.create({ ... })
```

sin `uniaccHsNative.bindForm`.

**Referencia ya migrada:** Ingeniería Comercial (`18421`).  
**Siguiente sugerida:** Danza y Coreografía (`21830`).

---

## 13. Troubleshooting

### El form no renderiza

- Verificar que exista el `<div>` con `id` y que `target` apunte al mismo selector.
- Verificar que `hs-native-forms.js` cargue en el footer (ya está enqueuado globalmente).

### No aparece dataLayer

- Revisar redirect en HubSpot (debe ser QA, no prod).
- Revisar consola por errores AJAX en `guardar_lead_hs`.

### No hay fila en BD

- El embed probablemente sigue siendo `hbspt.forms.create` crudo → migrar a `bindForm`.

---

*Documento generado para handoff de migración de formularios HS nativos en QA — Agosto 2026.*
