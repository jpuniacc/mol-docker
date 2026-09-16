# Base para prueba — cartera Rematrícula 2027-1

**Agente:** `base-prueba-rematricula`  
**Fecha de análisis:** 2026-09-11  
**Fuente única:** `/opt/mol-docker/docs/becas-beneficios/BASE PARA PRUEBA.xlsx` (1 480 001 bytes)  
**Método:** `openpyxl` 3.1.5, `data_only=True`, recorrido de **todas** las hojas y **todas** las filas (sin sample). Conteos reales.  
**Agregados:** `docs/becas-beneficios/base-prueba-rematricula-agregados.json`

---

## 1. Inventario

### Hojas

| # | Nombre de hoja | Filas físicas (openpyxl) | Columnas físicas | Header | Filas de datos no vacías | Filas vacías |
|---|----------------|--------------------------|------------------|--------|--------------------------|--------------|
| 1 | `CARTERA 2027_1 (3)` | 6 435 | 43 | 1 | **4 687** | **1 747** (trailing, sin celdas) |

El archivo tiene **una sola hoja**. El nombre sugiere cartera del período **2027-1**; el número `(3)` parece versión de archivo, no un universo distinto.

Cálculo físico: 1 header + 4 687 datos + 1 747 vacías = 6 435.

### Columnas exactas (fila 1)

Hay **42 encabezados** + **1 columna extra vacía** (col 43, sin header, 100 % nula). El header crudo de `COHORTE` trae espacio final (`COHORTE `). Hay **dos columnas con el mismo nombre `%`** (porcentaje de BECA 1 y de BECA 2). En el JSON la segunda se nombra `%__2`.

| # | Encabezado (strip) | No nulos / 4 687 | % nulos | Lectura |
|---|--------------------|------------------|---------|---------|
| 1 | COHORTE | 4 687 | 0 % | Año de cohorte / ingreso (entero 2018–2026). No es período `2027-1`. |
| 2 | CODCLI | 4 687 | 0 % | Código 15 caracteres: `YYYY` + período (1\|2) + `CODCARPR` + correlativo. **No es el CODCLI U+ (RUT sin DV).** Ver §6. |
| 3 | RUT | 4 687 | 0 % | Cuerpo numérico del RUT (sin DV, sin puntos). |
| 4 | DIG | 4 687 | 0 % | Dígito verificador (`0–9` o `K`). |
| 5 | NOMBRE | 4 687 | 0 % | Nombre de pila. |
| 6 | APELLIDO PAT | 4 687 | 0 % | |
| 7 | APELLIDO MAT | 4 673 | 0,3 % | 14 nulos. |
| 8 | CODCARPR | 4 687 | 0 % | Código carrera ERP (`PSIC1SR`, `DACO1DR`, …). 44 valores. Candidato a `cod_carrera` MOL. |
| 9 | CARRERA | 4 687 | 0 % | Nombre de carrera. 39 valores (menos que CODCARPR: misma carrera, distintas jornadas/planes). |
| 10 | CODPESTUD | 4 686 | 0,02 % | Código plan de estudio. 147 distintos. 1 nulo. |
| 11 | NIVEL | 4 687 | 0 % | Entero 1–8. **Por confirmar:** semestre / año de malla. |
| 12 | JORNADA | 4 687 | 0 % | Código ERP: `D` / `S` / `AD` / `V`. Alineable con `jornada_carrera` MOL. |
| 13 | JORNADA 2 | 4 687 | 0 % | Glosa: Diurno, Semipresencial, A Distancia, Vespertino, **Advance**. |
| 14 | FACULTAD | 4 686 | 0,02 % | 6 facultades + 1 nulo. |
| 15 | DOCUMENTO PAGO | 4 687 | 0 % | Medio de pago de la última matrícula (22 valores). |
| 16 | CONSOLIDADO CAE-BECA MINISTERIAL-SUBDERE | 1 579 | 66,3 % | Flag combinado: `CAE`, `BECA MINISTERIAL`, `CAE/BECA MINISTERIAL`, `SUBDERE`. Nulo = ninguno de esos. |
| 17 | DEUDA MOROSA 03_09 | 4 687 | 0 % | Monto pesos (incluye 0). Corte al 03/09 (año **por confirmar**, el archivo se actualizó en 2026). |
| 18 | TRAMO DEUDA | 4 687 | 0 % | 6 tramos. |
| 19 | FONOACT | 4 686 | 0,02 % | |
| 20 | CELULARACT | 2 248 | 52,0 % | |
| 21 | MAIL | 4 685 | 0,04 % | Mail personal. |
| 22 | MAIL INST | 4 686 | 0,02 % | Mail institucional. |
| 23 | RUT APOD | 4 686 | 0,02 % | Cuerpo RUT apoderado. |
| 24 | DV APOD | 4 686 | 0,02 % | |
| 25 | NOMBRE APOD | 4 686 | 0,02 % | |
| 26 | AP PATERNO APOD | 4 686 | 0,02 % | |
| 27 | AP MATERNO APOD | 4 673 | 0,3 % | |
| 28 | TELEFONO APOD | 4 014 | 14,4 % | A veces trae sufijo `-0`. **Por confirmar** formato. |
| 29 | MAIL APOD | 4 681 | 0,13 % | |
| 30 | FECHA ACTUALIZACION | 4 686 | 0,02 % | Mayoría `2026-08-18`. 11 filas con serial Excel crudo; 1 nulo. |
| 31 | SIES | 1 101 | 76,5 % | Solo valor `OK`. **Por confirmar** significado (¿reporte SIES?). |
| 32 | ESTADO NO MOVER AL 03/09 | 4 687 | 0 % | Clasificación de cartera: Rematriculable / Eliminado / Retiro Definitivo / Retiro Temporal. |
| 33 | PROMEDIO | 4 687 | 0 % | 0,0–6,9. 167 ceros. |
| 34 | TRAMO PROMEDIO | 4 687 | 0 % | 4 tramos. |
| 35 | BECA 1 | 4 687 | 0 % | Nombre de beneficio interno/convenio, o `Sin beca`. **No** nombra la beca ministerial. |
| 36 | % | 4 052 | 13,5 % | % de BECA 1. Casi todo texto locale `40,00000`. No hay montos $. |
| 37 | BECA 2 | 58 | 98,8 % | Segunda beca (muy raro). |
| 38 | % (2ª) | 58 | 98,8 % | % de BECA 2. |
| 39 | OBS COBRO ARANCEL | 76 | 98,4 % | 3 glosas de cobro semestral/anual vs malla. |
| 40 | 03_09 | 4 687 | 0 % | `VIGENTE` / `SUSPENDIDO` / `ELIMINADO`. **Por confirmar** si es `ultima_situacion` U+. |
| 41 | DESC | 4 687 | 0 % | Glosa asociada a `03_09` / trámite. 24 valores. |
| 42 | EJECUTIVO MATRICULA | 4 687 | 0 % | 3 correos, ~1 562 cada uno (partición operativa). |
| 43 | *(vacía)* | 0 | 100 % | Ignorar. |

