# Beneficios desde Excel (no U+) — rematrícula

Fecha: 2026-09-16  
Proyecto: `mol-docker`  
Estado: diseño aprobado (pendiente plan de implementación)

## Problema

La tarjeta “Beneficios del alumno” y el cálculo leen `beneficios_detalle` de U+ (periodo anterior, p.ej. 2026-1). Eso muestra beneficios no renovables (ej. `1791 DESCUENTO ANTICIPACION MATRICULA NUEVO`) que **no** están en el Excel de cartera.

Caso: RUT `12946085-7`, `CODCLI` Excel `20152PSIC1SR039`, `CODCARPR=PSIC1SR` — Excel solo `BECA 1 = Beneficio Apoyo UNIACC Renovable`; U+ trae además el 1791.

Para rematrícula **manda el Excel**. Además hace falta el **`cod_beneficio`** resuelto para poder insertarlo después en U+.

## Decisión

**Enfoque 1:** tabla `mnp_cartera_beneficios` cargada desde `BASE PARA PRUEBA.xlsx`.  
UI + cálculo usan **solo** esa tabla. No se usa `beneficios_detalle` U+ para listar ni calcular en este flujo.

**Alcance v1 (opción C del brainstorm):**
- `BECA 1` / `BECA 2` + `%`
- Flag informativo desde `CONSOLIDADO CAE-BECA MINISTERIAL-SUBDERE` (CAE / ministerial / SUBDERE)
- Mapeo nombre Excel → `cod_beneficio` del catálogo 2027-01

**Llave de cruce:** `rut_norm` + `codcli_excel` (CODCLI 15 chars del Excel). No asumir que siempre es igual al `codcli` U+; cuando coinciden (caso Vanessa), el join es directo.

## Modelo de datos

### Tabla `mnp_cartera_beneficios`

| Campo | Tipo / notas |
| --- | --- |
| `periodo` | text, ej. `2027-01` |
| `rut_norm` | text |
| `codcli_excel` | text (CODCLI Excel) |
| `codcarpr` | text |
| `beca_1`, `pct_1` | texto y numeric nullable |
| `beca_2`, `pct_2` | texto y numeric nullable |
| `consolidado` | text nullable |
| `cod_beneficio_1`, `cod_beneficio_2` | text nullable — resultado del match |
| `loaded_at` | timestamptz |

**PK:** `(periodo, codcli_excel)`.

Índice por `rut_norm` para búsquedas de respaldo.

### Carga

- Script/ETL desde `docs/becas-beneficios/BASE PARA PRUEBA.xlsx` (mismo espíritu que carga de `email_ejecutivo`).
- Normalizar nombre de beca (trim, espacios dobles) y cruzar con catálogo 2027-01 (`mnp_mv_beneficio_periodo` / CSV `cod_beneficios_flujos_2027-01.csv`).
- `Sin beca` / vacío / nulo → sin fila de beneficio / `cod_beneficio_* = null`.
- Si el nombre no matchea → dejar texto Excel y `cod_beneficio_* = null` (visible como “sin mapear”).

## UI (Forma de pago / beneficios del alumno)

1. Periodo mostrado: **`2027-01`** (Excel), no el `beneficio_ano/periodo` U+.
2. Lista: ítems desde `mnp_cartera_beneficios` del alumno (`codcli_excel` preferente; RUT si hace falta).
3. Mostrar **descripción + `cod_beneficio`** (requerido para grab futuro a U+).
4. Sin código: badge “sin mapear”; no entra al cálculo ni a una futura inserción hasta resolver.
5. Flag CAE/ministerial/SUBDERE desde `consolidado` (informativo; SUBDERE sigue fuera de MOL según spec existente).

## Cálculo (“Calcular becas / descuentos”)

- Entrada: solo beneficios con `cod_beneficio` resuelto + `%` del Excel.
- No mezclar montos/estados de `beneficios_detalle` U+.
- Prelación / cascada: reutilizar reglas ya documentadas (`prelacion-becas.md`) sobre este conjunto filtrado.

## Inserción futura en U+ (fuera de v1)

v1 **no** escribe en U+. Deja cada beneficio con `cod_beneficio` listo para un grab posterior (SP/API). Sin código mapeado no se podrá insertar.

## Fuera de alcance (v1)

- Heredar o mostrar descuentos no renovables solo presentes en U+ (1791, 1790, etc.).
- Escritura/grab de beneficios a U+.
- Sustituir el sync ERP del consolidado.
- Bandeja NEDA SUBDERE.

## Criterio de éxito

Para `12946085-7` / `20152PSIC1SR039`:
- La tarjeta muestra solo Apoyo UNIACC Renovable con `cod_beneficio` **1756** (o el código que resuelva el catálogo).
- No aparece `DESCUENTO ANTICIPACION MATRICULA NUEVO`.
- Periodo de la tarjeta = Excel 2027-01.

## Dependencias

- Excel: `docs/becas-beneficios/BASE PARA PRUEBA.xlsx`
- Catálogo: `docs/becas-beneficios/cod_beneficios_flujos_2027-01.csv` / `mnp_mv_beneficio_periodo`
- Specs relacionadas: `prelacion-becas.md`, `2026-09-15-subdere-fuera-mol-design.md`
- Skill: `base-prueba-rematricula`
