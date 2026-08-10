# Reglas de Negocio para el Cálculo de Becas, Descuentos y Beneficios — UNIACC

> Fuente: **Decreto de Rectoría N° 3/2026** — Aprueba el *Reglamento de Becas, Descuentos y Beneficios* de la Universidad de Artes, Ciencias y Comunicación (UNIACC), Santiago, 16 de enero de 2026.
> Deroga el Decreto de Rectoría N° 40-2022.
> Vigencia: a contar de la fecha de su total tramitación.

Este documento resume **las reglas que el motor de cálculo debe considerar** para postular, otorgar, calcular, topar, acumular, renovar y extinguir becas, descuentos y beneficios. Está orientado a implementación (rematrícula online), por lo que al final se incluyen parámetros, tablas y un algoritmo sugerido de aplicación.

---

## 1. Conceptos base y clasificación

### 1.1 Categorías de estudiante (Art. 2)
El cálculo depende de la categoría del estudiante:

- **Estudiante antiguo** — cumple *indistintamente* alguna de:
  - a) Tiene matrícula vigente en el período académico inmediatamente anterior, **o**
  - b) Estuvo matriculado en cualquiera de los **últimos 2 años académicos**.
- **Estudiante nuevo** — cumple *indistintamente* alguna de:
  - a) Se matricula por primera vez, **o**
  - b) Estuvo matriculado antes pero permaneció **fuera por más de 2 años académicos** (debe reingresar vía proceso de Admisión).

**Unidad responsable (gobernanza, no afecta el monto pero sí el flujo):**
- Estudiantes **nuevos** → Dirección de Admisión.
- Estudiantes **antiguos** → Dirección de Vida Universitaria (DVU).

### 1.2 Bases sobre las que se aplica un porcentaje
Cada beneficio define explícitamente sobre qué base se calcula. **No asumir**; usar la base declarada por cada beca:
- **Arancel anual de la carrera** (lo más común).
- **Arancel del período/semestral** o **arancel neto semestral**.
- **Cuota de arancel** (mensual).
- **Matrícula** (algunos beneficios la cubren, la mayoría NO).
- **Saldo** (ej.: Complemento MINEDUC se aplica sobre el saldo después de la beca ministerial).
- **Monto fijo** (ej.: Beca Copago CAE = tope $500.000).

### 1.3 Exclusiones de cobertura — "No extensión" (Art. 10)
Las becas internas, descuentos por rebaja de arancel por convenio y descuentos por forma de pago **NO se extienden** a:
- Matrícula.
- Arancel del proceso de titulación y/o grado.
- Tutorías.
- Aranceles por menor carga académica.

> Regla de cálculo: estos conceptos quedan **fuera de la base** de descuento salvo que la beca específica los incluya expresamente (p. ej. Beca Talento no cubre matrícula; Beca Rectoría sí puede cubrir matrícula).

---

## 2. Reglas globales de acumulación y topes (críticas para el cálculo)

### 2.1 No acumulación de becas internas entre sí (Art. 9)
- Las **becas internas NO son acumulables entre sí**, salvo autorización del **Comité de Gracia**.
- **Tope global:** el porcentaje total de beca y/o descuento **no puede exceder el 70% del arancel anual de la carrera** (regla general del Art. 9).

### 2.2 Acumulación con CAE y becas externas (Art. 8)
- El **CAE (Crédito con Garantía Estatal)** **sí es acumulable** con becas externas y/o internas.
- **Orden de aplicación cuando coexisten beneficios** (secuencia obligatoria):
  1. **Beca Ministerial** (externa) primero.
  2. **Beca interna** después.
  3. **CAE** cubre finalmente la **diferencia / copago**.
- **Tope con beneficios internos + externos:** la suma **no puede superar el 100% del arancel de la carrera**.
- Los **excedentes no se reembolsan** al estudiante ni al apoderado financiero.

### 2.3 Resolución de conflictos de topes
- Cuando aplican varias reglas de tope, prevalece la **más restrictiva** según el caso:
  - Becas internas entre sí o beca/descuento total: **≤ 70%** del arancel anual (Art. 9).
  - Combinación beca interna + beneficios externos (incluido CAE): **≤ 100%** del arancel (Art. 8).
