# Plan de pagos: correlativos de documento

Borrador para revisar juntos. Describe lo que MOL hace hoy al generar el plan de pagos del alumno, qué SP de U+ están detrás, y qué todavía hay que acordar antes de grabar la cuenta corriente.

Referencias: [`Analisis_SP.md`](Analisis_SP.md) (ficha de cada SP) y [`matricula-escritura-tablas.md`](matricula-escritura-tablas.md) (cómo caja deja `CTAPAG` / `CTADOC` / `CTADEP`).

Código: `src/utils/documentosDescuentoContrato.ts`, `src/utils/pagareCuotasDraft.ts`, `src/views/matricula-alumno/FormaPagoAlumnoView.vue`. Preflight: `uniacc-api` `src/services/matricula-flujo-preflight.service.ts`.

---

## 1. Cómo se entiende el proceso

Se solicita **un** correlativo. Ejemplo: el peek leído es `90121338250`.

A partir de ese número, y según lo que tenga el alumno, se generan los demás. No se vuelve a pedir un correlativo por cada documento.

1. **Matrícula primero.** El primer código es el peek. Cuántas filas de cuota aparecen depende de las cuotas elegidas (10 o 12). Esas cuotas cuelgan de ese mismo header: `90121338250` → `9012133825001`, `9012133825002`, … La cantidad de cuotas no pide otro `CORRPAGNUM`.
2. **Después el arancel**, siguiendo desde el número siguiente. Qué documentos salen depende de la lógica del alumno: beca estatal, beca interna, convenio, CAE y, al final, el pagaré con lo que quede por pagar. Si el alumno no tiene uno de esos, ese código no se genera y el siguiente documento ocupa el número que sigue.

El peek no se consume en U+ al armar el plan. Se lee y se proyecta en memoria. Mientras caja no ejecute el SP, regenerar el plan con el mismo peek repite los mismos códigos.

---

## 2. Ejemplo

Peek solicitado: `90121338250`. Alumno con 10 cuotas, beca ministerial, beca interna, convenio y CAE.

### Matrícula

| Documento | Código |
| --- | --- |
| Pagaré matrícula (header) | 90121338250 |
| Cuota 1 … cuota 10 | 9012133825001 … 9012133825010 |

### Arancel (sigue el correlativo)

| Documento | Código | Texto en el plan |
| --- | --- | --- |
| Beca estatal | 90121338251 | BECAS ESTATALES ASIGNADAS |
| Beca interna | 90121338252 | BECAS INTERNAS ASIGNADAS |
| Convenio | 90121338253 | DESCTO. CONVENIOS ASIGNADOS |
| CAE | 90121338254 | PAGARÉ CAE |
| Pagaré arancel (header) | 90121338255 | PAGARÉ |
| Cuota 1 … cuota 10 | 9012133825501 … 9012133825510 | |

Si ese alumno no tuviera convenio ni CAE, el pagaré de arancel quedaría en `90121338253`: estatal, interna y pagaré. El salto depende de lo que aplique.

Vencimiento de becas y convenios en el plan: `29/12/{año de notas}`. El pagaré usa la fecha de cada cuota.

---

## 3. SP involucrados

MOL **no ejecuta** el SP que incrementa. El preflight hace `SELECT` del valor vigente, equivalente a `Fn_ValorParame` / `pa08_MT_PARAME_DET_value`.

| SP / objeto | Para qué sirve en este tema | ¿MOL lo ejecuta al armar el plan? |
| --- | --- | --- |
| `sp_parametro_transaccion_correlativo` `@tipo = 'CORRPAGNUM'` | Suma 1 a `MT_PARAME_DET.Valor` y devuelve el `CTAPAGNUM`. Un `EXEC` = un folio de header. | **No.** Se lee el valor y se proyecta `actual + 1`, `+ 2`, … |
| `MT_PARAME_DET` (`IdParametro = 'CORRPAGNUM'`) | Guarda el último número usado. Línea vigente por fecha, `ORDER BY NumLinea DESC`. | **Sí, solo lectura** en el preflight. |
| `SP_VALIDA_PARAMETROS_CAJA` | Comprueba que existan `CORRELATIVO`, `CORRCONTRATO`, `CORRPAGNUM`, etc. Puede reabrir vigencia si el valor está vacío. | **No.** El preflight solo verifica que la fila exista. |
| `sp_lista_docpag_matricula_caja` | Lista documentos de pago de matrícula (`@DESPLIEGA = 'M'`) y arancel (`'A'`). | Sí, en otro paso de la pantalla. El pagaré del plan sigue fijo en tipo **5**; la lista no elige el folio. |
| `pa08_MT_ARANCEL_sel_MATRICULA_NET` | Montos de matrícula y arancel. | Sí. Define el bruto sobre el que se calculan becas y el pagaré. |
| `SP_GENERACORRELATIVOIDCUOTA` | En caja, un id por cuota (`ID_CUOTA`). | **No.** En staging ese id es `IDENTITY`. El folio visible de la cuota es la concatenación, no este SP. |

