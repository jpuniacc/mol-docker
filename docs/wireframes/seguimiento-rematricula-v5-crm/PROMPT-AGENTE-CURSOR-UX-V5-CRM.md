# Prompt Cursor — Seguimiento rematrícula · UX v5 CRM HubSpot-lite

Usa `/usingsuperpowers`: brainstorming breve → writing-plans → implementación en rama **`dev`**. Solo **mol-dev**. Front CRM (lista/board + drawer) + enriquecimiento mínimo de lectura API caso (email/tel/firmantes). No composer ni envíos reales.

## ⚠️ OJO UX/UI (prioridad alta — no negociable)

Este cambio es **de experiencia**, no un rediseño cosmético. El usuario rechazó la bandeja tipo “tablero de métricas” y pidió explícitamente algo **como un CRM HubSpot**.

Antes de codear y en cada PR, valida:

1. **Sensación CRM**: densidades, tipografía, espaciado y jerarquía deben parecer HubSpot Contacts/Deals (lista limpia, filtros laterales, drawer de record), **no** un dashboard de KPI ni chips/pills de métricas.
2. **Pixel fidelity a los wireframes** en `/opt/mol-docker/docs/wireframes/seguimiento-rematricula-v5-crm/` (01–05). Si te apartas, documenta por qué en el plan; no improvises layouts.
3. **Jerarquía visual**: acciones primarias claras; secundarias quietas. Evitar ruido (demasiados badges, bordes, botones “corte 2”, contadores enormes).
4. **Estados vacíos y carga**: skeleton/empty states legibles; nunca campos hardcodeados en «—» si el API puede traer dato.
5. **Accesibilidad básica**: contraste navy/naranja UNIACC, focus visible, labels humanos (no códigos internos).
6. **Matriculado U+**: la ausencia de Contactar/correo/SMS/WA debe sentirse intencional (copy “Caso cerrado…”), no un bug de botones faltantes.
7. **Smoke visual obligatorio** con capturas Lista, Board, drawer en curso y drawer matriculado **antes** de dar por cerrado.

Si el resultado “funciona” pero se siente genérico, denso o de métricas → **no está listo**.

## Fuente
`/opt/mol-docker/docs/wireframes/seguimiento-rematricula-v5-crm/` (01–05 + PLAN.md)

## Bandeja híbrida (01–02)
- Layout: filtros izquierdos ~220px + main.
- Default: **Lista**. Toggle **Lista | Board** en header junto a Cartera / buscar / Actualizar.
- Board: 8 columnas por etapa embudo (1 Sin ingreso … 8 Matriculado).
- Tabla lean: Alumno(+carrera/RUT) · Etapa(+detalle) · Último contacto · Próxima · Ejecutivo.
- Clic fila o tarjeta → **mismo drawer** derecho ~480px; lista/board quedan detrás (overlay).

## Drawer CRM (03–04)
- Cabecera: nombre, RUT, codcli, chip etapa, carrera.
- Propiedades: email, teléfono, firmantes, ejecutivo, medios pago — **datos API**, no hardcodear «—».
- Timeline: bitácora + eventos sistema (pago, firma, U+).
- Recordatorios automáticos solo si **M && !F**.
- Chips **1–7:** botones **Contactar ▾** + **Agregar nota**. Contactar disabled/tooltip hasta Corte 2 (no mostrar botones “· corte 2”).
- Chip **8 Matriculado U+:**
  - **Solo** «Agregar nota» interna.
  - **Ocultar** correo, SMS, WhatsApp, menú Contactar.
  - Copy: “Caso cerrado en embudo · solo consulta”.

## Evidencia AS-IS
Panel Florencia Paz Salinas Menghini / 22.221.051-8 / 20251DIMA1DR024: Email/Tel/Firmantes en «—» y aún se ven CTAs de envío → incorrecto. TO-BE = frame 04.

## API mínima (sí entra)
Enriquecer `GET .../casos/:codcli` con email alumno, teléfono y resumen firmantes (fuentes ya usadas: borrador / contacto / TuFirma). Solo lectura.

## Restricciones
- mol-dev only · rama `dev` · no prod.
- No cambiar criterios de chips de negocio.
- Colores UNIACC: naranja `#FF5B00`, navy `#1E3A5F`.
- No tocar Composer / scheduler (Corte 2).

## Entregables
Plan · commits en `dev` · smoke visual (4 capturas arriba) · smoke funcional: (1) toggle Lista/Board, (2) drawer en curso con Contactar+nota, (3) drawer matriculado U+ sin CTAs de envío y con datos contacto si existen en BD · lista de archivos.