- Becas con regla propia de acumulación priman sobre la general (ej.: **Beca Apoyo UNIACC** es la única acumulable a otros beneficios; **Beca Permanencia por Maternidad** NO es acumulable ni compatible con otros descuentos internos).
- Excepciones por sobre los topes solo vía **Comité de Gracia** (Art. 7 y 15).

---

## 3. Renovación, ajuste por promedio y extinción

### 3.1 Requisitos generales de renovación (Art. 11)
- Renovación **anual**, condicionada a:
  - Matrícula vigente.
  - Cumplir requisitos académicos, administrativos y/o socioeconómicos de cada beneficio.
  - **Promedio acumulado ≥ 5,5**, salvo que el beneficio:
    - indique expresamente que este requisito **no aplica**, o
    - exija un promedio distinto (mayor o menor).

### 3.2 Ajuste del porcentaje por promedio de notas (Art. 13) — TABLA CLAVE
Si el estudiante **no alcanza el promedio de renovación** (5,5), el porcentaje de beca se **reduce** según la siguiente tabla (porcentaje de **disminución** sobre la beca):

| Promedio de notas | % de disminución de la beca |
|---|---|
| 5,4 | 15% |
| 5,3 | 15% |
| 5,2 | 20% |
| 5,1 | 25% |
| 5,0 | 30% |
| 4,9 | 35% |
| 4,8 | 40% |
| 4,7 | 45% |
| 4,6 | 50% |
| 4,5 | 55% |
| 4,4 | 60% |
| 4,3 | 65% |
| 4,2 | 70% |
| 4,1 | 75% |
| 4,0 | 80% |
| 3,9 a 1,0 | **Pérdida de la Beca** |

> Interpretación de cálculo: la disminución es un **factor de reducción aplicado al porcentaje de beca vigente**.
> Ejemplo: beca del 40% y promedio 5,0 (disminución 30%) → nuevo porcentaje = 40% × (1 − 0,30) = **28%**.
> Promedio ≥ 5,5 → no hay disminución. Promedio ≤ 3,9 → la beca se pierde.

### 3.3 Causales de extinción de becas internas / descuentos (Art. 12)
La beca/descuento se **extingue** si:
- Pérdida de la calidad de alumno de UNIACC.
- No acreditar el promedio exigido (salvo casos donde no sea exigible).
- Eliminación/expulsión por causales académicas o disciplinarias; abandono; retiro temporal (congelamiento) o definitivo de la carrera.
- No mantener los requisitos y/o condiciones de otorgamiento (cuando aplique).

### 3.4 Extinción de descuentos por convenio (Art. 14)
- Pérdida de la calidad de alumno.
- Incumplir las obligaciones que impone el convenio.
- Que el convenio ya no esté vigente.
- Eliminación/expulsión, abandono, congelamiento o retiro definitivo.

### 3.5 Excepciones y casos no previstos (Arts. 7, 15, 21, 25)
- **Comité de Gracia (Art. 15):** evalúa solicitudes extraordinarias y situaciones no previstas; sus acuerdos se formalizan por resolución. Puede autorizar acumulaciones o porcentajes adicionales fuera de lo normado.
- **Solicitudes extraordinarias (Art. 7):** rebajas/porcentajes adicionales por situaciones especiales; si la resolución no dice que es renovable, vale **solo para el período otorgado**.
- **Facultades del Rector (Art. 25):** puede otorgar/modificar/renovar por decreto, incluso casos distintos a los del reglamento.
- **Cohortes anteriores a 2026 (Art. 22):** mantienen las condiciones de renovación **pactadas** originalmente.
- **Revisión anual (Arts. 4 y 23):** porcentajes, requisitos y exigencias **pueden cambiar anualmente** por resolución → parametrizar por **año académico**.

---

## 4. Catálogo de Becas Internas para Estudiantes Nuevos (Art. 16 N°1 y Art. 17)

> Reglas comunes de renovación de este grupo: matrícula vigente + Art. 11 (promedio ≥ 5,5 salvo indicación) y extinción según Art. 12.
> Disponibilidad: las becas internas para nuevos están sujetas a **cupos** definidos anualmente (Art. 5).