Otros tipos del **mismo** SP, que el plan de pagos no usa para estos folios pero el grab de la matrícula sí va a necesitar:

| `@tipo` | Columna | Cuándo lo gasta U+ |
| --- | --- | --- |
| `CORRELATIVO` | `num_operacion` | Al grabar la operación |
| `SECUENCIA` | `ctadocnum` de la boleta 41 | Al armar el cargo de matrícula y el de arancel (dos números) |
| `CORRCONTRATO` | `ctadoc.contrato` | En la UI, antes del grab |
| `SECUENCIADOCITEM` | `keyDocItem` en UMAS | Un EXEC por ítem. En staging es `IDENTITY`. |

Ficha completa: [`Analisis_SP.md` → `sp_parametro_transaccion_correlativo`](Analisis_SP.md#sp_parametro_transaccion_correlativo).

---

## 4. Cómo queda cada documento en la cuenta corriente

Orden de cobertura que vimos en caja (trace `17562199`): **beca → CAE → pagaré**. El pagaré es el residual.

| Medio | `ctapag` | ¿Tiene cuotas? | Folio de cuota |
| --- | --- | --- | --- |
| Beca interna | 373 | No | — |
| CAE | 21 | Sí, una | header + `01`, `ctadoc` 21 |
| Pagaré alumno | 5 | Sí, N (10 o 12) | header + `01`…`N`, `ctadoc` 14 |

Fixture real (operación `960249`, no es una secuencia continua porque caja pidió cada número en momentos distintos):

| Ítem | Medio | `ctapagnum` |
| --- | --- | --- |
| Matrícula | Beca 373 | 90121395915 |
| Matrícula | Pagaré 5 | 90121395912 |
| Arancel | Beca 373 | 90121395916 |
| Arancel | CAE 21 | 90121395913 |
| Arancel | Pagaré 5 | 90121395914 |

Detalle de columnas: [`matricula-escritura-tablas.md` §5 y §7](matricula-escritura-tablas.md).

---

## 5. Qué hace el plan hoy, para contrastarlo

El código todavía reserva los dos pagarés al inicio (matrícula = peek, arancel = peek + 1) y recién después numera becas, convenios y CAE. La lectura de arriba es la otra: matrícula completa primero, y el arancel —becas, convenio, CAE y su pagaré— sigue después, solo con lo que el alumno tenga.

- Entran al plan las líneas con monto mayor que 0: estatal (sobre el arancel, antes que las internas), interna ganadora, Apoyo 1756 y convenios.
- Si el alumno tiene CAE, se reserva un código aunque el monto aprobado venga en 0. El monto, cuando existe, se lee de `mnp_estado_cae_alumnos.monto_cae_aprobado` (beneficio 4).
- El pagaré de arancel es el arancel menos estatal, internas y convenios. **El CAE no resta** ese saldo.
- El código queda en el plan y en el PDF del contrato. Todavía **no** se inserta en `mnp_mt_ctapag`.

---

## 6. Para conversar

1. **Orden de los números.** La lectura de este documento: matrícula primero (header + cuotas colgando de ese número) y después el arancel según la lógica del alumno. El código aún no está en ese orden. En el trace de caja cada pantalla pidió su `CORRPAGNUM` en el momento en que armó ese documento, así que los folios del fixture no salen consecutivos.
2. **Un EXEC por header, más adelante.** Hoy nadie incrementa `MT_PARAME_DET`. Al grabar, ¿MOL sigue usando estos peek locales, o ahí sí se hace un `EXEC` de `CORRPAGNUM` por cada `CTAPAG`?
3. **Código `ctapag` de estatal y de convenio.** En caja vimos 373 (interna), 21 (CAE) y 5 (pagaré). El plan muestra “BECAS ESTATALES ASIGNADAS” y “DESCTO. CONVENIOS ASIGNADOS”, pero no tenemos el tipo de documento de pago de esos dos. Hay que confirmarlo en `MT_DOCPAG` / en un trace antes de grabar.
4. **CAE y el residual.** En caja el CAE cubre parte del arancel y el pagaré 5 es lo que sobra, con una cuota `ctadoc` 21. El plan reserva el código y no descuenta el CAE del pagaré del alumno. ¿El monto del pagaré CAE es el aprobado en `MT_POSBEN`, y el pagaré 5 queda con el saldo?
5. **Varias becas, varios folios.** El trace agrupa la beca interna del ítem en **un** header 373. El plan da **un folio por beca** (Talento y Apoyo por separado, cada convenio por separado). ¿Un `CTAPAG` por beca o uno por tipo (todas las internas juntas, todos los convenios juntos)?
6. **Matrícula sin descuento.** Hoy la matrícula va a precio pleno y su único documento numerado es el pagaré 5. Si más adelante hay beneficio de matrícula (en el trace, anticipación 1665 → 373), ese header también tiene que salir del mismo peek.