**Campos que el Excel no trae** (relevantes para MOL): sede, `categoria_alumno`, `cod_beneficio` numérico, monto CAE, monto beca en pesos, período de rematrícula explícito `2027-1`.

---

## 2. Universo de alumnos

| Métrica | N |
|---------|---|
| Filas de datos | **4 687** |
| RUT únicos (cuerpo+DV, sin puntos/guion, K mayúscula) | **4 686** |
| CODCLI únicos (código Excel 15 chars) | **4 687** |
| CODCLI duplicados | **0** |
| RUT con más de una fila | **1** |
| RUT con DV chileno inválido | **0** (los 4 687 pasan módulo 11) |

### Duplicado real (mismo RUT, dos carreras)

| RUT norm | CODCLI Excel | Carrera | CODCARPR | Estado |
|----------|--------------|---------|----------|--------|
| `18485662K` | `20261ADPU3AE010` | ADMINISTRACION PUBLICA ADVANCE TITULO NO AFIN | ADPU3AE | Rematriculable |
| `18485662K` | `20261TRSO3AE014` | TRABAJO SOCIAL ADVANCE TITULO NO AFIN | TRSO3AE | Rematriculable |

Nombre: **FERNANDO JAVIER VILLA CASTRO**. Ambas filas Advance, cohorte 2026, nivel 2, Apoyo UNIACC 40 %, deuda $862 125, `DESC` = DESBLOQUEO DOC. ACADÉMICO PENDIENTE.

**Implicación MOL:** la llave operativa no puede ser solo RUT. Hay que cruzar **RUT + `CODCARPR`** (equivalente a alumno+carrera). El CODCLI del Excel **no** es interchangeable con `v_mnp_mv_plan_pagos.codcli` (ver §6).

### ¿Quién “se debe rematricular”?

El archivo es una **cartera completa**, no un listado ya filtrado.

| ESTADO NO MOVER AL 03/09 | Filas | % |
|--------------------------|------:|--:|
| Rematriculable | **4 162** | 88,80 % |
| Retiro Definitivo | 229 | 4,89 % |
| Eliminado | 177 | 3,78 % |
| Retiro Temporal | 119 | 2,54 % |

De los 4 162 Rematriculable, **4 118** tienen `03_09 = VIGENTE` y **44** tienen `03_09 = SUSPENDIDO` (30 contrato/mandato no firmado, 8 cambio de modalidad, 4 cambio de carrera, 1 cambio de jornada, 1 sanción disciplinaria).

**Por confirmar con Rematrícula:** universo oficial = ¿toda la hoja, solo `Rematriculable`, o solo `Rematriculable ∩ VIGENTE`?

---

## 3. Distribuciones

### 3.1 Carrera (nombre) — 39 valores

Top:

