# GTM cutover — conversión en `/gracias/` (prod)

**Fecha:** 2026-09-04  
**Contenedor:** `GTM-NS5SPR` (cuenta 158484 / container 180356)  
**Etiqueta:** `GA4 | generate_lead ⭐`  
**Dependencia:** deploy theme prod completado (`20260903-ty6` / `ty4`, `fireConversionOnGraciasDefault=true`)

## Qué cambió en el sitio

- El dataLayer `registro_confirmado_servidor` **ya no** se empuja en la página del formulario.
- Se empuja **1×** en `/gracias/` vía `hs-gracias-conversion.js` (payload con `event`, `form_id`, `lead_id`, etc.).
- Clave GTM relevante: **`form_id`** (default `formulario_general`; malla suele usar otro `gtm_form_id`).

## Activadores de `GA4 | generate_lead` a revisar

| Activador | Tipo | Acción requerida |
|-----------|------|------------------|
| `registro_confirmado_servidor FORM Carreras` | Evento personalizado | Verificar filtros Page Path / form_id |
| `registro_confirmado_servidor FORM Landing` | Evento personalizado | Idem |
| `registro_confirmado_servidor MALLA` | Evento personalizado | Idem (`form_id` malla) |

### Hallazgo FORM Carreras (workspace actual — verificado 2026-09-04)

- Evento: `registro_confirmado_servidor`
- `NATIVO - 2 | [form_id]` **es igual a** `formulario_general`
- `Page Path` **no empieza por** `/carreras`

Con el push en `/gracias/`, el filtro de Page Path **sí se cumple** (path = `/gracias/`). No hace falta cambiar el path de este trigger para el corte.

### Bloqueo probable de `generate_lead` (prioridad alta)

En la etiqueta `GA4 | generate_lead ⭐` → Configuración avanzada → secuencia:

- «No active GA4 | generate_lead si **Undefined parameter - previousTag** no se activa…»
- «No active **Undefined parameter - nextTag** si GA4 | generate_lead no se activa…»

Eso puede impedir el fire aunque el activador dispare. **Go Point debe limpiar/reparar la secuencia** (quitar referencias rotas o re-seleccionar etiquetas) y luego Preview + Enviar/publicar.

### Ajustes recomendados (si Preview falla)

1. En Preview, seleccionar el evento **`registro_confirmado_servidor`**, no el page view de Gracias.
2. Confirmar que la variable `NATIVO - 2 | [form_id]` = `formulario_general` en ese evento.
3. Si Page Path de Landing/MALLA exige path de landing/carrera: ampliar a incluir `/gracias/` **o** quitar el filtro de path y depender de `form_id` / `form_context`.
4. Tags Ads/Meta que usan los mismos activadores: validar juntos.
5. Revisar secuencia de etiquetas (`previousTag` Undefined) en `generate_lead`.
6. **Publicar** el contenedor el mismo día del deploy (ya hecho en theme).

## Preview checklist (www.uniacc.cl)

- [ ] Submit carrera → en Gracias aparece evento `registro_confirmado_servidor`
- [ ] Tag `GA4 | generate_lead` **Fired**
- [ ] En página form: **0** fires de generate_lead por ese submit
- [ ] Malla: mismo patrón con trigger MALLA
- [ ] Refresh Gracias: no vuelve a disparar

## Estado técnico sitio (2026-09-04 11:34)

- IC HTML: `hs-native-forms.js?ver=20260903-ty6` + `fireConversionOnGraciasDefault":"1"`
- Gracias HTML: `hs-gracias-conversion.js?ver=20260903-ty6` (sin malla-modal)
- Backup theme: `*.bak.20260904-1133`

## Responsable publicación

Go Point / marketing — **publicar workspace** tras Preview OK.
