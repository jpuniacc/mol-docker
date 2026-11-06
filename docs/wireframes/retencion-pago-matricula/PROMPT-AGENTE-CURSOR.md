# Prompt para agente Cursor — Retención tras pago de matrícula (MOL)

Copia este bloque completo al agente de Cursor (mol-dev / uniacc-desarrollo). Wireframes y plan en:

`/opt/mol-docker/docs/wireframes/retencion-pago-matricula/`

---

## Contexto

En rematrícula MOL (UNIACC), varios alumnos pagan la **matrícula** por Webpay y después cierran el navegador, salen del flujo o cierran el modal Forma de pago **sin elegir el medio del arancel ni firmar el contrato**. No quedan matriculados en U+ y Finanzas no puede cuadrar la caja diaria.

**La solución NO es grabar el pago antes en U+.** El objetivo es convencer al alumno de que **termine el proceso** (arancel + firma).

Trabajo solo en **mol-dev** (`/opt/mol-docker`) y API en **uniacc-api-docker** si aplica. **No tocar prod (uniacc-mol).** Antes de cambiar código: backup. Confirmar con el usuario antes de merge/prod. Responder en español, conciso. No mostrar secretos.

## Problema a resolver

Alumno con matrícula Webpay **autorizada** abandona antes de cerrar arancel y/o firma → proceso incompleto, pago recibido pero rematrícula no completa.

## Condición “incompleto” (usar en front y backend)

Identidad autenticada + codcli + periodo (no solo sessionStorage).

- **M** = última transacción matrícula Webpay confirmada por servidor con `estado === 'autorizada'`.
- **F** = contrato con todos los firmantes requeridos listos (`ready`) / `firmaCompletada` reconciliado.
- **P (pendiente de retención)** = M && !F && periodo activo y alumno elegible.

**Arancel pendiente** si neto confirmado > 0 y:

`(medioArancel == null) || (medioArancel === 'webpay' && webpayArancelEstado !== 'autorizada') || (medioArancel === 'pagare' && pagoMatricula == null)`

(con plan pagaré válido para el concepto/periodo).

Si arancel neto ≤ 0 o arancel ya cerrado → falta **firma**, no volver a pedir arancel.  
Si `envioFirmaIniciado` → continuar Firma.  
Si F pero falla matriculación U+ → resumen/incidente operativo; **no** pedir repetir cobro al alumno.  
**Nunca** cobrar matrícula otra vez.

Referencia lógica existente: `utils/webpaySiguientePaso.ts`, `utils/pasoAlumnoRematricula.ts`, store `matriculaAlumnoContext.ts`.

## Documentación y wireframes (obligatorio leer)

Directorio: `/opt/mol-docker/docs/wireframes/retencion-pago-matricula/`

- `PLAN.md` — condiciones, archivos, límites y métricas por punto.
- `PROMPT-AGENTE-CURSOR.md` — este archivo.
- PNG retención:
  - `01-beforeunload-escritorio.png`, `01-beforeunload-movil.png`
  - `02-modal-salida-escritorio.png`, `02-modal-salida-movil.png`
  - `03-retorno-webpay-escritorio.png`, `03-retorno-webpay-movil.png`
  - `04-correo-2h.png`, `04-correo-24h.png`
  - `04-sms-2h-movil.png`, `04-sms-24h-movil.png`
  - `05-reingreso-escritorio.png`, `05-reingreso-movil.png`
- Subcarpeta `modal-forma-pago/` (warning al cerrar Dialog Forma de pago):
  - `PLAN.md`
  - `01-modal-x-escritorio.png`, `01-modal-x-movil.png`
  - `02-warn-arancel-escritorio.png`, `02-warn-arancel-movil.png` (caso Finanzas)
  - `03-warn-ambos-escritorio.png`, `03-warn-ambos-movil.png`
- `html/` y `gen.py` son referencia de generación; no son runtime.

---

## ETAPA 1 — Front MOL (prioridad)

Implementar en mol-dev. Alineado a wireframes. Tests donde aplique. Sin adelantar grabado U+.

### 1.1 Retorno Webpay + persistencia

Archivos: `WebpayRetornoAlumnoView.vue`, `VoucherWebpayDialog.vue` (y bloque de progreso si hace falta).

- Solo si concepto matrícula y estado **autorizada** verificado.
- UI: “Pago de matrícula recibido · Paso 1 de 3”, micro-stepper Matrícula ✓ → Arancel → Firma, CTA grande según `siguientePaso()` (“Continuar con el arancel” / “Continuar a la firma” / etc.). Comprobante secundario/colapsable. Descargar no marca proceso completo.
- **flushBorrador:** en el código actual ya se hace `await guardarEstadoConcepto` / `asegurarBorradorPersistido`. Mejorar: si falla persistencia, UI de recuperación visible (no solo `console.warn`); no redirigir sin flush OK (o reconciliación servidor). Nunca repetir cobro de matrícula.
- Wireframes: `03-retorno-webpay-*.png`.

### 1.2 Reingreso

Archivos: `MatriculaAlumnoLayout.vue`, home alumno, `router/index.ts`, store (hidratación awaitable).