| Carrera | Filas |
|---------|------:|
| PSICOLOGÍA | 1 203 |
| DANZA Y COREOGRAFÍA | 346 |
| TRADUCCIÓN E INTERPRETARIADO BILINGÜE (INGLÉS - ESPAÑOL) | 267 |
| COMUNICACIÓN AUDIOVISUAL ESPECIALIDAD CINE | 263 |
| MÚSICA Y COMPOSICIÓN | 253 |
| TEATRO Y COMUNICACIÓN ESCÉNICA | 242 |
| COMUNICACIÓN DIGITAL ESPECIALIDAD ANIMACIÓN DIGITAL | 194 |
| ARQUITECTURA | 182 |
| DERECHO | 176 |
| PERIODISMO | 163 |

Psicología se parte en jornadas: `PSIC1SR` 752, `PSIC1DR` 324, `PSIC1VR` 127.

**44 `CODCARPR`.** Completo en el JSON (`codcarpr`).

### 3.2 Jornada

| JORNADA (código) | JORNADA 2 | Filas |
|------------------|-----------|------:|
| D | Diurno | 2 662 |
| S | Semipresencial | 1 049 |
| AD | A Distancia | 372 |
| V | Vespertino | 349 |
| AD | **Advance** | 255 |

`AD` **no es unívoco**: 372 distancia + 255 Advance. MOL usa `jornada_carrera` AD/D/V/S; el arancel Advance puede requerir otro discriminante (`CODCARPR` *AE, `categoria_alumno`, etc.). **Riesgo de cruce.**

Rematriculable: Diurno 2 475, Semipresencial 913, Vespertino 297, A Distancia 277, Advance 200.

### 3.3 Sede

**No existe columna sede.** No se infiere. **Por confirmar** si UNIACC opera una sola sede para esta cartera o si sede va en U+.

### 3.4 Categoría alumno

**No existe** `categoria_alumno` (nuevo/antiguo). MOL la usa en arancel. Se podría aproximar por COHORTE/NIVEL, pero **no está en el Excel** → no inventar.

### 3.5 Periodo / cohorte de ingreso

`COHORTE` es año (no `YYYY-P`):

| Cohorte | Cartera | Rematriculable |
|---------|--------:|---------------:|
| 2026 | 1 509 | 1 140 |
| 2025 | 999 | 934 |
| 2024 | 965 | 927 |
| 2023 | 940 | 908 |
| 2022 | 181 | 168 |
| 2021 | 54 | 52 |
| 2020 | 32 | 26 |
| 2019 | 5 | 5 |
| 2018 | 2 | 2 |

El CODCLI Excel empieza por `YYYY` + dígito de período: **4 604** con período `1`, **83** con período `2` (ej. `20252CAUT1DR002`).

En **177 filas** el año del CODCLI ≠ COHORTE (cambios de carrera/reingreso **por confirmar**). No usar CODCLI como proxy ciego de cohorte.

### 3.6 CAE / ministerial / SUBDERE (`CONSOLIDADO`)

| Valor | Cartera | Rematriculable |
|-------|--------:|---------------:|
| *(nulo)* | 3 108 | 2 660 |
| CAE | 1 063 | 1 012 |
| BECA MINISTERIAL | 229 | 220 |
| CAE/BECA MINISTERIAL | 225 | 212 |
| SUBDERE | 62 | 58 |

Unión: **1 288** filas con CAE (solo o combinado); **454** con beca ministerial (sola o combinada); **62** SUBDERE.

**SUBDERE no entra a MOL.** Renovación NEDA, pago en una cuota, Backoffice. En el portal usan el mismo bloqueo que fuera de cartera. El Excel **no desglosa** qué beca MINEDUC (JGM, Excelencia, Valech, etc.).

### 3.7 Beneficios internos / convenios

Ver §4. `BECA 1` siempre informado (incluye `Sin beca` = 645). `BECA 2` solo 58 filas.

### 3.8 Convenios (en BECA 1, no en CONSOLIDADO)

| Nombre | Filas | Código catálogo 2027-01 |
|--------|------:|-------------------------|
| Descuento especial convenio no vigente | 51 | 2026 (EN REVISIÓN, no aplica) |
| CAJA LOS ANDES | 34 | 1552 (vigente + certificado) |
| Convenio Carabineros de Chile | 9 | 749 |
| ENAC Centro de Formacion Tecnica | 2 | 1773 (NO VIGENTE) |
| CAJA LA ARAUCANA | 2 | 1565 |
| SINDICATO BANCOESTADO | 1 | 89 |
| ASOCIACION DE PILOTOS DE CHILE | 1 | 1766 (NO VIGENTE) |

### 3.9 Estado / situación

Cruce `ESTADO NO MOVER AL 03/09` × `03_09`:

| | VIGENTE | SUSPENDIDO | ELIMINADO |
|--|--------:|-----------:|----------:|
| Rematriculable | **4 118** | 44 | 0 |
| Eliminado | **4** | 0 | 173 |
| Retiro Definitivo | 0 | 229 | 0 |
| Retiro Temporal | 0 | 119 | 0 |

