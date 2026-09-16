# Prelación de becas, descuentos y beneficios

Fuente: **Decreto de Rectoría N° 3/2026** — Reglamento de Becas, Descuentos y Beneficios (UNIACC).  
Artículos: **8, 9, 10 y 19**. Complementan: Arts. 7, 13 y 15.

Los montos **no se suman sobre el arancel bruto**. Cada beneficio se aplica en **cascada sobre el saldo** que queda después del paso anterior.

**SUBDERE no entra a esta cascada.** Los alumnos con `CONSOLIDADO = SUBDERE` (62 en el Excel; documento `FINANCIAMIENTO BECA SUBDERE`) quedan **fuera de MOL**: revisión NEDA, pago en una cuota, Backoffice. En el portal reciben el mismo bloqueo que `fuera_cartera_oficial`. No son estatal, ni interna, ni convenio.

---

## 1. Orden de aplicación

| Paso | Tipo | Base | Norma |
| ---: | --- | --- | --- |
| 1 | Beca ministerial / estatal (externa) | Arancel bruto | Art. 8 |
| 2 | Beca interna | Saldo tras estatales | Arts. 8 y 9 |
| 3 | Descuentos institucionales (convenios y, según caso, forma de pago / pago anticipado) | Saldo tras internas | Art. 19 |
| 4 | CAE | Copago / diferencia restante | Art. 8 |

```
Arancel bruto
    │
    ▼
[1] Estatales  ───────────────────────────────  cada una sobre el saldo
    │
    ▼
[2] Una interna renovable (la de mayor %)  +  1756 Apoyo UNIACC
    │                                El 1756 se acumula aunque tenga % mayor
    │                                Si hay maternidad → solo esa (ni 1756)
    ▼
[3] Convenios (apilables sobre el saldo)
    │
    ▼
[4] Topes (internas ≤ 70 % · total ≤ 100 %)
    │                                recorte desde el final (convenio, luego interna)
    ▼
[5] CAE cubre el copago
    │
    ▼
Arancel neto a pagar  (matrícula queda plena, salvo excepciones)
```

---

## 2. Paso a paso

### 2.1 Estatales (`ESTATAL`)

- Se aplican **primero**, en el orden del detalle, cada una **sobre el saldo**.
- Incluyen becas MINEDUC (BJGM, BEA, BHP, BAR, etc.).
- El **Complemento MINEDUC** interno se calcula sobre el saldo **después** de la beca ministerial.

### 2.2 Interna (`MOL_DVU`)

Por defecto las internas **no se acumulan** (Art. 9). En MOL la selección es:

1. Si hay **Permanencia por Maternidad**, aplica **solo esa**. Ni el 1756 ni el resto entran.
2. Si no hay maternidad:
   - La **ganadora** es la interna renovable de **mayor %** ya ajustado (Art. 13, si aplica). El **1756 no participa** de esa pelea.
   - **1756 Beneficio Apoyo UNIACC Renovable** es la **única** interna acumulable: se suma siempre a la ganadora, en cascada sobre el saldo.
   - Si el 1756 tiene un % **mayor** que la ganadora, **igual aplican las dos**. El 1756 no pisa a la otra.
   - Si el alumno solo tiene 1756, aplica solo esa.
3. Las demás internas quedan fuera (Art. 9), salvo autorización del Comité de Gracia.

El **1811 Apoyo UNIACC No Renovable** no entra: flujo `NO_RENOVABLE`.

### 2.3 Convenios y descuentos Art. 19 (`CONVENIO`)

- Rebaja de arancel por convenio: **variable**, apilable sobre el saldo.
- Rebaja por pago anticipado / forma de pago: según Art. 19 b, c y d.
  - 19 c (matrícula antiguo) y 19 d (forma de pago) **sí son acumulables** con becas y descuentos internos.
  - 19 d (forma de pago) en el mock MOL queda **fuera de la cascada de arancel** (`FORMA_PAGO`).

### 2.4 CAE

- Es **acumulable** con becas externas e internas.
- **No resta del arancel** como descuento: cubre el **copago** al final.
- Los excedentes **no se reembolsan**.

---

## 3. Selección de la beca interna

| Situación | Qué aplica |
| --- | --- |
| Varias internas renovables (sin 1756) | Solo la de **mayor %** efectivo |
| Ganadora + 1756 (aunque el 1756 tenga % mayor) | **Las dos**: ganadora primero, 1756 sobre el saldo |
| Solo 1756 | Solo 1756 |
| 1811 Apoyo no renovable | Fuera de prelación |
| Hay Permanencia por Maternidad | **Solo maternidad**; 1756 y el resto no aplican |
| Comité de Gracia autoriza acumulación | Se respeta la resolución (override) |

El **% efectivo** de cada ítem es `monto / arancel_bruto`, ajustado por Art. 13 si la interna mide promedio.

Ejemplo borde (arancel $4.000.000): Talento 20 % + Apoyo 1756 40 %. Ganadora = Talento (el 1756 no compite). Aplican **las dos**: Talento $800.000, saldo $3.200.000; 1756 40 % de $3.200.000 = $1.280.000. Internas = $2.080.000.

---

## 4. Topes

Cuando chocan varias reglas, prevalece la **más restrictiva**.

| Tope | Límite | Norma | Recorte |
| --- | --- | --- | --- |
| Internas (o interna + descuento interno) | **≤ 70 %** del arancel anual | Art. 9 | Desde el final de las internas aplicadas |
| Estatal + interna + convenio (+ CAE) | **≤ 100 %** del arancel | Art. 8 | Desde el final (convenio, luego interna) |

