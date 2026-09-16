# Firma de contrato con TuFirma (simple)

Fecha: 2026-09-11  
Proyecto: `mol-docker` + `uniacc-api-docker`  
Estado: plan escrito (`docs/superpowers/plans/2026-09-11-tufirma-contrato.md`); pendiente implementación

## Problema

El paso Firma del mock de rematrícula simula FES (serie de cédula + OTP `112233`). El contrato PDF ya se genera (`POST /api/rematricula/alumno/contrato/preview-pdf`). Hay que pedirlo a firmar con **TuFirma** (firma electrónica simple) y no dejar pasar a resumen hasta que firmen todos.

## Decisiones

| Tema | Decisión |
|------|----------|
| Proveedor | TuFirma API pública, `POST /public/documents/create` |
| Tipo de firma | Simple (`firmantes`). Nunca `firmantesFea` / dactilar / facial |
| Quién firma | Alumno siempre. Si el alumno es sostenedor: un correo y dos recuadros. Apoderado distinto: segundo firmante. Ver spec 2026-09-12 |
| Representante UNIACC | No firma. RL vacío por ahora (ni Aliste ni Salazar). Ver spec 2026-09-12 |
| Canal | Correo de TuFirma. MOL no abre el flujo de firma |
| Avance | El alumno no pasa a resumen hasta `ready` (firmaron todos). Puede esperar o volver más tarde |
| Alta del documento | Automática al entrar al paso Firma (si hay plan confirmado) |
| Idempotencia | Un documento por `numOperacion`. Si ya existe, se reutiliza (no se crea otro ni se reenvía el correo de creación) |
| Orden | Paralelo (default TuFirma; no enviar `sign_order`) |
| Correo en prod | Personal del alumno (`emailAlumno` del view-model / `correoPersonalMostrado`) y `mail_apoder` (`emailApoderado`). Si ambos quedan iguales, `ensure` falla (TuFirma no admite dos firmantes con el mismo email) |
| Correo en pruebas | Override en uniacc-api: `TU_FIRMA_EMAIL_OVERRIDE=juan.silva@uniacc.cl` → `juan.silva+alumno@uniacc.cl` y, si aplica, `juan.silva+apoderado@uniacc.cl` (mismo inbox, emails distintos para TuFirma) |
| Key | Solo servidor (`TU_FIRMA_API_KEY` + `TU_FIRMA_BASE_URL` en uniacc-api). No `VITE_*` en MOL |
| Cierre | Polling ~5 s a `GET .../firma/:numOperacion` (BFF → TuFirma). Sin webhook en este alcance |
| Backoffice | Ítem nuevo Rematrícula → **Gestión de firmas** (no reemplaza Firma Contrato / Acepta). Ver PDF en pantalla, pendiente o firmado |

## Arquitectura

```text
FirmaMockView  ──ensure──►  uniacc-api  ──create/get──►  TuFirma staging
       │                         │
       │ polling status          └── Postgres: num_operacion → document_id
       ▼
  ready → firmaCompletada → resumen
```

MOL nunca llama a TuFirma. uniacc-api genera el PDF, crea o reutiliza el documento, y expone estado.

Endpoints (uniacc-api, junto a preview-pdf):

- `POST /api/rematricula/alumno/contrato/firma/ensure` — body = mismo view-model que preview-pdf + si hay que incluir apoderado. Crea o devuelve el existente.
- `GET /api/rematricula/alumno/contrato/firma/:numOperacion` — busca `document_id` en tabla y consulta TuFirma (`ready`, firmantes). No se proxea un id arbitrario de TuFirma.
- `GET /api/rematricula/alumno/contrato/firma` — listado bandeja (filas de la tabla + estado TuFirma).
- `GET /api/rematricula/alumno/contrato/firma/:numOperacion/documento` — proxy de `GET /public/documents/:id/download` (PDF original si falta firma; estampado si `ready`).

Base staging: `https://api.aws.staging.tufirma.digital/api`  
Auth: `Authorization: Bearer tf_sk_...`

## Flujo UI (mock)

