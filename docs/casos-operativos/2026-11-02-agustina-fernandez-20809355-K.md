# Caso operativo — Agustina Fernanda Fernández Sáez

Fecha informe: 2026-11-04  
Periodo: **2027-1**  
Fuente cartola Redcompra: 02/11/2026 13:35 · comercio 53102249 · auth **7130** · $200.000

## Identificación

| Campo | Valor |
| --- | --- |
| RUT | `20809355-K` |
| CODCLI | `20241TRIE1DR077` |
| Carrera | Traducción e Interpretariado Bilingüe (Inglés–Español) (`TRIE1DR`) |
| Nombre | AGUSTINA FERNANDA FERNÁNDEZ SÁEZ |
| Contacto MOL | `afeernandez.s@gmail.com` · `950081554` |
| Apoderado | JAIME ANDRES FERNANDEZ CORDERO · `paseopuntaluna@gmail.com` |

## Qué dice la cartola

| Campo cartola | Valor |
| --- | --- |
| Orden de compra | `000000000208093552027-1-91` |
| Tipo | RC POS |
| Monto | $200.000 |
| Auth | 7130 |
| DP / RUT | 20809355-K |

Coincide con Webpay MOL:

| Campo MOL | Valor |
| --- | --- |
| `buy_order` | `208093552027-1-91` |
| Concepto | `matricula` |
| Estado | **autorizada** |
| Auth | `007130` |
| Tarjeta | débito `····0582` |
| Monto | 200000 |
| `num_operacion` reservada | `981861` |
| Ambiente | produccion |
| Tx Chile | 2026-11-02 13:34 |

No hay otros cobros Webpay (arancel) para este RUT.

## Recorrido en MOL

1. TyC, OTP correo/teléfono, apoderado OK, discapacidad omitida (02-11 ~13:26–13:27).
2. Entra a forma de pago y paga **solo matrícula** Webpay $200.000 (auth 007130).
3. Borrador queda en paso 2 con matrícula autorizada; **no** confirma arancel ni inicia firma.
4. Progreso tablero sigue en etapa `datos` (última actividad: omitió discapacidad 13:27).

Estado actual borrador:

| Flag | Valor |
| --- | --- |
| `pasoAlcanzado` | 2 |
| `webpayMatriculaEstado` | autorizada |
| `medioArancel` | (vacío) |
| `webpayMontoArancel` | 1.875.000 (beca Talento Virtual 50% aplicada en simulación) |
| `cuentaWebpayGrabada` | **false** |
| `firmaCompletada` | **false** |
| `envioFirmaIniciado` | **false** |
| `numOperacionCuenta` | 981861 |

Descuentos previstos en borrador:

- Matrícula Anticipada Noviembre $50.000 → paga $200.000 de $250.000.
- Beca Talento Virtual 2 50% sobre arancel ($1.875.000 de descuento).

## ¿Se firmó el contrato 2027-1?

**No.** No hay contrato TuFirma de rematrícula 2027 para esta alumna.

| Pieza | Estado |
| --- | --- |
| `mnp.rematricula_contrato_tufirma` | **sin fila** |
| Log `firma/*` | no hay eventos |
| `envioFirmaIniciado` / `firmaCompletada` | false / false |
| Reserva ops | sí (`mnp.rematricula_operacion` → 981861) |

Nunca llegó al paso de firma: se detuvo tras el cobro de matrícula.

## Matrícula en U+

| Chequeo | Resultado |
| --- | --- |
| `MT_CTAPAG` / `MT_CTADOC` del CODCLI 2027 | **vacío** |
| Staging MOL `mnp_mt_ctapag` | vacío |
| Ops `981861` en U+ | pertenece a **otro** alumno (`22630747`, 2026-2) |

Misma causa raíz que el caso Astorga: ops reservada colisiona con una cuenta ajena ya existente en U+.

## Resumen ejecutivo

Pagó matrícula por Redcompra (voucher MOL OK) y **abandonó el flujo** antes de arancel/firma. La cuenta no se grabó en U+; no hay contrato 2027 enviado ni firmado. Por eso no figura como matriculada.

## Acción sugerida

1. Reservar **nueva** `num_operacion` libre (no reutilizar 981861).
2. Contactar a la alumna para que reingrese a forma de pago: reconocer matrícula ya autorizada (auth 007130) y completar arancel (beca 50% / medio elegido).
3. Grabar cuenta en U+ con la ops nueva.
4. Enviar y completar firma TuFirma (alumno ± apoderado).
5. Cerrar control matrícula.