Excedentes sobre el tope **no se reembolsan**. Superar topes solo con **Comité de Gracia** (Arts. 7 y 15) o decreto del Rector (Art. 25).

---

## 5. Qué queda fuera de la prelación

### 5.0 Canal: SUBDERE (fuera de MOL)

No es un flujo de prelación. El alumno **no abre** rematrícula en MOL.

| Dato Excel | N | Decisión (2026-09-15) |
| --- | ---: | --- |
| `CONSOLIDADO = SUBDERE` | 62 (58 rematriculables) | Excluidos de MOL; siguen en cartera Excel |
| Documento `FINANCIAMIENTO BECA SUBDERE` | 62 (1:1 con el consolidado) | Pago en **una cuota**, categoría distinta |
| BECA 1 | casi siempre `Sin beca` | No modelar como `ESTATAL` / `MOL_DVU` / `CONVENIO` |

Renovación: **NEDA**. Canal operativo: **Backoffice**. UI alumno: mismo título/mensaje que fuera de cartera (opción A). Caso: `17420219-2`. Spec: `docs/superpowers/specs/2026-09-15-subdere-fuera-mol-design.md`.

### 5.1 Flujos / estados (sí cargan MOL, no aplican en cascada)

- `NO_RENOVABLE`
- `NO_VIGENTE`
- `EN_REVISION`
- `FORMA_PAGO` (en el cálculo de arancel MOL)
- Sin catálogo
- Internas que **pierden** por Art. 13 (promedio 3,9 a 1,0)

### 5.2 Conceptos que no cubre el descuento (Art. 10)

Becas internas, convenios y descuentos por forma de pago **no se extienden** a:

- Matrícula
- Arancel de titulación y/o grado
- Tutorías
- Aranceles por menor carga académica

Salvo que la beca lo diga expresamente (p. ej. **Rectoría** puede cubrir matrícula; **Segunda Carrera** exime matrícula de la 2ª carrera).

---

## 6. Ajuste por promedio (Art. 13) — antes de aplicar

Si la interna exige promedio de renovación (regla general ≥ 5,5) y el estudiante no lo alcanza:

| Promedio | Disminución de la beca |
| ---: | ---: |
| 5,4 – 5,3 | 15 % |
| 5,2 | 20 % |
| 5,1 | 25 % |
| 5,0 | 30 % |
| 4,9 | 35 % |
| 4,8 | 40 % |
| 4,7 | 45 % |
| 4,6 | 50 % |
| 4,5 | 55 % |
| 4,4 | 60 % |
| 4,3 | 65 % |
| 4,2 | 70 % |
| 4,1 | 75 % |
| 4,0 | 80 % |
| 3,9 – 1,0 | **Pérdida** (fuera de prelación) |

Ejemplo: beca 40 % y promedio 5,0 → `40 % × (1 − 0,30) = 28 %`.  
Promedio ≥ 5,5 → sin disminución.

---

## 7. Ejemplo numérico

Arancel bruto: **$4.000.000**

| Paso | Beneficio | % sobre bruto | Sobre saldo | Monto | Saldo |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1 | Beca ministerial | 50 % | $4.000.000 | $2.000.000 | $2.000.000 |
| 2 | Interna (p. ej. 40 %) | 40 % | $2.000.000 | $800.000 | $1.200.000 |
| 2b | Apoyo UNIACC 10 % | 10 % | $1.200.000 | $120.000 | $1.080.000 |
| — | Tope internas 70 % = $2.800.000 | — | internas = $920.000 | no recorta | $1.080.000 |
| 3 | Convenio 15 % | 15 % | $1.080.000 | $162.000 | $918.000 |
| 4 | CAE | — | copago | cubre $918.000 si hay cupo | copago residual |

Tope 100 % del bruto: descuento estatal + interna + convenio = $2.000.000 + $920.000 + $162.000 = $3.082.000 ≤ $4.000.000 → no recorta.

### 7.1 Apoyo 1756 con % mayor que la ganadora

Arancel bruto: **$4.000.000**. Sin estatal. Talento 20 % + Apoyo 1756 40 %.

| Paso | Beneficio | % sobre bruto | Sobre saldo | Monto | Saldo |
| ---: | --- | ---: | ---: | ---: | ---: |
| 2 | Talento (ganadora) | 20 % | $4.000.000 | $800.000 | $3.200.000 |
| 2b | Apoyo UNIACC 1756 | 40 % | $3.200.000 | $1.280.000 | $1.920.000 |
| — | Tope internas 70 % = $2.800.000 | — | internas = $2.080.000 | no recorta | $1.920.000 |

Las dos aplican. El 1756 no reemplaza al Talento por tener mayor %.

---

## 8. Implementación MOL (mock 2027-01)

MOL recalcula el arancel en esta misma cascada. Diferencias respecto del reglamento:

- El **%** de cada ítem se toma de `monto / arancel_bruto` (se ignora `porc_apr`).
- Todo el descuento va al **arancel**; la matrícula queda plena.
- **CAE no resta**: no hay monto financiado; el saldo es el copago.
- `FORMA_PAGO` no entra en la cascada de arancel.
- **SUBDERE** no llega a este motor: se bloquea antes, como fuera de cartera.
- No se persiste la cascada en U+ en este mock.

Detalle de implementación: `docs/superpowers/specs/2026-09-11-prelacion-becas-design.md`.  
Motor: `src/utils/prelacionArancel.ts`.
