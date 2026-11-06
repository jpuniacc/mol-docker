# Seguimiento rematrícula — ajustes UI v3 (post CORTE 1)

**Fecha:** 2026-11-06  
**Estado:** diseño aprobado (brainstorming)  
**Proyecto:** `mol-docker` (solo front)  
**Rollout:** **mol-dev / uniacc-desarrollo**. No prod (`uniacc-mol`) sin OK explícito.  
**Wireframes:** `docs/wireframes/seguimiento-rematricula-v3-ajustes/` (`01`–`04` + `PLAN.md` + `PROMPT-AGENTE-CURSOR-AJUSTES-UI-V3.md`)  
**Base:** CORTE 1 ya en mol-dev (`BandejaSeguimientoRematriculaView`, API lectura, bitácora). Spec CORTE 1: `2026-11-06-seguimiento-rematricula-bandeja-corte1-design.md`.

## Objetivo

Alinear la UI AS-IS de la bandeja al wireframe v3 **sin cambiar reglas de negocio** del embudo, cartera, chips ni bitácora.

## Decisiones de alcance (brainstorming)

| Tema | Decisión |
|------|----------|
| Enfoque de código | **1:** cambios en `BandejaSeguimientoRematriculaView.vue` + 1–2 utils (mapa color / labels) |
| Sin contactar +7d | **A:** pill visible; contador `—` o `0`; **no filtrable**; KPI/filtro real = CORTE 2 / API |
| Contacto panel (email/tel/firmantes) | **A:** UI con **«—»**; **sin** ampliar `/casos/:codcli` |
| Cartera supervisor | **A:** pill navy + «Ver todas» + `Select` de emails **únicos presentes en `filas` cargadas**; sin endpoint nuevo |
| Mail 2h / SMS 24h pills | Contadores KPI visibles; **sin filtrar** (API no expone `filtroAux`; no inventar en este PR). Mismo trato que +7d |
| Overlay panel | Cerrar con click en fondo **y Escape** |
| Reglas chips / API / migraciones | **No tocar** |
| Prod | **No** copiar ni rebuild prod en este PR |

## Fuera de alcance (CORTE 2)

- Composer WYSIWYG + firma imagen.
- Envío real correo/SMS; enqueue/scheduler outbox 2h/24h vs `mol_retencion_aviso`.
- WhatsApp real.
- KPI + filtro real «Sin contactar +7d».
- Enriquecer payload caso (email/tel alumno, firmantes TuFirma).
- Ver `docs/wireframes/seguimiento-rematricula-v2/PROMPT-AGENTE-CURSOR-CORTE-2.md`.

## Bandeja

### Chips embudo 1–8

- Orden y claves: `ORDEN_CHIPS_BANDEJA` / `ETIQUETA_CHIP_BANDEJA` (sin cambiar mapeo de negocio).
- UI: número `1…8` + label corto; chip activo borde/ring `#FF5B00`; inactivos borde navy suave (`#1E3A5F` ~20% opacity).
- Conteos: mismos KPI CORTE 1.

### Auxiliares

- Pills: `Sin contactar +7d —` (no click / no filtra), `Mail 2h pdte N`, `Mail 2h enviado N`, `SMS 24h pdte N`, `SMS 24h enviado N`.
- Mail/SMS: **solo display** de KPI (no hay filtro API hoy; no inventar `filtroAux`).
- **Quitar** texto debug tipo «(outbox vacío en CORTE 1…)».

### Cartera

- Perfil 3 (`alcanceCartera` ejecutivo): pill navy fija «Cartera: mía (email sesión)»; sin «Ver todas».
- Perfiles 1/2: `Select` de ejecutivos derivados de `filas[].email_ejecutivo`. **`filtroEjecutivo === ''` = Ver todas** (sin override; comportamiento actual). El select solo acota; **no** hay un tercer modo «mía» (eso es solo perfil 3).
- Lista del select puede ser incompleta (solo página/carga actual); aceptado en este PR.
- **Hint obligatorio** junto al select: *«Ejecutivos en la carga actual»* (el supervisor no debe creer que es el universo completo).

### Tabla

Columnas (sin cambio de contrato de fila):

Alumno (nombre + RUT) · Carrera · Etapa · Subetapa F.pago · Mat. Webpay · Mail 2h · SMS 24h · Último contacto · Próxima acción · Ejecutivo · Abrir.

- **Etapa:** badge con **color por chip** (mapa fijo 8 tonos; no todos naranja).
- **Subetapa:** humanizar (`cae` → `CAE`, `ministerial` → `Beneficio min.`, `ambos` → `Ambos`, `resto` → `Resto`; null → `—`).
- Sin IDs internos / notas debug visibles al usuario.

## Panel caso

- Overlay semitransparente (`bg-black/40`); cierra con **click en fondo** y **Escape**; drawer derecho existente.
- Cabecera: nombre, RUT, `codcli`, badges etapa (+ subetapa si aplica) con mismo mapa de color.
- Bloque contacto: email / teléfono / firmantes → **«—»** hasta CORTE 2 (payload).
- Resumen matrícula / arancel / firmantes: usar lo ya disponible en la fila (`mat_webpay_fecha`, etc.); resto «—».
- **Retención automática:** estados `pdte` / `enviado` / `n/a` vía `etiquetaOutboxUi`. Si `n/a`, copy: *«No aplica: sin matrícula Webpay o firma ya completa»*.
- CTAs disabled: «Enviar correo · corte 2», «Enviar SMS · corte 2», «WhatsApp · próximamente».
- «Agregar contacto» + timeline bitácora: **mismo contrato API**; icono simple por `canal` (llamada / sms / whatsapp / nota / otros).

## Archivos previstos (front)

| Archivo | Cambio |
|---------|--------|
| `src/views/dashboard/rematricula/BandejaSeguimientoRematriculaView.vue` | Layout chips, auxiliares, cartera, tabla colores, panel overlay/copy/CTAs |
| `src/utils/seguimientoBandejaChip.ts` (o util hermano) | Nº chip, labels cortos si hace falta, `colorEtapaChip`, `etiquetaSubetapa` |
| Tests unitarios utils existentes / nuevos | Mapa color + humanización subetapa |

**No tocar:** `uniacc-api-docker` servicios/controllers seguimiento, migraciones, scheduler.

## Smoke visual (mol-dev)

1. Chips 1–8 numerados; activo naranja; inactivos navy suave.  
2. Pill +7d visible sin filtrar; sin texto debug outbox.  
3. Perfil 3: solo pill mía. Supervisor: Ver todas + select (sin input libre).  
4. Columna Etapa coloreada por chip; subetapa humanizada.  
5. Abrir caso: overlay; retención n/a con copy; CTAs corte 2 disabled; bitácora OK.

## Entregables

1. Este design doc + plan corto (writing-plans).  
2. Commits / PR en rama `dev` (solo mol-docker front).  
3. Lista de archivos tocados.  
4. Notas de smoke en mol-dev.  
5. Confirmación explícita de lo que queda CORTE 2 (tabla de fuera de alcance arriba).
