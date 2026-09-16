# Avisos por correo al consejero (TyC, convenio, apoderado, firma)

Fecha: 2026-09-15  
Proyectos: `mol-docker`, `uniacc-api-docker`  
Estado: diseño aprobado (pendiente plan de implementación)

## Problema

Cuando un alumno no acepta TyC, sube (o re-sube) el PDF de convenio, marca apoderado desactualizado, o deja / completa la firma del contrato, el consejero asignado debe enterarse por correo. Hoy:

- TyC / convenio / apoderado abren casos en `mnp_caso_rematricula`, pero **no** mandan mail al ejecutivo.
- Apoderado usa `REMATRICULA_APODERADO_AVISO_TO` (lista fija), no el ejecutivo del Excel.
- Firma (TuFirma) no avisa al consejero.
- El Excel `BASE PARA PRUEBA` ya trae `EJECUTIVO MATRICULA` (3 correos, 0 nulos); `mnp_cartera_oficial` **no** lo guarda.

## Decisión

**Enfoque C + cola (outbox):**

| Evento | Timing |
| --- | --- |
| TyC rechazado | Mail **inmediato** (vía cola) |
| PDF convenio subido / re-subido | Mail **inmediato** |
| Apoderado desactualizado | Mail **inmediato** (reemplaza el aviso a lista fija) |
| Contrato 100 % firmado | Mail **inmediato** (solo cuando todos firmaron) |
| Firmas pendientes | Digest **lun–vie 09:00 y 16:00** hora Chile |

**Destinatarios (todos los mails):**

- **To** = `email_ejecutivo` de la cartera (Excel).
- **CC** = `mol@uniacc.cl` (buzón compartido). Si no hay ejecutivo, To = `mol@` y no se duplica en CC.

**Arquitectura:** el portal no envía SMTP. Al abrir el caso (o al detectar firma lista) se encola; un worker en `uniacc-api` envía con el mismo relay SMTP del aviso de apoderado.

```
Excel EJECUTIVO MATRICULA
        │ recarga cartera
        ▼
mnp_cartera_oficial.email_ejecutivo
        │
        ├── abrir caso TYC / CONVENIO / APODERADO
        │         → mnp_aviso_consejero (pendiente)
        │
        ├── worker: TuFirma ready = true
        │         → mnp_aviso_consejero FIRMA_COMPLETA
        │
        └── cron lun–vie 09:00 y 16:00 Chile
                  → digest por ejecutivo (si hay pendientes)
                            │
                            ▼
                 uniacc-api worker SMTP
                 To = ejecutivo · CC = mol@uniacc.cl
```

## Modelo de datos

### 1. `mnp_cartera_oficial.email_ejecutivo`

- Columna `text` (nullable).
- Se llena al cargar/recargar el Excel (`EJECUTIVO MATRICULA`, trim + lower).
- PK sigue siendo `rut_norm`. Un RUT con dos carreras (`18485662K`) comparte un email a nivel RUT (hoy el Excel asigna el mismo ejecutivo en ambas filas).
- Si falta email: el aviso igual se encola; al enviar, To = `mol@uniacc.cl` y se loguea “sin ejecutivo”.

### 2. `mnp_aviso_consejero` (cola / outbox)

Una fila = un mail inmediato.

| Campo | Uso |
| --- | --- |
| `tipo` | `TYC_RECHAZO` · `CONVENIO_CERTIFICADO` · `APODERADO_DATOS` · `FIRMA_COMPLETA` |
| `periodo`, `codcli`, `rut_alumno`, nombre, carrera, jornada | Cuerpo del mail |
| `caso_id` | Caso relacionado (TyC / PDF / apoderado) |
| `ref_id` | Documento convenio o `num_operacion` TuFirma |
| `payload` | jsonb (detalle apoderado, firmantes, etc.) |
| `estado` | `pendiente` → `enviado` \| `error` \| `omitido` |
| `intentos`, `ultimo_error`, `enviado_en` | Worker |
| `es_mock` | Marca de origen mock; **sí se encola y se envía** (To ejecutivo cartera, CC mol@). No va al alumno. |

**Unicidad:**

- TyC, apoderado, firma completa: una vez por `(tipo, periodo, codcli)`.
- Convenio: una vez por `(tipo, periodo, codcli, ref_id)` — re-subir PDF tras rechazo genera **otro** mail.

Destinatario se resuelve **al enviar** (email actual en cartera). Mocks no generan aviso.