- Tras login: esperar carga/conciliación borrador + Webpay + contrato.
- Si P: banner “Tu matrícula ya está pagada…” + `router.replace` al paso pendiente (sin bucle ni nuevo cobro).
- Wireframes: `05-reingreso-*.png`.

### 1.3 Modal de salida global (router)

Archivos: `MatriculaAlumnoLayout.vue`, `router/index.ts`, composable/modal de retención.

- Si P e intenta Salir / logo / menú / atrás SPA: modal propio con texto acordado; **[Completar ahora]** / **[Salir igual]**.
- Logout móvil: confirmar **antes** de `auth.logout`.
- No bloquear avance normal ni transferencias Webpay/TuFirma.
- Wireframes: `02-modal-salida-*.png`.

### 1.4 beforeunload

- Listener solo mientras P; mensaje genérico del navegador (no personalizable). Desarmar en handoff autorizado a Webpay/TuFirma.
- Wireframes: `01-beforeunload-*.png`.
- Limitación: móvil/cierre de proceso no garantizado.

### 1.5 Warning al cerrar modal Forma de pago ← **NUEVO (ETAPA 1)**

Archivo principal: `src/views/matricula-alumno/FormaPagoAlumnoView.vue` (`pagoMatriculaDialogOpen`).

**Hoy:** X, Cancelar y `@update:open(false)` → `cerrarPagoMatriculaDialog()` / `onPagoMatriculaDialogOpenChange` cierran de inmediato (salvo countdown Webpay, que solo se cancela).

**Pedido:** si el alumno cierra con **X, Cancelar, Escape u overlay** y matrícula o arancel **aún no están cerrados**, **NO** cerrar de inmediato. Mostrar warning encima:

- Título: **“Termina tu rematrícula”**
- Texto según caso:
  - **Solo arancel** (matrícula Webpay autorizada — caso Finanzas): matrícula pagada; falta elegir arancel (y firma).
  - **Ambos:** falta medio de matrícula y arancel (y firma).
- Botones:
  - **[Seguir completando]** (primario `#FF5B00`) → cancela el cierre; el Dialog Forma de pago sigue abierto.
  - **[Salir igual]** → **solo** cierra el Dialog Forma de pago (`cerrarPagoMatriculaDialog`); **no** dispara logout global ni el modal de Salir del layout.
- **No disparan** el warning: Continuar (avanza selector/plan/Webpay), countdown/redirección a Webpay (`faseSalida === 'webpay'`), arancel cubierto (neto ≤ 0) con matrícula ya autorizada, firma completa.

**Decisiones del usuario (ya tomadas):** Escape/overlay también confirman; Salir igual solo cierra el Dialog.

Wireframes: `modal-forma-pago/01-*.png`, `02-warn-arancel-*.png`, `03-warn-ambos-*.png` y `modal-forma-pago/PLAN.md`.

Este warning **complementa** el modal global de 1.3; no lo reemplaza.

---

## ETAPA 2 — Recordatorios (API + outbox)

Solo tras ETAPA 1 estable y con aprobación explícita. Canales: correo (EmailService existente) y SMS Celmedia (OTP hoy; plantilla/disparador de retención **nuevos**). WhatsApp automático **no** existe → no implementarlo sin decisión aparte.

- Cadencia recomendada: **correo a las 2 h** + **SMS a las 24 h** si sigue P (no cuatro avisos por defecto).
- Disparo desde autorización backend (`authorized_at` / tx Webpay), no solo si el alumno volvió al voucher.
- Revalidar P justo antes de enviar. Enlace `/retomar` (dominio UNIACC a definir) con **login obligatorio**; sin RUT/tarjeta ni links de firma con acceso directo.
- Extender outbox/scheduler/templates en `uniacc-api-docker`; dedupe; horario America/Santiago; sin envíos reales en prod sin piloto.
- Wireframes: `04-correo-*.png`, `04-sms-*-movil.png`. Detalle en `PLAN.md` sección 4.

---

## Métricas

- Retornos matrícula autorizada con `continuar_ok` y firma ≤ 24 h.
- Reingresos P que llegan al paso correcto; bucles router = 0; cobros duplicados = 0.
- Modal global: Completar ahora / mostrado; firma ≤ 24 h.
- Warning Forma de pago: Seguir completando vs Salir igual; cierre incompleto del Dialog.
- Recordatorios (etapa 2): entregados, clicks autenticados, cierre de firma por cohorte/ventana/canal.

## Reglas

1. Solo mol-dev (y API docker si etapa 2); **nunca prod** sin instrucción explícita.
2. Backup antes de cambios; confirmar merges.
3. No grabar pagos en U+ antes de firma/flujo actual.
4. No inventar endpoints; reutilizar `siguientePaso`, flush, EmailService, Celmedia.
5. Datos de wireframe son ficticios; no usar montos/nombres de ejemplo en prod.
6. Al terminar ETAPA 1: listar archivos tocados, cómo probar (matrícula autorizada + cerrar modal / Salir / retorno / reingreso) y qué quedó pendiente de ETAPA 2.

## Orden sugerido de implementación (ETAPA 1)

1. Warning Forma de pago (1.5) — cambio local acotado.  
2. Retorno + persistencia (1.1).  
3. Reingreso (1.2).  
4. Modal salida global (1.3).  
5. beforeunload (1.4).  

Luego ETAPA 2 con aprobación.