Las 4 `Eliminado ∩ VIGENTE` tienen `DESC = APELACIÓN A LA ELIMINACIÓN` (más 45 Rematriculable también en apelación).

`DESC` top: CONTRATO/MANDATO FIRMADO 3 864; RETIRO DEFINITIVO 229; ELIMINADO ACADÉMICO 172; RETIRO TEMPORAL 119; APELACIÓN 49; HOMOLOGADO 48; CONVALIDADO 40; CONTRATO NO FIRMADO 34.

### 3.10 Facultad, nivel, documento de pago, deuda, promedio

**Facultad:** Psicología 1 203, Comunicaciones 1 155, Artes 1 040, Arquitectura y Diseño 485, Ciencias Jurídicas y Sociales 449, Negocios y Tecnología 354, nulo 1.

**Nivel:** 1=1 122, 2=903, 3=271, 4=776, 5=215, 6=670, 7=179, 8=551. Pares (2/4/6/8) dominan sobre impares → **por confirmar** si nivel = semestre de carrera anualizada.

**Documento pago (top):** PAGARÉ 3 118, PAGARE CAE 744, CHEQUE A FECHA 245, TARJETA DE CREDITO MULTIPLE TOTAL 152, DEPOSITO BANCARIO PAGO TOTAL 115, FINANCIAMIENTO BECA SUBDERE 62. Los 62 SUBDERE del consolidado coinciden 1:1 con ese documento.

**Deuda morosa:** 2 996 sin deuda (tramo); 1 691 con monto > 0; suma **$1 315 865 403**; máximo $5 686 784. Rematriculable con deuda: **1 318** (86 con tramo >$2 000 000).

**Promedio:** mediana 5,6; media 5,11; min 0; max 6,9. Rematriculable con promedio **&lt; 5,5: 1 489**; **&lt; 4,0: 300**. Crítico para renovación Art. 13 / catálogo “promedio ≥ 5,5”.

**SIES:** 1 101 `OK` (1 090 de cohorte 2026) — parece marca de nuevos más que de toda la cartera. **Por confirmar.**

---

## 4. Beneficios / becas

### 4.1 Qué hay y qué no hay

- **No hay montos** de beca ni de CAE. Solo **porcentajes** en `%` / `%` de BECA 2.
- **No hay `cod_beneficio`.** El cruce a MOL/catálogo es por **nombre** (frágil: 1 typo de doble espacio).
- La beca **ministerial** vive en `CONSOLIDADO`, no en `BECA 1`.
- CAE tampoco es una fila de BECA 1.

### 4.2 Frecuencia de nombres (BECA 1 + BECA 2, excluye `Sin beca`)

Mapeo contra `cod_beneficios_flujos_2027-01.csv` (no es parte del Excel; se usa solo para clasificar).

| Nombre Excel | Filas | Cód. | Tipo inferido | ¿Se mantiene 2027-01? |
|--------------|------:|-----:|---------------|------------------------|
| Beneficio Apoyo UNIACC Renovable | 2 135 | 1756 | Interna DVU (acumulable) | Sí si promedio ≥ 5,5 |
| Beca Talento Presencial | 981 | 1744 | Interna DVU | Sí si promedio ≥ 5,5 |
| Beca Talento Virtual | 438 | 1795 | Interna DVU | Sí si promedio ≥ 5,5 |
| Beca Talento Virtual 2 | 159 | 1809 | Interna DVU | Sí si promedio ≥ 5,5 |
| Beca Apoyo Regional | 125 | 1747 | Interna DVU | Sí si promedio ≥ 5,5 |
| Descuento especial convenio no vigente | 51 | 2026 | En revisión | **No** |
| Beca Complementaria Fondo UNIACC | 48 | 1640 | Interna DVU | Sí si promedio ≥ 5,5 |
| Beca Merito PSU PTU | 36 | 1746 | Interna DVU | Sí si promedio ≥ 5,5 |
| CAJA LOS ANDES | 34 | 1552 | Convenio | Sí + certificado |
| Beca EgresadosTitulados UNIACC Hijos y Conyuge | 20 | 1750 | Interna DVU | Sí si promedio ≥ 5,5 |
| Beca Merito Academico | 18 | 1745 | Interna DVU | Sí si promedio ≥ 5,5 |
| Beca Complementaria Becas MINEDUC | 12 | 1748 | Interna DVU | Sí si promedio ≥ 5,5 |
| Convenio Carabineros de Chile | 9 | 749 | Convenio | Sí + certificado |
| Beca Funcionarios Sindicalizados Hijos y Conyuges | 8 | 1752 | Interna (sin notas) | Sí |
| BECA NEM | 6 | 1519 | Interna DVU | Sí si promedio ≥ 5,5 |
| DACC | 6 | 1641 | Interna DVU | Sí si promedio ≥ 5,5 |
| ENAC Centro de Formacion Tecnica | 2 | 1773 | Convenio NO VIGENTE | **No** |
| CAJA LA ARAUCANA | 2 | 1565 | Convenio | Sí + certificado |
| Beneficio␠␠Apoyo UNIACC Renovable (doble espacio) | 1 | 1756 | Typo → 1756 | — |
| BECA RETENCION PRIMER AÑO | 1 | 2034 | **No renovable** | **No** |
| SINDICATO BANCOESTADO | 1 | 89 | Convenio | Sí + certificado |
| BECA ACTRIZ DESTACADA | 1 | 2033 | Interna DVU | Sí si promedio ≥ 5,5 |
| Beca PSU | 1 | 760 | Interna DVU | Sí si promedio ≥ 5,5 |
| Beca Migrante Arancel Renovante | 1 | 2002 | Interna DVU (sin notas UNIACC) | Sí |
| ASOCIACION DE PILOTOS DE CHILE | 1 | 1766 | Convenio NO VIGENTE | **No** |
| Beca Docente UNIACC | 1 | 1753 | Interna (sin notas) | Sí |
| **Beca Colaboradores Hijos y Conyuges** | 1 | — | **Por confirmar** (no está en catálogo) | — |
| **Beneficio Complementario Renovable Nvos** | 1 | — | **Por confirmar** (solo en BECA 2) | — |