### 3. `mnp_aviso_digest_log`

Evita reenviar el mismo digest: único por `(fecha Chile, ventana 09|16, email_ejecutivo)`.

### Quién escribe la cola

| Origen | Acción |
| --- | --- |
| RPC `abrir_mnp_caso_rematricula` | Inserta aviso al dejar caso en `EN_REVISION` / abierto según tipo (`TYC_RECHAZO`, `CONVENIO_CERTIFICADO`, `APODERADO_DATOS`) |
| Worker `uniacc-api` + `rematricula_contrato_tufirma` | Cuando documento TuFirma pasa a `ready` → `FIRMA_COMPLETA` (idempotente) |
| Cron digest | No usa la cola fila-a-fila; arma listado y escribe `mnp_aviso_digest_log` |

RLS: browser no lee/escribe la cola; solo `service_role` / worker.

### Apoderado vs lista fija

El POST actual a `REMATRICULA_APODERADO_AVISO_TO` **deja de enviar** el mail operativo. Esa variable queda solo como respaldo de staging si hace falta. El ruteo productivo es ejecutivo + `mol@`.

## Flujos

### Mail inmediato

1. Hecho (rechazo TyC, subida PDF, apoderado, contrato `ready`).
2. Fila `pendiente` en `mnp_aviso_consejero`.
3. Worker cada ~1 min: To/CC, HTML + text, marca `enviado` o `error`.
4. El alumno **no espera** el SMTP (TyC logout sigue igual).

### Digest firmas pendientes

1. Cron lun–vie 09:00 y 16:00 Chile.
2. Universo: contratos TuFirma del periodo activo con documento creado y **no** 100 % listo, agrupados por `email_ejecutivo`.
3. Un mail por consejero (lista RUT, nombre, carrera, `codcli`, quién falta: Alumno / Apoderado).
4. CC `mol@` en cada uno. Sin pendientes → no se envía. Segunda corrida en la misma ventana → `digest_log` lo corta.
5. Tope de filas en HTML: 40 + línea “y N más en Gestión de firmas”.

### Fuera de estos mails

- Correos de TuFirma al alumno/sostenedor (no se tocan).
- WhatsApp, reenvío manual desde UI, edición de ejecutivo en MOL (solo vía recarga Excel).

## Errores y reintentos

| Situación | Comportamiento |
| --- | --- |
| SMTP caído / timeout | `error`; reintento con espera creciente (máx. 5). El caso en bandeja no se pierde. |
| Tras 5 fallos | Queda en `error`; no spamea. TI reencola o mira `ultimo_error`. |
| Sin `email_ejecutivo` | To = `mol@` solamente. |
| Mock | No se encola. |
| TyC: browser cerrado | Irrelevante: aviso ya en cola. |
| Poll detecta `ready` dos veces | Unique `FIRMA_COMPLETA` evita segundo mail. |
| Digest duplicado | `mnp_aviso_digest_log`. |
| `mol@` es el To | No se pone otra vez en CC. |

## Plantillas HTML (correo)

HTML tabular, CSS inline, ancho 600 px. Fuente Arial/Helvetica (Outlook). Sin emojis. Versión texto plano obligatoria.

**Marca UNIACC**

| Token | Hex | Uso en mail |
| --- | --- | --- |
| Navy | `#1E3A5F` | Header, texto, acento apoderado / digest |
| Celeste | `#3B9EC9` | Acento convenio |
| Pink | `#D91B7A` | Acento contrato firmado |
| Naranja | `#E8621A` | Acento TyC |

**Cascarón común**

1. Preheader oculto (una línea).
2. Header navy: “UNIACC · Matrícula en línea”.
3. Bloque alerta con barra izquierda = acento del tipo.
4. Ficha alumno (tabla): RUT, nombre, `codcli`, carrera, jornada, periodo.
5. Un botón CTA (URL base `MOL_PUBLIC_URL`).
6. Pie: “Correo automático · no responder · copia a mol@uniacc.cl”.

**Acentos y CTA**

| Tipo | Barra / botón | Destino CTA |
| --- | --- | --- |
| TyC | Naranja | `/dashboard/casos-rematricula` |
| Convenio | Celeste | `/dashboard/casos-rematricula` |
| Apoderado | Navy | `/dashboard/casos-rematricula` |
| Firma completa | Pink | `/dashboard/gestion-firmas` |
| Digest | Navy | `/dashboard/gestion-firmas` |

**Asuntos y copy**

