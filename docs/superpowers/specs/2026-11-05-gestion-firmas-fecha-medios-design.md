# Gestión de firmas — fecha de generación + medios de pago

**Fecha:** 2026-11-05  
**Estado:** pendiente revisión usuario  
**Proyectos:** uniacc-api-docker + mol-docker  
**Rollout:** mol-dev / api-dev → prod cuando se indique

## Objetivo

En **Gestión de firmas**, el listado debe mostrar para cada contrato:

1. Fecha de generación (envío a TuFirma).
2. Medio con que se pagó la matrícula.
3. Medio con que se pagó el arancel.

Y la tabla debe paginarse de a **10 filas**.

## Decisiones

| Tema | Decisión |
|------|----------|
| Dónde | Columnas en la tabla (no solo en el diálogo Ver) |
| Filas | Todas (Pendiente y Firmado) |
| Etiquetas | Cortas: Webpay / Pagaré / Cubierto / — |
| Enfoque | Enriquecer `listContratoFirma` en API; UI solo pinta |
| Paginación | Cliente, `useTablaPaginada(filasVisibles, 10)` |
| Fuera de alcance | Montos, folios, buy_order, denormalizar en `rematricula_contrato_tufirma`, paginación server-side |

## Fuentes de datos

### Fecha (`Generado`)

- Campo ya expuesto: `rematricula_contrato_tufirma.created_at` → `ContratoFirmaListRow.created_at`.
- Formato UI: `dd/mm/yyyy HH:mm` (zona local del navegador).
- Si falta: `—`.

### Medios (`Matrícula`, `Arancel`)

Join por `codcli` + periodo del row TuFirma hacia `mol_borrador_rematricula.payload`:

| Etiqueta | Regla |
|----------|--------|
| **Webpay** | `medioMatricula` / `medioArancel` = `webpay`, **o** (sin medio declarado) existe tx `mnp_webpay_transaccion` autorizada del concepto |
| **Pagaré** | payload indica `pagare` |
| **Cubierto** | solo arancel: sin medio y arancel cubierto (misma noción que matricular: arancel en 0 / cubierto por beneficio) |
| **—** | sin borrador, sin medio y sin fallback |

Prioridad alineada a reportes pagos: **pagaré declarado manda**; Webpay declarado o tx autorizada → Webpay; resto → — (o Cubierto en arancel).

Enriquecimiento en **un** query/lote por listado (no N+1 por fila). Periodo: parsear `periodo` del row TuFirma (`anio` / `semestre`); si no se puede resolver, medios = —.

## API (`uniacc-api`)

Extender respuesta de `GET` listado de firmas (mismo endpoint; sin breaking rename):

```ts
{
  // …campos actuales
  created_at: string
  medio_matricula: 'webpay' | 'pagare' | null
  medio_arancel: 'webpay' | 'pagare' | 'cubierto' | null
}
```

- `listContratoFirma` / `listRows` deps: join o map post-query con borradores (+ webpay fallback).
- Tests unitarios del mapeo de etiquetas / fallback.

## UI (`mol` — `GestionFirmasView.vue`)

### Columnas (orden)

RUT · Alumno · Carrera · Nº operación · **Generado** · **Matrícula** · **Arancel** · Quién falta · Estado · Ver

Badges o texto muted para medios (mismo lenguaje visual que el resto del dashboard; sin inventar paleta).

### Paginación

- Page size fijo: **10**.
- Reusar `useTablaPaginada(filasVisibles, 10)`.
- Controles: Anterior / Siguiente + texto `desde–hasta de total` (mismo patrón que otras tablas MOL).
- Al cambiar tab (Todos/Pendiente/Firmado) o búsqueda → `resetPage()`.

### Tipos

Actualizar `ContratoFirmaListRow` en `contratoFirmaApi.ts` con `medio_matricula` / `medio_arancel`.

## Criterios de aceptación

1. Toda fila muestra fecha de generación o `—`.
2. Toda fila muestra matrícula/arancel como Webpay, Pagaré, Cubierto (solo arancel) o `—`.
3. Visible en tabs Todos, Pendiente y Firmado.
4. La tabla muestra como máximo 10 filas; con más resultados hay paginación usable.
5. Sin montos ni folios en esta entrega.

## Fuera de alcance / no hacer

- Persistir medios en `rematricula_contrato_tufirma` al crear el documento.
- Cambiar el diálogo Ver (salvo que reutilice los mismos campos del row).
- Paginación en el API.