| # | Beca | Porcentaje / Monto | Base | Alcance / Restricción clave |
|---|---|---|---|---|
| a | **Talento UNIACC** | Hasta **100%** (según evaluación; becas limitadas y distribuidas entre mejor evaluados) | Arancel anual | 1er año, primera vez. **NO cubre matrícula**. Nominativa, individual e intransferible. Requiere evaluación de Comisión Evaluadora. No aplica a antiguos ni reincorporados. |
| b | **Mérito Académico Enseñanza Media (NEM)** | **25%** | Arancel | Pregrado todas modalidades/jornadas, **excluye programas especiales**. Estar en el **10% superior** de notas EM (ranking). Postular hasta 3 años post-egreso. |
| c | **Mérito Académico (PSU/PDT/PAES)** | **25%** | Arancel | Puntaje **> 600** promedio Lenguaje y Matemática (o equivalente). Prueba rendida en máx. 2 años antes de postular. Pregrado. |
| d | **Apoyo Regional** | **20%** | Arancel | Pregrado **presencial**. Residencia fuera de la **Región Metropolitana** (acreditada). Debe mantener residencia fuera de RM para renovar. |
| e | **Complemento MINEDUC** | **20%** | Arancel pregrado presencial, **sobre el saldo** tras beca ministerial; excluye programas especiales de titulación | Requiere haber obtenido una **beca ministerial**. Renovación ligada a la renovación de la beca ministerial. |
| f | **Copago CAE** | **Máximo $500.000** | Sobre arancel del período | Requiere tener **CAE** vigente. Cubrir total/parcialmente la diferencia entre arancel real y monto financiado. Cumplir avance académico del CAE. |
| g | **Estudiante Extranjero** | **25%** | Arancel | Extranjeros egresados de EM en Chile **sin beneficios ministeriales** ni ayudas estatales chilenas. Promedio EM ≥ 5,5. Pregrado regular, excluye programas especiales de titulación. |
| h | **Familiares UNIACC** | 2° familiar: **20%** · 3° familiar: **30%** · 4° familiar: **40%** | Arancel anual | Hermanos, padres e hijos **matriculados simultáneamente** (mismo período). El % aplica al estudiante según su orden. Acreditar vínculo. **No exige promedio** para renovar. Excluye programas especiales de titulación. |
| i | **Experiencia** | Pregrado/postgrado presencial y semipresencial: **20%** · pregrado/postgrado online: **30%** · diplomados: **15%** | Arancel | Personas de **45 años o más**. Acreditar edad con cédula vigente. |
| j | **Conecta Mundo** | Pregrado: **30%** · postgrado: **20%** · diplomados: **15%** | Arancel | Extranjeros residentes **fuera de Chile**, programas **100% online**. Acreditar residencia en el extranjero. |
| k | **Segunda Carrera** | **75% de descuento** sobre arancel anual de la **carrera de menor valor** + **exención de matrícula** de la 2ª carrera (+ exención de arancel de titulación del 2° programa si titula en ambos) | Arancel anual carrera menor valor | Segunda carrera **simultánea**. Requiere ≥ 2 semestres aprobados del programa principal, **promedio ≥ 5,0**, sin sanciones, autorización de ambas Direcciones de Escuela. Carga total semestral no debe exceder en >50% la carga regular (excepción promedio ≥ 6,0). |
| l | **Docentes UNIACC** | Docente: **20%** (<3 años) · **30%** (3 años) · **40%** (5+ años); diplomados **20%**. Hijos/cónyuge/conviviente: **20%** | Arancel anual | Pregrado/postgrado/diplomados, cualquier modalidad. Acreditar docente activo. Válida mientras mantenga la calidad de trabajador/relación académica. **No exige promedio** para renovar. |
| m | **Alumni UNIACC** | Egresado/titulado: **30%** pregrado diurno/vespertino · **40%** pregrado online/semipresencial · **30%** postgrados · **20%** diplomados. Hijos/cónyuge/padre/madre/hermano: **20%** | Arancel | Egresados/titulados UNIACC y familiares directos. Sin deudas anteriores con la Universidad. |
| n | **Colaboradoras/es, Hijas/os y Cónyuges, Padres y Hermanos** | Colaborador/hijos/cónyuge: **exento de matrícula + 50%** del arancel anual. Padres/hermanos: **30%** del arancel anual | Arancel anual (+ matrícula para el primer grupo) | Pregrado/postgrado/educación continua (diurno, vespertino, online, semipresencial). Requiere **contrato indefinido**. Válida mientras sea trabajador. |
| o | **Colaboradoras/es Convenio Colectivo UNIACC** | **Según contrato colectivo** vigente (lo designa Dirección de Gestión de Personas) | Según convenio | Antigüedad mínima 1 año, paga matrícula, horarios fuera de jornada laboral, cupos/vacantes disponibles, aprobación de jefatura y vicerrectorías. |
| p | **Estudio y Familia UNIACC** | Entre **5% y 20%** según tabla por **ingreso per cápita** y **antigüedad laboral** (ver tabla en §6) | Arancel de la carrera | Estudiantes trabajadores. Acreditar antigüedad laboral, cargas familiares e ingresos. Modalidad semipresencial y online prioritariamente. |
| q | **Juntos UNIACC** | **50% de descuento** sobre el arancel de la **carrera de menor valor** | Arancel carrera menor valor | Parejas (matrimonio/unión civil/conviviente acreditado). Aplica al estudiante que postula cuando su pareja ya está matriculada. **No exige promedio** para renovar. |