1. **TyC** — Asunto: `Rematrícula — no aceptó TyC · {nombre}`  
   Título: No aceptó términos y condiciones.  
   Cuerpo: rechazó TyC y se cerró la sesión; revisar caso en bandeja.

2. **Convenio** — Asunto: `Rematrícula — certificado de convenio en revisión · {nombre}`  
   Título: Certificado de convenio para revisar.  
   Cuerpo: subió o volvió a subir el PDF; aprobar o rechazar con motivo. **Sin adjunto** (ver archivo en bandeja).

3. **Apoderado** — Asunto: `Rematrícula — datos de apoderado desactualizados · {nombre}`  
   Título: Datos del apoderado desactualizados.  
   Extra en ficha: nombre, teléfono y mail del apoderado mostrados al alumno.

4. **Firma completa** — Asunto: `Rematrícula — contrato firmado · {nombre}`  
   Título: Contrato firmado.  
   Cuerpo: todos los firmantes firmaron.

5. **Digest** — Asunto: `Rematrícula — {n} firmas pendientes · {dd/mm} {09:00|16:00}`  
   Título: Firmas pendientes en tu cartera.  
   Tabla: RUT, nombre, carrera, quién falta.

**Esqueleto HTML de referencia** (implementar como función en `uniacc-api`; variables escapadas):

```html
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1E3A5F;">
  <div style="display:none;max-height:0;overflow:hidden;">{{preheader}}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="background:#1E3A5F;padding:20px 24px;color:#ffffff;font-size:18px;font-weight:bold;">
          UNIACC · Matrícula en línea
        </td></tr>
        <tr><td style="padding:24px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-left:4px solid {{accent}};background:#f8fafc;margin-bottom:20px;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 8px 0;font-size:18px;font-weight:bold;color:#1E3A5F;">{{titulo}}</p>
              <p style="margin:0;font-size:14px;line-height:1.5;color:#334155;">{{cuerpo}}</p>
            </td></tr>
          </table>
          <!-- ficha alumno / tabla digest -->
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:8px;">
            <tr><td style="background:{{accent}};border-radius:6px;">
              <a href="{{ctaUrl}}" style="display:inline-block;padding:12px 20px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;">{{ctaLabel}}</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#64748b;">
          Correo automático · no responder · copia a mol@uniacc.cl
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```

## Prueba mínima

Usar filas reales del Excel (ejecutivos distintos) y verificar CC `mol@uniacc.cl`.

| Caso | Esperado |
| --- | --- |
| No acepta TyC | Caso + cola + mail ejecutivo + CC `mol@`; logout no pierde aviso |
| Rechaza TyC otra vez | No segundo mail |
| Sube PDF convenio | Mail inmediato |
| Rechazo consejero + re-subida | Segundo mail (otro `ref_id`) |
| Apoderado desactualizado | Mail al ejecutivo + CC `mol@`; **no** mail a lista fija |
| Contrato 100 % listo | Un mail `FIRMA_COMPLETA` |
| Firma parcial | Sin mail inmediato; sí en digest |
| Digest 09 / 16 | Un mail por consejero con pendientes; vacío = silencio; no duplicar ventana |
| Sin ejecutivo | Solo `mol@` |
| Mock | Nada en cola ni SMTP |
| SMTP caído y recupera | `error` → reintento → `enviado` |
| Dos carreras mismo RUT | Aviso con ejecutivo de cartera (email por RUT) |

## Fuera de alcance (v1)

WhatsApp; reenviar desde UI; cambiar ejecutivo en MOL sin recargar Excel; gráficos; CSV; notificación por cada firma parcial; adjuntar PDF en el correo.

## Criterio de éxito

El consejero recibe mail inmediato en TyC, PDF, apoderado y contrato listo; `mol@` ve lo mismo en copia; las firmas a medias no spamean y aparecen en el digest de mañana y tarde.

## Dependencias existentes

- Excel / skill `base-prueba-rematricula` → columna `EJECUTIVO MATRICULA`.
- `mnp_caso_rematricula` + RPC `abrir_mnp_caso_rematricula`.
- `uniacc-api` `EmailService` (SMTP relay) y `rematricula_contrato_tufirma` / estado TuFirma `ready`.
- Rutas MOL: `/dashboard/casos-rematricula`, `/dashboard/gestion-firmas`.
- Specs relacionadas: `2026-09-10-casos-rematricula-design.md`, `2026-09-11-tufirma-contrato-design.md`.