`Sin beca` en BECA 1: **645** cartera / **598** rematriculable.

### 4.3 CAE vs ministerial vs interna vs convenio (lectura operativa)

1. **CAE** (1 288): flag en CONSOLIDADO. No resta en prelación MOL actual (sin monto financiado). 533 de esos CAE **no** tienen documento `PAGARE CAE` (usan PAGARÉ u otro) → el documento de pago **no** es proxy perfecto de CAE.
2. **Beca ministerial** (454): solo flag. Sin código MINEDUC, sin %. MOL las trata como `ESTATAL` en cascada; **este Excel no permite saber cuál**.
3. **SUBDERE** (62): consolidado **y** documento `FINANCIAMIENTO BECA SUBDERE` (1:1); BECA 1 suele ser `Sin beca`. **Fuera de MOL:** renovación NEDA, pago en una cuota, Backoffice. Mismo bloqueo que `fuera_cartera_oficial` (mensaje genérico). Siguen en la cartera Excel; se marcan excluidos, no se borran.
4. **Internas DVU:** BECA 1/2. Dominan Apoyo UNIACC (1756) y Talentos (1744/1795/1809).
5. **Convenios:** minoritarios; varios ya caídos en catálogo 2027-01 (ENAC, Pilotos, “descuento especial no vigente”).

### 4.4 Porcentajes (no montos)

- `%` BECA 1 informado en 4 052 filas; nulo en 635 (casi todos `Sin beca`; **1 excepción:** CODCLI `20221TEAT1DR087` = `Sin beca` con 12 %).
- Valores típicos (texto): 40, 30, 20, 15, 10, 50, 25.
- `%` = 100: 23 Talento Presencial + 6 Funcionarios + 1 Colaboradores. Talento al 100 % es **anómalo** respecto del resto de la distribución (hay que validar en U+).
- Dos becas (58 filas): combinaciones Apoyo+Complementaria Fondo, Talento+Apoyo, Talento+Fondo. Suma de % &gt; 70 en **2** casos (75 % retiro definitivo; **80 % rematriculable** `20251MUIN1DR015` / RUT `22103156-3` — tope Art. 9).
- 1 fila tiene BECA 1 = BECA 2 = Complementaria Fondo (duplicado de beneficio).

---

## 5. Calidad de datos

| Hallazgo | N | Severidad |
|----------|--:|-----------|
| Filas vacías al final de la hoja | 1 747 | Baja (ruido Excel) |
| RUT alumno DV inválido | 0 | — |
| RUT apoderado faltante | 1 | Baja |
| RUT único con 2 carreras | 1 | Media (llave) |
| Header `COHORTE ` con espacio; dos columnas `%` homónimas | — | Media (parseo) |
| CODCLI Excel ≠ CODCLI U+ (formato) | 4 687 | **Alta** para cruce MOL |
| Año CODCLI ≠ COHORTE | 177 | Media |
| `ESTADO=Rematriculable` pero `03_09=SUSPENDIDO` | 44 | **Alta** (¿se rematriculan?) |
| `ESTADO=Eliminado` pero `03_09=VIGENTE` | 4 | Alta (apelación) |
| FECHA ACTUALIZACION como serial float | 11 | Baja |
| FECHA nula + FACULTAD nula + CODPESTUD nulo (misma fila) | 1 | Baja (`20261CDDV1DR011`) |
| MAIL personal vacío | 2 | Baja |
| CELULARACT vacío | 2 439 | Media contacto |
| TELEFONO APOD vacío | 673 | Media |
| Typo `Beneficio  Apoyo UNIACC Renovable` | 1 | Media match catálogo |
| `Sin beca` con % = 12 | 1 | Media |
| Nombres no catalogados 2027-01 | 2 | Alta renovación |
| Convenios NO VIGENTE / EN REVISIÓN aún en BECA 1 | 51+2+1 | Alta (se heredarían mal) |
| Promedio 0 | 167 | Media (nuevos / sin notas) |
| JORNADA `AD` = Distancia **o** Advance | 627 | Alta arancel |
| SIES nulo 76,5 % | 3 586 | **Por confirmar** |
| No hay sede / categoría / montos / cód. beneficio | — | Estructural |

