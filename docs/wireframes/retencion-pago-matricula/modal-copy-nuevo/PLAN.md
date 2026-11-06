# Copy propuesto — modal de salida y banner de reingreso

Solo diseño. No modifica front/API/BD. Complementa el PLAN y wireframes base en `../` (retención tras pago matrícula). Datos ficticios.

## Condición
P = matrícula Webpay autorizada (M) && firma incompleta (!F) && periodo activo.

## 1. Modal de salida (router) — 01-modal-copy-*.png · 02-modal-sobre-retorno-*.png
Disparo: Salir / logo / menú / Atrás dentro de MOL mientras P. No al avanzar a Arancel/Firma ni transferencias Webpay/TuFirma.

**Copy (falta arancel + firma):**
- Título (naranja UNIACC + negrita): `Tu rematrícula aún está pendiente`
- Subtítulo: `Tu matrícula ya está pagada, pero todavía debes completar tu proceso de rematrícula. Para finalizarlo, falta seleccionar la forma de pago del arancel y firmar tu contrato.`
- Caja: `¡No te preocupes! Tu pago de matrícula ya está registrado. No necesitas volver a pagarlo. Solo debes continuar con los pasos pendientes.`
- Primario: `Continuar rematrícula`
- Secundario: `Salir por ahora`

**Variante** si arancel ya resuelto: subtítulo → `Falta firmar tu contrato`.

Comportamiento: primario cancela salida y resuelve paso; secundario hace `await flushBorrador` si hay cambios, conserva destino y no borra borrador. En móvil confirmar ANTES de `auth.logout`.

## 2. Banner de reingreso — 03-reingreso-banner-*.png · 04-reingreso-contexto-*.png
Disparo: post-login / reentrada al flujo con P. Un solo CTA (sin “Salir”).

**Copy:**
- Franja naranja: `Tu avance está guardado`
- Título: `¡Tu matrícula ya está pagada! Retomemos donde quedaste.`
- Cuerpo: `Tu pago de matrícula está registrado y tu avance se ha guardado. Para completar tu rematrícula, solo falta seleccionar la forma de pago del arancel y firmar tu contrato.`
- Énfasis: `No necesitas volver a pagar la matrícula.`
- CTA: `Continuar mi rematrícula →`
- Pie: `Te llevaremos directamente al paso que tienes pendiente.`

Tras CTA: conciliar borrador + Webpay + contrato y `router.replace` al paso pendiente (arancel o firma). Nunca nuevo cobro de matrícula.

## Archivos a tocar (cuando se implemente, con aprobación)
- Modal: `MatriculaAlumnoLayout.vue` + composable/modal de retención (ver PLAN padre §2).
- Reingreso: layout / vista de entrada post-login (ver PLAN padre §5).
- No tocar prod; solo mol-dev tras aprobación y respaldo.

## Relación con wireframes previos
Sustituye el copy de `02-modal-salida-*` y `05-reingreso-*` del directorio padre. El resto (beforeunload, retorno Webpay, correos/SMS 2h/24h, modal Forma de pago) sigue vigente.
