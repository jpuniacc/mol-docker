# Prompt Cursor — Seguimiento rematrícula · UX v4 (modo trabajo)

Usa `/usingsuperpowers`: brainstorming breve → writing-plans → implementación en **`dev`**. UX front de bandeja/panel. Si el payload del caso no trae email/tel/firmantes, **sí** se permite un cambio mínimo de API solo para enriquecer el panel (lectura). No composer ni envíos.

## Fuente
`/opt/mol-docker/docs/wireframes/seguimiento-rematricula-v4-ux/` (01–05 + PLAN.md)

## Bandeja (como 02)
- Header: título + **un** select Cartera + buscar + Actualizar.
- Embudo: fila compacta (no 8 tarjetas).
- Alertas en dropdown (no 5 pills).
- Tabla lean: Alumno(+carrera) · Etapa(+detalle) · Último contacto · Próxima · Ejecutivo · Abrir.
- Labels humanos.

## Panel (03 y 05)
- Bloques Contacto · Progreso · Recordatorios · Bitácora.
- **Contacto:** mostrar email / teléfono / firmantes reales del caso (dejar de hardcodear «—»). Si falta dato, «—» solo entonces.
- **Si `chip === 'matriculado'` (Matriculado U+):**
  - **Ocultar** Enviar correo, Enviar SMS, WhatsApp, menú Contactar y (preferido) Agregar contacto.
  - Copy breve tipo “Caso cerrado en embudo · solo consulta”.
  - Bitácora solo lectura.
- Chips 1–7: Agregar contacto sí; Contactar ▾ disabled/tooltip hasta Corte 2 — **no** botones “· corte 2” visibles.

## Evidencia
Panel AS-IS Matriculado U+ (Florencia / 22221051-8): Email/Tel/Firmantes «—» y aún se ven CTAs de envío → incorrecto.

## Restricciones
mol-dev only; no prod; no cambiar criterios de chips. Naranja `#FF5B00`, navy `#1E3A5F`.

## Entregables
Plan · commits `dev` · smoke: abrir un matriculado U+ sin CTAs de envío y con datos de contacto si existen en BD · lista archivos.