---

## 5. Catálogo de Becas de Permanencia y Apoyo para Estudiantes Antiguos (Art. 16 N°2 y Art. 18)

### 5.1 Reglas comunes de postulación/renovación de antiguos (Art. 18)
- **Solo estudiantes antiguos** (18.1).
- Al momento de la matrícula deben (18.2):
  - Estar en calidad de **estudiante vigente**.
  - **No registrar morosidades vigentes**, salvo las excepciones del 18.4.
- Estudiantes en **eliminación por causales académicas** pueden regularizar vía **Portal de Solicitudes** (18.3).
- **Tolerancia de morosidad para renovar (18.4):**
  - Con **beneficios ministeriales o CAE**: pueden renovar si **no registran más de 3 cuotas morosas** al momento de la matrícula.
  - **Sin** beneficios ministeriales ni CAE: pueden renovar si **no registran más de 1 cuota morosa** al momento de la matrícula.
- La tolerancia de morosidad **no exime** de regularizar los compromisos financieros (18.5).

| # | Beca | Porcentaje / Monto | Base | Reglas clave |
|---|---|---|---|---|
| a | **Alimentación Interna** | Beneficio en especie (almuerzo diario en casino), no porcentaje | — | Estudiante regular, matrícula vigente, jornada diurna/vespertina, **RSH actualizado**, ficha de postulación anual DVU, **cupos limitados**. **No renovable automáticamente** (postular cada año). |
| b | **Apoyo UNIACC** | Hasta **40%** | Arancel pregrado todas modalidades/jornadas, educación continua, postgrados y programas especiales | Dificultad económica acreditada. **Única beca acumulable** a otros beneficios de la institución. Válida solo el período otorgado, **no renovable automática**. |
| c | **Apoyo a la Permanencia** | Hasta **50% de descuento** sobre la **cuota** de arancel, por **máximo 3 cuotas consecutivas** | Cuota de arancel | Situaciones excepcionales (caso fortuito/fuerza mayor) que arriesgan la continuidad. Analizada por **Comité de Gracia**. Puntual, **no renovable automática**. |
| d | **Rectoría** | Hasta **100% de la matrícula** y/o hasta **100% del arancel anual** | Matrícula y/o arancel anual | Asignada **discrecionalmente por el Rector**. Pregrado todas modalidades/jornadas, educación continua, postgrados; **excluye programas especiales**. Requiere avance académico. No excluye otras becas. Puntual, no renovable automática. |
| e | **Permanencia por Cesantía** | **100% del valor de la cuota arancelaria mensual**, por **máximo 3 cuotas/meses consecutivos** (cobertura = arancel anual ÷ 10 partes) | Cuota mensual de arancel | Modalidad **online/semipresencial/vespertino**. Antigüedad laboral mínima **12 meses con contrato indefinido**. El estudiante debe ser responsable directo del pago (sin fiador). Acreditar cesantía mensualmente (F22/F29, finiquito). **No** aplica por renuncia voluntaria/mutuo acuerdo. **Solo una vez** en toda la carrera. Si percibe nuevos ingresos ≥ sueldo previo, se suspende; si son menores, se ajusta proporcionalmente. |
| f | **Permanencia por Maternidad** | **100% de la matrícula semestral** + descuento sobre **arancel neto semestral** según carga: **50%** si inscribe **hasta 50%** de la carga semestral · **40%** si inscribe entre **51% y 80%** de la carga | Matrícula semestral + arancel neto semestral | Certificado médico/licencia de maternidad. Aplica durante semestres del período pre y post natal. **No acumulable ni compatible** con otros descuentos internos. Solo **una vez** en la trayectoria. Debe estar al día financieramente. |
| g | **Migrantes** | Haitianos: **75%** · Latinoamericanos: **50%** | Arancel anual | Para **antiguos** que ya obtuvieron la beca en períodos anteriores y solicitan renovación. Residencia definitiva en Chile, LEM, sin título de educación superior en Chile, dominio del español, **cupos limitados**. Renovación revisada por DVU + Comité de Gracia. |

