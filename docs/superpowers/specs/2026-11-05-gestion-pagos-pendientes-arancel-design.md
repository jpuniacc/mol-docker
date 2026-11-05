# Gestión Pagos — matrícula Webpay sin arancel cerrado

**Fecha:** 2026-11-05  
**Estado:** aprobado (diseño)  
**Proyectos:** mol-docker (Supabase + UI) + uniacc-api-docker (filtro TuFirma)  
**Rollout:** dev primero; prod solo cuando se indique

## Objetivo

Reemplazar en menú el ítem **Seguimiento alumnos** por **Gestión Pagos**: listado operativo de alumnos del **periodo activo** que pagaron **matrícula con Webpay autorizada** y **aún no cerraron el arancel**, con contacto validado por OTP y export Excel/CSV.

## Decisiones

| Tema | Decisión |
|------|----------|
| Menú | Ocultar Seguimiento (`dashboard-rematricula-seguimiento`); nuevo ítem Gestión Pagos |
| Periodo | Fijo a `tp_periodo_activo` (sin selector) |
| Enfoque | **A:** RPC Supabase + vista MOL; exclusión TuFirma vía capa fina en `uniacc-api` |
| Sale del listado | Webpay arancel **autorizada**, **o** operación TuFirma **enviada** |
| Pagaré en borrador solo | **No** saca del listado |
| Contacto | Último OTP exitoso → valores en claro desde borrador validado |
| Acciones | Listar + buscar + export CSV/Excel |
| Paginación | Cliente, 10 filas (`useTablaPaginada`) |
| Fuera de alcance | Botones llamar/mail, cambio de estado, montos, buy_order, paginación server-side |

## Reglas de inclusión / exclusión

**Entra** si, en el periodo activo:

1. Existe `mnp_webpay_transaccion` con `estado = 'autorizada'` y `concepto = 'matricula'` (misma noción que reporte pagos; join por RUT/codcli como ahí).
2. **No** existe Webpay arancel autorizada (`concepto = 'arancel'`, `estado = 'autorizada'`).
3. **No** existe operación de firma enviada a TuFirma para ese alumno/periodo (`rematricula_contrato_tufirma` / operación asociada en Postgres de `uniacc-api`).
4. Arancel **cubierto** (monto 0 / beneficio; misma noción que Gestión de firmas) → **no entra** (no hay arancel pendiente de pago).

**Varias** tx matrícula autorizadas → usar la **más reciente** para `fecha_pago_matricula`.

## Fuentes de datos

### RPC Supabase (ej. `listar_gestion_pagos_pendientes_arancel`)

Devuelve candidatos del periodo activo **antes** del filtro TuFirma:

| Campo | Fuente |
|-------|--------|
| `rut`, `nombre`, `codcli`, `carrera` | Mismas fuentes que Seguimiento / progreso / cartera (consistente con reportes existentes) |
| `fecha_pago_matricula` | Timestamp de la tx Webpay matrícula autorizada más reciente |
| `telefono`, `email` | Ver contacto abajo |
| Claves para filtro API | `codcli`, `rut`, `anio`, `semestre` |

Excluye en SQL: Webpay arancel autorizada; arancel cubierto si se puede resolver en borrador/payload sin N+1 costoso (si no, documentar defer al plan).

### Contacto validado

- Señal OTP: `log_mol_contacto_otp` con `evento = 'verificar_ok'` por canal (`correo` / `telefono`), periodo, no mock.
- Valores en claro: `mol_borrador_rematricula.payload` → `contactoCorreoValidado` / `contactoTelefonoValidado` (se persisten solo tras OTP ok / validación equivalente).
- Si no hay valor validado para un canal → mostrar `—` (la fila **sigue** en el listado).

El log solo guarda máscara; **no** usar `contacto_mascara` como dato de gestión.

### Filtro TuFirma (`uniacc-api`)

- Endpoint delgado (o extensión mínima) que: llama RPC Supabase → quita filas con contrato/operación TuFirma enviada en el periodo → responde al front.
- Criterio “enviada”: existe fila en `rematricula_contrato_tufirma` (o operación ligada) para `codcli`/`rut` + periodo; **no** exige estado Firmado.

## Menú

- `UPDATE bo_menu_item … SET activo = false` (o equivalente) para `route_name = 'dashboard-rematricula-seguimiento'`.
- `INSERT` ítem **Gestión Pagos** bajo el mismo parent rematrícula, mismos grupos que Seguimiento/firmas.
- Ruta nueva kebab-case (ej. `dashboard-gestion-pagos`) + vista lazy + nombre en `dashboardRouteNames` si aplica.

## UI (`mol`)

Vista nueva (estilo Gestión Firmas / reportes):

- Columnas: **RUT · Nombre · Codcli · Carrera · Teléfono · Email · Fecha pago matrícula**
- Búsqueda cliente por RUT / nombre
- Tabla paginada 10 filas
- Botón **Exportar** CSV/Excel del conjunto filtrado (no solo la página visible)
- Fecha UI: `dd/mm/yyyy HH:mm` (zona local); vacío → `—`

## Criterios de aceptación

1. Seguimiento no aparece en menú; Gestión Pagos sí (grupos autorizados).
2. Solo periodo activo; solo matrícula Webpay autorizada sin arancel cerrado (Webpay autorizada o TuFirma enviada).
3. Pagaré solo en borrador **permanece** en el listado.
4. Teléfono/email muestran contacto validado o `—`.
5. Export descarga todos los filas del filtro actual.
6. Máximo 10 filas por página en pantalla.

## Fuera de alcance / no hacer

- Reactivar o rediseñar Seguimiento en esta entrega.
- Acciones de contacto (tel:/mailto:), CRM, notas de gestión.
- Persistir espejo de TuFirma en Supabase.
- Cambiar reglas de cobro o flujo alumno.

## Notas de implementación

- Reutilizar patrones de `reporte_pagos_*` para Webpay y de Gestión Firmas para tabla/paginación/export si ya existe util CSV.
- Tests: SQL/RPC (entra / sale Webpay arancel / cubierto); API (sale por TuFirma); UI smoke listado + export.
