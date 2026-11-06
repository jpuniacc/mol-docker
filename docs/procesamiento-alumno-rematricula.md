# Cómo se procesa un alumno en la rematrícula

Documento de los flujos probados en Test. Sirve para leer una matrícula ya grabada y para repetir un caso sin mezclarlo con otro.

Hay un solo grabado. El convenio agrega el certificado antes de pagar. La beca interna entra en la lista de beneficios. Sin beca ni convenio, esa lista va vacía.

## Dos códigos distintos

| Dónde | Qué es | Ejemplo Catalina |
|---|---|---|
| `MT_ALUMNO.CODCLI` y el SP de la ficha | Código académico | `20221TRIE1DR076` |
| `MT_CTADOC`, `MT_CTAPAG`, `MT_CTADEP`, `MT_DOCITEM`, `MT_POSBEN` | RUT sin dígito verificador | `21260860` |

La cartera y los correos usan el código académico. Las cuentas de U+ usan el RUT.

## Camino común

1. El alumno entra con LDAP. Un enlace sin sesión va al login, no al 404. `/matricula-alumno/...` se resuelve a `/dashboard/matricula-alumno/...`.
2. Datos personales: correo personal con OTP real, teléfono, encuesta de discapacidad y términos.
3. Forma de pago. Los beneficios salen de la cartera del alumno. Si no hay convenio vigente, el pago no espera certificado.
4. Firma del contrato. TuFirma queda en `mnp.rematricula_contrato_tufirma` (Postgres de uniacc-api), con `num_operacion` y `document_id`.
5. Al firmar, uniacc-api ejecuta `dbo.sp_mol_grabar_plan_pagos` **solo en U+ Test**.
6. Después del commit llama `dbo.SP_MOL_ACTUALIZA_MATRICULA_FIRMADA` con el código académico. La ficha queda `ANO_MAT = 2027`, `PERIODO_MAT = 1`, `PERIODOS = 2`, `FEC_MAT` del momento.
7. Se encolan dos correos: consejero con copia a mol@uniacc.cl, y el alumno a su correo validado. El texto dice el año, por ejemplo «periodo 2027». El del alumno no lleva enlace a la rematrícula.

Cada firma pide un número de operación nuevo. Grabar a un alumno no reescribe la operación de otro.

El avance del asistente vive en `sessionStorage` hasta cerrar sesión. Para repetir el flujo hay que hacer logout, además de borrar los registros de la prueba.

## Qué escribe el procedimiento en U+ Test

Procedimiento: `docs/SP a U+/sp_mol_grabar_plan_pagos.sql`. Caja de prueba **997**, usuario **69065**.

| Pieza | Tabla | Cómo queda |
|---|---|---|
| Cargo de matrícula y arancel | `MT_DOCITEM` | Boleta 41, bruto, `MONTOINT` 0, `DEVENGO_SEM` SI, sede STGO |
| Boleta | `MT_CTADOC` 41 | Bruto. Matrícula ítem 1, arancel ítem 2. Apoderado de `MT_CLIENT`, sede STGO, fecha del día, `FECREG` de la caja abierta |
| Pagaré | `MT_CTAPAG` tipo 5 | Uno por matrícula y uno por arancel, por el saldo (bruto menos beneficios de ese concepto) |
| Cuotas | `MT_CTADOC` tipo 14 | 10 o 12 cuotas. El resto de pesos va en la última. Apoderado de `MT_CLIENT`, sede STGO, fecha del día, jornada de `MT_ALUMNO` |
| Cruce pagaré contra boleta | `MT_CTADEP` | El pagaré tipo 5 aplicado a la boleta 41 |
| Cada beneficio | `MT_POSBEN` estado 4 | `MONTOINT`, `PORCINT` y `PORC_PAR` en 0 |
| Pago del beneficio | `MT_CTAPAG` | Tipo = `MT_BENEFICIO.FPAGOGENERADA` (el convenio Caja Los Andes usa 374) |
| Cruce del beneficio | `MT_CTADEP` | Contra la boleta del concepto: M matrícula, A arancel |

Si el alumno no tiene otro apoderado en `MT_CLIENT`, el apoderado de boleta, cuotas, pagos y depósitos queda en el propio RUT.

Una lista de beneficios vacía no inserta `MT_POSBEN` ni pagos de beneficio. Si el beneficio ya existe en `MT_POSBEN` para ese periodo, el procedimiento se detiene. Para repetir al mismo alumno hay que borrar esa matrícula 2027 antes.

Producción no se escribe desde este flujo.

## Dónde queda el avance en MOL

Postgres de Supabase, además de la sesión del navegador:

| Qué | Tabla |
|---|---|
| Correos al consejero y al alumno | `mnp_aviso_consejero` |
| Caso del certificado | `mnp_caso_rematricula` |
| Archivo del convenio | `mnp_convenio_documento` |
| Términos, OTP, encuesta, matrícula registrada | `log_mol_tyc_respuesta`, `log_mol_contacto_otp`, `mnp_discapacidad_encuesta`, `log_mol_evento` |
| Embudo | `mnp_progreso_rematricula`, etapa `sin_ingreso` después de limpiar y refrescar |