Los 4 687 RUT alumno y 4 686 RUT apoderado (no nulos) **pasan** dígito verificador chileno.

---

## 6. Campos clave para cruzar con MOL

Vista/tabla: `v_mnp_mv_plan_pagos` / `mnp_mv_plan_pagos_consolidado`.

| Excel | MOL | Calidad del cruce |
|-------|-----|-------------------|
| `RUT` + `DIG` → norm `^[0-9]+[0-9K]$` | `rut` | **Mejor llave de persona.** Normalizar igual (sin puntos/guion, K mayúscula). 4 686 personas. |
| `CODCARPR` | `cod_carrera` | **Mejor llave de carrera.** 44 códigos. Una persona puede tener 2. |
| `RUT` + `CODCARPR` | `codcli` + `cod_carrera` (doc MOL: una fila por alumno/carrera) | **Llave de caso recomendada.** |
| `CODCLI` (15 chars) | `codcli` | **No cruzar a ciegas.** En U+ `MT_ALUMNO.CODCLI` / traces MOL es RUT sin DV (ej. `22481393`). El Excel es `20241MUCO1DR075`. **Por confirmar** si algún campo MOL guarda este código UMAS. |
| `CARRERA` | `carrera` / `nombre_carrera` | Apoyo visual; no llave (39 vs 44). |
| `JORNADA` | `jornada_carrera` | D/S/AD/V. Cuidado Advance vs Distancia. |
| `COHORTE` | `ano_ingreso` | Aprox. 177 desalineados con prefijo CODCLI. No hay `periodo_ingreso` (1 vs 2) salvo el dígito del CODCLI Excel. |
| `NIVEL` | — | **Por confirmar** mapeo. |
| `CONSOLIDADO` contiene `CAE` | `alumno_cae` | Proxy. 1 288 vs documento PAGARE CAE 744+11. Preferir flag consolidado o, mejor, `mnp_estado_cae_alumnos`. |
| `CONSOLIDADO` ministerial | `beneficios_detalle` tipo estatal | Excel no trae código/monto. Hay que leer ERP/MOL, no el Excel. |
| `BECA 1` / `BECA 2` + `%` | `beneficios_detalle[].descripcion` / `porc_apr` / `cod_beneficio` | Match por nombre (normalizar espacios). Sin monto. Catálogo 2027-01 para `aplicable`. |
| `ESTADO` / `03_09` / `DESC` | `estado_academico`, `ultima_situacion`, `periodo_rematricula` | Homologación **por confirmar**. No asumir igualdad de catálogo. |
| `PROMEDIO` | `prom_anio` / `prom_ultimo_periodo` | Útil para Art. 13; verificar si es acumulado o último período. |
| `DEUDA MOROSA 03_09` | (no está en la vista plan de pagos) | Dato de cobranza; puede bloquear rematrícula **por confirmar**. |
| — | `categoria_alumno` | Ausente en Excel. |
| — | sede | Ausente. |

**Regla práctica de prueba:** buscar en MOL por `rut` normalizado; si hay más de una carrera, filtrar `cod_carrera = CODCARPR`. No usar el `CODCLI` del Excel como `eq('codcli', …)` salvo que se demuestre que MOL lo persiste así.

---

## 7. RUTs representativos para pruebas (25)

Incluye el duplicado (mismo RUT, dos CODCLI). RUT con guion solo para lectura; `rut_norm` sin guion.