1. Plan de pagos confirmado; alumno entra a Firma.
2. Se muestra el preview del contrato (como hoy) y se llama `ensure`.
3. Texto: se envió el contrato a los correos (en staging, los alias de Juan Silva). Firmar desde el mail. Esta pantalla espera a todos.
4. Lista alumno / apoderado: pendiente o firmado, según `firmantes[].ready`.
5. Polling cada ~5 s. Al `ready`: `setFirmaCompletada(true)` y navegación a resumen.
6. Si sale y vuelve: `ensure` no crea otro documento; retoma la espera.
7. Guard de router: resumen exige `firmaCompletada`. Se quita FES mock (serie + OTP).

Sin email válido y sin override: no se crea; error visible. Reintentar solo si aún no hay `document_id`.

## Payload TuFirma

`nombre`: `Contrato rematrícula {numOperacion}`  
`descripcion`: periodo + RUT alumno  
`firmantes[]`: `email`, `nombre`, `rut`  
`fields[]`: siempre dos `signature` (alumno izq., sostenedor der.); `filler` = email del firmante de ese recuadro; `required: true`  
`documentoB64` + `documentoMimeType: application/pdf`  
`tags`: `rematricula`, `{numOperacion}`

Sin `hook`, sin `firmantesFea`, sin `sign_order`.

Layout de firmas y anexo: spec `2026-09-12-contrato-firmas-layout-design.md` (formato Bettersoft). No hay página extra «Firmas electrónicas».

## Persistencia

Tabla `rematricula_contrato_tufirma` en Postgres de uniacc-api: `num_operacion` (único), `document_id`, snapshot de alumno (`rut`, `codcli`, `nombre`, `carrera`, `periodo`), JSON de firmantes enviados, timestamps. Fuente de verdad del `document_id` para reutilizar tras cerrar el browser y para la bandeja.

## Gestión de firmas (backoffice)

Ítem nuevo en el grupo Rematrícula, mismo patrón visual que Casos rematrícula. No reemplaza **Firma Contrato** (Acepta).

- Universo: quienes pasaron por `ensure` (llegaron al paso Firma). El resto no aparece.
- Búsqueda RUT / nombre / codcli. Pestañas Todos / Pendiente / Firmado. **Actualizar** refresca estado contra TuFirma.
- Columnas: RUT, alumno, carrera, n° operación, quién falta (alumno / apoderado), estado del documento.
- **Ver**: detalle de firmantes + **el PDF en pantalla** (dialog/iframe con blob). Pendiente → original enviado a firmar. Firmado → PDF estampado. Misma descarga TuFirma en ambos casos. Sin aprobar/rechazar.

## Persistencia (sesión mock)

`firmaCompletada` sigue en `mockMatriculaContext` (sesión) para el guard; al volver, si TuFirma ya está `ready`, se marca otra vez.

## Errores

| Caso | Comportamiento |
|------|----------------|
| Sin plan confirmado | Igual que hoy: ir a forma de pago |
| Email faltante y sin override, o emails duplicados | No crear; mensaje |
| PDF o TuFirma 4xx/5xx | Error + reintentar; si no hay `document_id`, `ensure` puede crear |
| Poll falla | Se mantiene pendiente; no se borra el documento |
| `costCenter` 422 | Error visible; no reintentar en loop. Validar antes con `GET /public/cost-centers` si staging lo exige |

## Pruebas

- Unit: mapeo propio sostenedor vs apoderado; override `+alumno` / `+apoderado`; no llamar TuFirma.
- Integración staging: RUT de prueba, correos a Juan Silva, firmar, MOL pasa a resumen; bandeja muestra pendiente y luego firmado, y el PDF se ve en ambos estados.

## Fuera de alcance

Webhook; reemplazar o migrar dashboard Firma Contrato (Acepta); mandato; Crystal/RPT; recordatorio/cancelar/reenviar; firma en sesión MOL; FEA; WhatsApp; prod emails hasta quitar `TU_FIRMA_EMAIL_OVERRIDE`; rehacer documentos TuFirma ya creados; cargar representante legal.

Auth de los GET de firma (listado, estado, PDF): la API no tiene middleware de autenticación (deuda previa). Estos endpoints exponen datos personales y el contrato; el acceso depende de que `apigateway-dev.uniacc.cl` sea solo intranet. No se agrega auth solo en esta feature.