La limpieza de MOL está en `docs/limpieza-prueba-rematricula.md`. Esa guía no borra U+. Para repetir la firma también hay que borrar en Test la operación 2027 (`MT_CTADEP`, `MT_DOCITEM`, `MT_CTADOC`, `MT_CTAPAG`, `MT_POSBEN`) y devolver `MT_ALUMNO` a 2026, más la fila de `mnp.rematricula_contrato_tufirma`.

## Caso con convenio

Probado con Catalina Paz Santa María Santa María.

| | |
|---|---|
| RUT | 21260860-2 |
| Código académico | 20221TRIE1DR076 |
| Carrera | Traducción e Interpretariado Bilingüe, `TRIE1DR`, jornada D |
| Convenio | Caja Los Andes, `CODBEN` 1552, 25 % |
| Apoderado en `MT_CLIENT` | 9849453 |
| Consejero | felipe.contreras@uniacc.cl |
| Operación de la prueba buena | **981352** |

El certificado se sube en forma de pago. Eso abre un caso `CONVENIO_CERTIFICADO` y avisa al consejero (copia mol) y al alumno, en correos distintos. Si lo elimina, el caso pasa a `CERRADO` y el consejero recibe otro aviso. Hasta que el consejero aprueba, no puede seguir al pago.

En 981352 el arancel bruto fue 3.590.000, el convenio 897.500 (25 %) y el arancel a pagar 2.692.500 en 12 cuotas de 224.375. La matrícula fue 250.000, sin descuento, en 11 cuotas de 20.833 y una de 20.837. Boleta, cuotas, pagos y depósitos quedaron con apoderado 9849453, sede STGO y fecha del día. La ficha pasó a 2027-1.

En 2026 de producción (operación 919303) el mismo convenio era 825.000 sobre un arancel de 3.300.000, y además tenía la beca 2025 de 50.000 sobre la matrícula. Esa beca no vino en el plan 2027.

## Caso con beca interna

Probado con Benjamín Raúl Eduardo Gutiérrez Novoa. Es el caso 6 de `docs/becas-beneficios/base-prueba-rematricula.md`: dos becas internas, sin convenio.

| | |
|---|---|
| RUT | 21248022-3 |
| Código académico | 20241PSIC1VR037 |
| Carrera | `PSIC1VR`, jornada V |
| Beneficios | Apoyo UNIACC 8 % y Beca complementaria 10 % |
| Apoderado | 15471994 |
| Operación | **981350** |

No pasa por certificado. Las dos becas van en la lista de beneficios del plan y el procedimiento las graba en `MT_POSBEN` más su pago y su cruce. El plan de esa prueba: matrícula 250.000, arancel 4.140.000, Apoyo −298.080, Complementaria −414.000, a pagar 3.427.920, 12 cuotas con primer vencimiento el 15 de marzo de 2027.

981350 se grabó antes de alinear el apoderado en cuotas, pagos y depósitos. Esas filas no se reescribieron. Una prueba nueva de beca interna usa el procedimiento actual y deja el apoderado de `MT_CLIENT` en toda la cuenta.

## Caso sin beca ni convenio

No se volvió a firmar después del procedimiento actual. La lógica ya está: si `vigentes` del convenio viene vacío, `evaluarGateMatriculaConvenios` deja seguir el pago, y el procedimiento recibe la tabla de beneficios vacía.

En la cartera de prueba, el caso representativo es Valentina Ignacia Durán Sanhueza, RUT 21310817-4, código `20201TRIE1DR056` (caso 5 del mismo catálogo). Su fila TuFirma 981349 no es una matrícula 2027 terminada; no hay que borrarla para probar a otra persona.

Lo esperado en U+ Test, cuando se firme: boleta 41 por el bruto, pagaré tipo 5 por el mismo monto, cuotas tipo 14, sin filas de `MT_POSBEN` nuevas, apoderado de `MT_CLIENT`, y el correo de matrícula al terminar.

## Cómo leer una prueba

En U+ Test, con el RUT sin DV:

```sql
SELECT CODCLI, ANO_MAT, PERIODO_MAT, PERIODOS, FEC_MAT, JORNADA
FROM dbo.MT_ALUMNO WHERE RUT = 21260860;

SELECT * FROM dbo.MT_DOCITEM WHERE CODCLI = 21260860 AND ANO = 2027;
SELECT * FROM dbo.MT_CTADOC  WHERE CODCLI = 21260860 AND ANO = 2027;
SELECT * FROM dbo.MT_CTAPAG  WHERE CODCLI = 21260860 AND ANO = 2027;
SELECT * FROM dbo.MT_CTADEP  WHERE CODCLI = 21260860 AND ANO = 2027;
SELECT * FROM dbo.MT_POSBEN  WHERE CODCLI = 21260860 AND ANO = 2027;
```

`CTAPAG` es el tipo de pago (5 pagaré, 374 convenio). En `MT_CTADOC`, 41 es la boleta y 14 son las cuotas. El apoderado tiene que ser el de la boleta en las tres tablas de cuenta. Comparar con el mismo RUT en producción, año 2026, muestra el plan anterior; los montos de arancel cambian de un año a otro.