| # | Caso | RUT | CODCLI Excel | Nombre | CAE/Min/SUB | Beneficios |
|---|------|-----|--------------|--------|-------------|------------|
| 1 | Masivo: rematriculable + CAE + Apoyo | 15459973-8 | 20231DERE1VR061 | CAROLINA DE LAS MERCEDES ARANCIBIA GOMEZ | CAE | Apoyo UNIACC 15 % |
| 2 | CAE + beca ministerial combinados | 22113720-5 | 20251ARVI1DR005 | ROY ALEXANDER HERNANDEZ VASQUEZ | CAE/BECA MINISTERIAL | Talento Presencial 38 % |
| 3 | Ministerial sin CAE | 22239055-9 | 20251PSIC1DR085 | MELANIE ANDREA CORNEJO MUÑOZ | BECA MINISTERIAL | Mérito PSU PTU 15 % |
| 4 | SUBDERE — fuera de MOL (mismo bloqueo cartera) | 17420219-2 | 20231ADPU1AR033 | FRANCISCO JAVIER MORENO VALDÉS | SUBDERE | Sin beca |
| 5 | Sin beca ni CAE | 21310817-4 | 20201TRIE1DR056 | VALENTINA IGNACIA DURAN SANHUEZA | — | Sin beca |
| 6 | Dos internas (Apoyo + Fondo) | 21248022-3 | 20241PSIC1VR037 | BENJAMÍN RAÚL EDUARDO GUTIÉRREZ NOVOA | — | Apoyo 8 % + Complementaria Fondo 10 % |
| 7 | Talento + Apoyo en BECA 2 (acumulable) | 21748919-9 | 20241MUCO1DR075 | CRISTÓBAL IGNACIO REVECO GODOY | — | Talento Virtual 30 % + Apoyo 10 % |
| 8 | Convenio Caja Los Andes | 16962819-K | 20221DERE1VR013 | JOSÉ ANTONIO SOTO GARRIDO | — | CAJA LOS ANDES 25 % (además SUSPENDIDO / contrato no firmado) |
| 9 | Convenio EN REVISIÓN | 15993364-4 | 20231PSIC1SR008 | ASTRID JANIRA TEBACHE VARGAS | — | Descuento especial convenio no vigente 20 % |
| 10 | Funcionarios 100 % | 16257846-4 | 20251PSIC1SR144 | TAMARA JUDITH FERNÁNDEZ CORTÉS | — | Funcionarios sindicalizados 100 % |
| 11a | Mismo RUT, carrera 1 Advance | 18485662-K | 20261ADPU3AE010 | FERNANDO JAVIER VILLA CASTRO | — | Apoyo 40 % |
| 11b | Mismo RUT, carrera 2 Advance | 18485662-K | 20261TRSO3AE014 | FERNANDO JAVIER VILLA CASTRO | — | Apoyo 40 % |
| 12 | Eliminado (no rematricular) | 20824394-2 | 20261CAUC1DR009 | FABIAN IGNACIO TAPIA SANHUEZA | — | Talento Presencial 40 %; promedio 1,8 |
| 13 | Retiro definitivo | 21679065-0 | 20251TRSO1AR020 | DUMÁN ALEXANDER VELOSO DE LA FUENTE | CAE | Apoyo 20 % |
| 14 | Retiro temporal | 18874864-3 | 20261ICOM1AR026 | ÁNGEL FERNANDO BUSTOS LEAL | — | Apoyo 40 %; promedio 0 |
| 15 | Rematriculable + SUSPENDIDO + contrato no firmado | 22554788-2 | 20261TRIE1DR032 | CONSTANZA BEGOÑA AGUILERA ORTIZ | — | Apoyo 10 %; promedio 0 |
| 16 | Eliminado + VIGENTE (apelación) | 25455820-6 | 20241PSIC1SR185 | CLARICE FERREIRA MOREIRA | — | Sin beca |
| 17 | Deuda &gt; $2 000 000 | 14154332-6 | 20241ARQU1SR020 | PAMELA ALEJANDRA PIETROPAOLO BARRIENTOS | — | Apoyo 7 %; deuda $2 244 605; promedio 3,9 |
| 18 | Promedio &lt; 4 + beca interna (Art. 13) | 16458583-2 | 20261DERE1VR075 | FELIPE ANDRE CHAIGNEAU RODRIGUEZ | — | Apoyo 20 %; promedio 3,8 |
| 19 | Advance + CAE | 12151396-K | 20251ADPU3AE006 | ROSSANA DEL CARMEN MIRANDA PINCOL | CAE | Apoyo 35 % |
| 20 | Cohorte 2018 (más antigua) | 19186845-5 | 20181MUCO1DR004 | TOMÁS FELIPE ECHEVARRIA BRAVO | — | Sin beca; nivel 8; promedio 4,2 |
| 21 | Migrante (1 caso, DVU) | 25511382-8 | 20231DACO1DR096 | AMAYA LILY GUZMAN ITURRY | — | Migrante Arancel 50 %; promedio 4,9 |
| 22 | Actriz destacada + CAE/ministerial | 22502473-1 | 20261TEAT1DR043 | LAURA EMILIA CHÁVEZ ALVARADO | CAE/BECA MINISTERIAL | BECA ACTRIZ DESTACADA 50 % |
| 23 | Convenio Carabineros | 19333728-7 | 20221PSIC1SR193 | TOMÁS IGNACIO DEVCIC FUENZALIDA | — | Carabineros 25 % |
| 24 | No renovable 2027-01 | 13904539-4 | 20231ICOM1AR035 | RODRIGO MIGUEL CARSALADE SEPÚLVEDA | — | BECA RETENCION PRIMER AÑO 60 % |
| 25 | Convenio catálogo NO VIGENTE | 19634631-7 | 20251BIBL2AE026 | RICARDO JESÚS BARRA OLIVA | — | ENAC 30 % |

Borde extra (JSON): RUT `22103156-3` CODCLI `20251MUIN1DR015` — dos becas suman **80 %** (sobre tope 70 %). RUT `26679554-8` — Beca Colaboradores 100 % (nombre fuera de catálogo; está en retiro temporal).

---

## 8. Preguntas abiertas y riesgos si este Excel es “quién debe rematricularse”

