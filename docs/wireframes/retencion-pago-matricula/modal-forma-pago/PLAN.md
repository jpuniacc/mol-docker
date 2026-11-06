# Warning al cerrar modal Forma de pago

Complementa la retención global (beforeunload + modal Salir/logo). Este aviso es local al Dialog de medios.

## Vista actual (solo lectura mol-dev)
- `src/views/matricula-alumno/FormaPagoAlumnoView.vue`
- Dialog `pagoMatriculaDialogOpen` + `DialogScrollContent`
- Cierre hoy:
  - X / overlay / Escape → `@update:open` → `onPagoMatriculaDialogOpenChange(false)` → `cerrarPagoMatriculaDialog()` (salvo countdown Webpay: solo cancela cuenta regresiva)
  - Cancelar → `cancelarOCerrarPagoMatricula()` → mismo cierre (o cancela Webpay)
- Señales: `webpayMatriculaEstado`, `webpayArancelEstado`, `medioMatricula`, `medioArancel`, `pagoMatricula` (plan), `firmaCompletada`; util `puedeContinuar` / `siguientePaso`.

## Cuándo activar el warning
Si el alumno intenta cerrar el modal (X, Cancelar, overlay/Escape si aplica) y el proceso de pago aún no está cerrado para rematrícula:

**Caso A (Finanzas, más común):** matrícula Webpay autorizada y arancel aún pendiente  
`(webpayMatriculaEstado === 'autorizada') && arancelPorPagar > 0 && (medioArancel == null || (medioArancel==='webpay' && webpayArancelEstado!=='autorizada') || (medioArancel==='pagare' && pagoMatricula==null))`

**Caso B:** matrícula aún no cerrada (no autorizada Webpay y no pagaré confirmado) y/o arancel pendiente.

Texto:
- A: “Tu matrícula ya está pagada… falta arancel (y firma).”
- B: “Falta matrícula y arancel…”

Botones: **[Seguir completando]** (primario #FF5B00) → cancela el cierre, modal Forma de pago sigue abierto.  
**[Salir igual]** → cierra el Dialog (comportamiento actual de `cerrarPagoMatriculaDialog`), sin borrar avance Webpay ya autorizado.

## Qué NO dispara el warning
- Continuar (avanza selector / plan / Webpay)
- Countdown o redirección a Webpay (`faseSalida === 'webpay'`) — hoy Cancelar/X solo abortan el countdown
- Arancel neto ≤ 0 (cubierto) y matrícula ya autorizada → el cierre del selector puede ir a firma; no tratar como “falta arancel”
- Firma ya completa

## Relación con retención global
Si el alumno pulsa Salir/logo fuera del modal, aplica el modal global ya wireframeado. Este warning cubre solo el cierre del Dialog Forma de pago.

## Archivos a tocar (tras aprobación, solo mol-dev)
- `FormaPagoAlumnoView.vue`: interceptar `onPagoMatriculaDialogOpenChange(false)` y `cancelarOCerrarPagoMatricula` cuando aplique condición; nuevo AlertDialog/confirm
- Opcional: helper compartido con `useRetencionRematricula` para textos/condiciones de “pago incompleto”
- Tests del cierre condicional

## Limitaciones
- No sustituye beforeunload ni el guard de router
- No inventar grabado temprano en U+