---

## 6. Descuentos Institucionales UNIACC (Art. 19)

| # | Descuento | Porcentaje | Base | Reglas clave |
|---|---|---|---|---|
| a | **Rebaja de arancel por convenios con otras instituciones** | **Variable según convenio** | Arancel (pregrado/postgrado/educación continua, según convenio) | Acreditar pertenencia a la institución/empresa con convenio vigente. **Cupos limitados**. Renovación según convenio y Art. 14. |
| b | **Rebaja de matrícula y arancel por pago anticipado — estudiantes nuevos** | Matrícula: entre **0% y 100%** · Arancel: entre **10% y 50%** | Matrícula y arancel anual | **% varía cada mes** según fecha y período de matrícula. Solo alumnos nuevos. El descuento de matrícula vale **solo el primer año**. |
| c | **Rebaja de matrícula por pago anticipado — estudiante antiguo** | Entre **0% y 20%** | Matrícula | Solo alumnos antiguos. % varía según fecha de matrícula y forma de pago. **Acumulable** con el resto de becas y descuentos internos. **No renovable**. |
| d | **Rebaja de arancel por forma de pago** | **5%** (pago total al contado: efectivo/transferencia/cheque al día/débito o crédito hasta 10 cuotas) · **3%** (pago en cuotas sin interés mediante cheques) | Arancel total | Alumno antiguo. % varía según fecha y forma de pago. **Acumulable** con el resto de becas y descuentos internos. |

### 6.1 Tabla Beca Estudio y Familia (Art. 17 p)
Per cápita = **ingreso líquido mensual del estudiante ÷ número de integrantes del grupo familiar acreditados como cargas**.

| Antigüedad laboral \ Ingreso per cápita líquido | $0 – $141.203 | $141.204 – $239.125 | $239.126 – $373.465 | $373.466 – $676.035 | > $676.035 |
|---|---|---|---|---|---|
| 1 a 6 meses | 9% | 8% | 7% | 6% | 5% |
| 6 meses a 1 año | 10% | 9% | 8% | 7% | 6% |
| 1 a 2 años | 18% | 16% | 14% | 12% | 10% |
| Más de 2 años | 20% | 18% | 16% | 14% | 12% |

> Ejemplo del reglamento: familia de 3 integrantes, padre único trabajador con 3 años de antigüedad e ingreso líquido $600.000 → per cápita = $600.000 / 3 = **$200.000** → tramo "$141.204–$239.125" + antigüedad ">2 años" → **18%** sobre el arancel de la carrera.

---

## 7. Beneficios Estatales (Art. 20)

- UNIACC está acreditada, por lo que los estudiantes pueden acceder a beneficios estatales.
- Postulación vía **FUAS** (formulario único de acreditación socioeconómica del MINEDUC), en `postulacion.beneficiosestudiantiles.cl/fuas`. Es responsabilidad **directa del estudiante**; UNIACC no participa salvo en la asignación.

**a) Becas MINEDUC** (entre otras): Beca Juan Gómez Millas (BJGM), BJGM Estudiantes Extranjeros (BJGME), Beca Puntaje PDT, Beca Excelencia Académica (BEA), Beca Hijos de Profesionales de la Educación (BHP), Beca Articulación (BAR), Becas de Reparación, Becas para Estudiantes en Situación de Discapacidad.

**b) CAE (Crédito con Garantía Estatal):** se postula vía FUAS; ver reglas de acumulación y orden de aplicación en §2.2.

---

## 8. Parámetros y variables que el cálculo debe recibir

Para resolver cualquier caso, el motor necesita como **entradas**:

