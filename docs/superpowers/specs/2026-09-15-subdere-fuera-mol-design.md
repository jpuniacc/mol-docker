# SUBDERE fuera de MOL

Fecha: 2026-09-15  
Proyecto: `mol-docker`  
Estado: decisión cerrada (docs). Pendiente marcar exclusión en `mnp_cartera_oficial` y recálculo de `fuera_cartera_oficial`.

## Decisión

Alumnos **SUBDERE** no pasan por MOL. No son estatal, interna ni convenio. Renovación la revisa **NEDA**; el pago es **una cuota** (categoría distinta); canal operativo **Backoffice**.

En el portal del alumno: **opción A** — el mismo bloqueo y mensaje que `fuera_cartera_oficial` (consejero / DVU). Sin bandeja NEDA en este alcance.

Siguen en la cartera Excel y en `mnp_cartera_oficial`. Se marcan **excluidos de MOL**; no se borran de la tabla.

## Cómo se detectan (Excel 2027-1)

| Señal | Valor | N |
| --- | --- | ---: |
| `CONSOLIDADO CAE-BECA MINISTERIAL-SUBDERE` | `SUBDERE` | 62 (58 rematriculables) |
| `DOCUMENTO PAGO` | `FINANCIAMIENTO BECA SUBDERE` | 62 (1:1) |
| `BECA 1` | casi siempre `Sin beca` | — |

Caso de prueba: RUT `17420219-2`, CODCLI Excel `20231ADPU1AR033`.

## Comportamiento MOL

1. `refresh_fuera_cartera_oficial()` debe dejar `fuera_cartera_oficial = true` si el RUT **no** está en cartera **o** está marcado SUBDERE / excluido MOL.
2. Router y home reutilizan `TITULO_FUERA_CARTERA_OFICIAL` / `MSG_FUERA_CARTERA_OFICIAL`. No hay copy específico.
3. `prelacionArancel` no corre para estos alumnos: el guard corta antes.

## Fuera de alcance

Bandeja Backoffice NEDA; pago en una cuota en U+; detectar SUBDERE desde ERP si el Excel no está cargado.

## Criterio de éxito

Alumno `17420219-2` (o cualquier `CONSOLIDADO = SUBDERE`) no entra a selección / forma de pago / firma; ve el aviso genérico de fuera de cartera.