1. **El archivo es cartera, no nómina de rematrícula.** 525 filas no son `Rematriculable`. Si se carga entero a MOL como universo 2027-1, se incluirán eliminados y retiros.
2. **Filtro exacto no está cerrado:** ¿`Rematriculable` (4 162) o `Rematriculable ∩ VIGENTE` (4 118)? Los 44 SUSPENDIDO (contrato no firmado, cambios de carrera/modalidad, sanción) son zona gris.
3. **Apelación a la eliminación** (49 filas, 4 de ellas `Eliminado`+`VIGENTE`): ¿entran al flujo online?
4. **CODCLI del Excel no es el `codcli` MOL/U+.** Cruzar mal deja 0 matches. Hay que usar RUT + `CODCARPR`.
5. **Un RUT / dos carreras:** el flujo MOL debe abrir **dos** planes de pago. Si se deduplica por RUT se pierde una matrícula.
6. **CAE sin monto:** el Excel no sirve para copago CAE. El flag sí sirve para marcar `alumno_cae`. Hay 533 CAE cuyo documento de pago no dice CAE.
7. **Beca ministerial opaca:** 454 alumnos con flag, 0 códigos MINEDUC. La cascada estatal de MOL no se puede reconstruir desde este archivo.
8. **SUBDERE** (62 / 58 rematriculables): **cerrado 2026-09-15.** No pasan por MOL (ni prelación, ni cuotas, ni firma). Revisión NEDA; pago en una cuota; canal Backoffice. En portal: mismo bloqueo y mensaje que `fuera_cartera_oficial`. Permanecen en `mnp_cartera_oficial` con exclusión MOL (no se sacan de la tabla). Caso: `17420219-2`. Spec: `docs/superpowers/specs/2026-09-15-subdere-fuera-mol-design.md`.
9. **Herencia ciega de BECA 1** rompería 2027-01: 51 “convenio no vigente”, ENAC, Pilotos, retención primer año, y 1 489 rematriculables con promedio &lt; 5,5 que el catálogo no renueva.
10. **Tope 70 %:** al menos 1 rematriculable con 80 % interno acumulado. MOL debe recortar; el Excel no lo hace.
11. **Deuda morosa:** 1 318 rematriculables con saldo &gt; 0 (86 &gt; $2 M). ¿El Excel asume que igual se rematriculan, o hay traba de finanzas que el archivo no aplica?
12. **Advance vs A Distancia** comparten `JORNADA=AD`. Arancel/param `@JORNADA` puede equivocarse si no se usa `CODCARPR` / glosa.
13. **No hay sede ni categoría alumno.** El SP de arancel MOL las usa. El Excel no las entrega.
14. **SIES=OK** casi solo cohorte 2026: no usar como filtro de “alumno reportable” sin definición de negocio.
15. **Fecha de corte 03/09** vs `FECHA ACTUALIZACION` 2026-08-18: hay desfase; la cartera puede estar desactualizada respecto de U+ al día de rematrícula 2027-1.
16. **Nombres de carrera Advance** con espacios dobles e inconsistencia de tildes (`TÍTULO` / `TITULO`) — no usar el texto como llave.

---

## 9. Cruce con alumnos a matricular (MOL)

**Fecha:** 2026-09-11 · **Llave:** `rut_norm` · **Detalle:** `docs/becas-beneficios/base-prueba-cruce-mol.json`

| Universo | Filas | RUT únicos |
|----------|------:|-----------:|
| Excel BASE PARA PRUEBA | 4 687 | 4 686 |
| MOL `mnp_mv_plan_pagos_consolidado` | 5 036 | 5 035 |
| En ambos | — | **4 074** |
| Excel y no en MOL | — | **612** (92 Rematriculable) |
| MOL y no en Excel | — | **961** |

Los 961 de MOL que no están en el Excel quedan marcados en `fuera_cartera_oficial`. Al entrar a MOL se les muestra: no es posible generar el proceso; deben comunicarse con su consejero o DVU.

Los **62 SUBDERE** del Excel **sí están** en `mnp_cartera_oficial`, pero deben recibir el **mismo** bloqueo (exclusión MOL / NEDA). No se borran de la tabla.

Tabla oficial: `public.mnp_cartera_oficial` (4 686 RUT). Recalcular: `SELECT public.refresh_fuera_cartera_oficial();`

---

## Metodología (reproducibilidad)

- Recorrido `read_only` de la única hoja; se descartaron solo filas con las 42 columnas de negocio vacías (1 747).
- RUT normalizado: dígitos del cuerpo + DV `[0-9K]`, sin puntos ni guion.
- DV validado con factores 2–7 cíclicos (módulo 11).
- Porcentajes: se aceptó `int` o string locale `40,00000`.
- “Por confirmar” se usó cuando el encabezado no declara el significado (NIVEL, SIES, 03_09 vs ESTADO, SUBDERE, CODCLI Excel vs U+).

*Fin del informe — agente `base-prueba-rematricula`.*