- `categoria_estudiante`: nuevo | antiguo (Art. 2).
- `anio_academico`: para versionar porcentajes/tramos/topes (Arts. 4, 23).
- `arancel_anual`, `arancel_semestral`, `arancel_neto_semestral`, `valor_matricula`, `valor_cuota_mensual`, `arancel_titulacion`.
- `modalidad`: presencial | semipresencial | online | vespertino | diurno.
- `tipo_programa`: pregrado | postgrado | diplomado | educación continua | programa especial / titulación.
- `promedio_acumulado` (para Art. 11 y tabla Art. 13).
- `beneficios_externos`: beca ministerial (sí/no y monto), CAE (sí/no y monto financiado).
- `morosidad_cuotas`: número de cuotas morosas al momento de matrícula (Art. 18.4).
- Datos socioeconómicos/familiares: `ingreso_liquido_mensual`, `integrantes_grupo_familiar`, `antiguedad_laboral`, `cargas`, `RSH`.
- Datos de vínculo: familiares matriculados, relación laboral/docente, edad, nacionalidad/residencia, ranking/notas EM, puntaje PSU/PDT/PAES.
- `fecha_matricula` y `forma_pago` (para descuentos Art. 19 b/c/d, que varían por fecha).
- `cupos_disponibles` por beca con cupo limitado (Art. 5; becas a, alimentación, migrantes, convenios).
- Flags de excepción: `autorizacion_comite_gracia`, `decreto_rector` (Arts. 7, 15, 25).

---

## 9. Algoritmo sugerido de aplicación (orden de cálculo)

1. **Determinar elegibilidad** por categoría (nuevo/antiguo), tipo de programa, modalidad, jornada y requisitos específicos de cada beneficio. Descartar exclusiones (programas especiales/titulación, etc.).
2. **Validar condiciones de matrícula** (antiguos): estudiante vigente y morosidad dentro de tolerancia (Art. 18.4: ≤3 cuotas con ministerial/CAE; ≤1 cuota sin ellos).
3. **Calcular beneficios externos primero**: aplicar **beca ministerial** sobre el arancel (Art. 8).
4. **Seleccionar la beca interna** aplicable. Por defecto **NO se acumulan** entre sí (Art. 9); si hay varias elegibles, elegir la de mayor beneficio neto o la autorizada por Comité de Gracia. Aplicarla sobre la **base declarada** (arancel, saldo, cuota, etc.), respetando exclusiones del Art. 10.
5. **Aplicar ajuste por promedio (Art. 13)** si es renovación y el promedio < 5,5 y la beca exige promedio: `porcentaje_final = porcentaje_base × (1 − %disminucion)`; si promedio ≤ 3,9 → beca = 0 (pérdida).
6. **Aplicar descuentos institucionales acumulables** (Art. 19 c y d son acumulables con becas/descuentos internos; convenios y pago anticipado según reglas).
7. **Aplicar topes**:
   - Becas internas / beca + descuento total: **≤ 70%** del arancel anual (Art. 9).
   - Beca interna + beneficios externos (incl. CAE): **≤ 100%** del arancel (Art. 8).
   - Aplicar el tope **más restrictivo**; recortar excedentes (no se reembolsan).
8. **Aplicar CAE al final** para cubrir el copago/diferencia restante (Art. 8).
9. **Registrar vigencia y renovabilidad**: marcar beneficios "no renovables automáticamente" / puntuales (ej. Apoyo a la Permanencia, Rectoría, Cesantía, Maternidad, Apoyo UNIACC, Alimentación) que requieren nueva postulación.

---

## 10. Notas y supuestos para implementación

- **Versionar por año académico**: los porcentajes, tramos de ingreso, requisitos y topes pueden cambiar anualmente por resolución (Arts. 4 y 23). Mantener tablas paramétricas con vigencia.
- **Cohortes < 2026** conservan condiciones de renovación pactadas (Art. 22): aplicar reglas históricas a esas cohortes.
- **Cupos limitados** condicionan el otorgamiento aunque el estudiante cumpla requisitos (Art. 5; becas con "cupos limitados").
- **Comité de Gracia / Decreto del Rector** pueden alterar topes, acumulaciones y porcentajes en casos excepcionales: dejar un mecanismo de override auditable.
- **Lenguaje inclusivo (Art. 24):** las referencias en masculino aplican igualmente a género femenino (no afecta el cálculo).
- **Tramos de ingreso en pesos**: validar/actualizar los montos de la tabla §6.1 cada año (están sujetos a la revisión anual).
- Donde el reglamento dice "hasta X%", el porcentaje es un **máximo**; el valor efectivo depende de la evaluación del caso (no asumir el máximo por defecto).
