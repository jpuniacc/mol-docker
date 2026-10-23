# Beca Convenio Especial 2047

Fecha: 2026-10-23
Proyecto: `mol-docker`
Estado: diseño aprobado, pendiente de revisión del documento

## Problema

52 alumnos de la cartera 2027-01 tienen en la beca 1 el código 2026, «Descuento especial convenio no vigente», al 20 %. El catálogo lo deja en revisión, así que MOL no lo aplica. La beca 2 está vacía.

La beca que corresponde es la 2047, «Beca Convenio Especial»: 20 % sobre el arancel y sin baja por notas. U+ ya tiene el código vigente. MOL todavía no.

## Decisión

Primero se reemplaza el 2026 por el 2047 en la cartera de mol-dev. MOL muestra esa beca aunque U+ aún no la tenga asignada. Al firmar, el grabado que ya existe escribe el código, el 20 % y el monto en `MT_POSBEN`.

La excepción es solo el 2047. Las demás becas de la cartera siguen exigiendo una asignación previa en U+.

## Cartera

En `mnp_cartera_beneficios`, periodo `2027-01`, y solo si `cod_beneficio_1` sigue siendo `2026`:

- `beca_1`: Beca Convenio Especial
- `pct_1`: 20
- `cod_beneficio_1`: 2047

La beca 2, el consolidado y el resto de las columnas no cambian. Si la beca 1 ya no es 2026, esa fila no se toca.

Alumnos:

| CODCLI | RUT |
| --- | --- |
| 20231PSIC1SR008 | 15993364-4 |
| 20231CAUC1DR038 | 20967485-8 |
| 20211DIAM1SR021 | 19099926-2 |
| 20231TEAT1DR004 | 20912752-0 |
| 20231PSIC1SR004 | 15892683-0 |
| 20211TRIE1DR069 | 21094810-4 |
| 20231DACO1DR014 | 21531473-1 |
| 20231CDDV1DR004 | 20777354-9 |
| 20231PSIC1DR006 | 21384953-0 |
| 20262ARQU1SR001 | 21239030-5 |
| 20221ARQU1SR050 | 17674830-3 |
| 20221PSIC1DR077 | 20497203-6 |
| 20242ARQU1SR021 | 22227613-6 |
| 20241CAUC1DR040 | 21060789-7 |
| 20221PUBL1DR022 | 21515201-4 |
| 20221DIAM1SR042 | 19434020-6 |
| 20221DGMU1DR026 | 21196820-6 |
| 20231PSIC1SR006 | 15560348-8 |
| 20221CDDV1DR033 | 22453337-3 |
| 20221DGMU1DR040 | 21061801-5 |
| 20221CDAD1DR051 | 21284880-8 |
| 20241CAUT1DR024 | 21437526-5 |
| 20231DERE1VR008 | 20063604-K |
| 20221PSIC1VR061 | 20219500-8 |
| 20241TEAT1VR017 | 20036664-6 |
| 20231PSIC1VR018 | 19649349-2 |
| 20211MUCO1DR043 | 20666030-9 |
| 20231PSIC1SR010 | 19346477-7 |
| 20211ARVI1DR012 | 20818736-8 |
| 20221TRIE1DR086 | 21576047-2 |
| 20222PSIC1VR019 | 20000980-0 |
| 20261PSIC1SR251 | 19962288-9 |
| 20211CDAD1DR021 | 20819128-4 |
| 20221CDAD1DR050 | 21359544-K |
| 20231CDAD1DR001 | 21396189-6 |
| 20231DACO1DR003 | 21210082-K |
| 20211MUCO1DR072 | 19955257-0 |
| 20211CDDV1DR037 | 21157559-K |
| 20231PSIC1DR021 | 21000943-4 |
| 20221TRIE1DR060 | 20694012-3 |
| 20222PSIC1SR001 | 18074634-K |
| 20221TRIE1DR025 | 20053330-5 |
| 20221ARQU1DR021 | 21309693-1 |
| 20221PSIC1DR056 | 21081135-4 |
| 20231PSIC1DR002 | 19003494-1 |
| 20221CDAD1DR035 | 20994021-3 |
| 20221MUCO1DR090 | 20538321-2 |
| 20221TRIE1DR064 | 20923348-7 |
| 20221MUCO1DR065 | 21360432-5 |
| 20221CDAD1DR078 | 21226875-5 |
| 20231DGMU1DR002 | 19673558-5 |
| 20221TRIE1DR080 | 20121382-7 |

## Catálogo

Una fila en `mnp_mv_beneficio_periodo`, periodo `2027-01`. Si el 2047 ya está en ese periodo, no se inserta otra:

- código `2047`
- beneficio `Beca Convenio Especial`
- flujo `MOL_DVU`
- renovable `SIN REQUISITO DE NOTAS`
- `aplica` verdadero
- sin convenio y sin certificado

Ese renovable no contiene «promedio» ni «5.5», así que el ajuste por notas no corre y el 20 % se mantiene.

## Lectura en MOL

`filtrarBeneficiosAsignados` deja pasar el 2047 aunque no esté en los códigos asignados del último periodo de U+. Cualquier otro código sigue oculto si U+ no lo tiene asignado.

Con el catálogo aplicable, MOL marca la beca sola. El 20 % se descuenta del saldo de arancel que queda después de una beca ministerial. La matrícula no entra. Si en la misma cartera también está el Apoyo 1756, siguen aplicando las dos, con la regla de prelación que ya existe.

## Grabado

No se modifica `sp_mol_grabar_plan_pagos` ni se escribe U+ antes de firmar.

Al firmar, las líneas que ya arma la forma de pago incluyen el código 2047, el porcentaje 20 y el monto calculado. El grabado actual los envía a `MT_POSBEN` con `APLICABLE` 1 y estado asignado.

## Límites

- Solo estos 52 alumnos y solo mol-dev.
- No se copia a uniacc-mol ni a la cartera de producción en este cambio.
- El 2026 permanece en revisión y no vuelve a aplicarse.
- No se inventa una fila asignada en el extracto de U+.

## Pruebas

- El 2047 de la cartera se muestra aunque el conjunto de códigos asignados esté vacío.
- Otro código de la cartera, con ese mismo conjunto vacío, no se muestra.
- Con renovable `SIN REQUISITO DE NOTAS`, un promedio bajo deja el porcentaje en 20.
- Una beca interna que sí exige promedio 5,5 sigue bajando como hoy.
