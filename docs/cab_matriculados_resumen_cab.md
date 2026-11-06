# CAB — Matriculados 2027-1 (MOL + U+ Test)

- Total matriculados MOL: **162**
- Encontrados en U+ Test (por num_operacion): **162**
- Ambiente ERP de grabado: **TEST_UNIACC** (no producción)

## Formas de pago (proceso MOL)

| Combinación | Cuotas | Alumnos |
|---|---:|---:|
| Pagare M + Pagare A | 10 | 82 |
| Pagare M + Pagare A | 12 | 37 |
| Webpay M + Pagare A | 10 | 19 |
| Webpay M + Pagare A | 12 | 9 |
| Webpay M + Webpay A | (s/d) | 7 |
| Pagare M + Pagare A | (s/d) | 3 |
| Pagare M + Webpay A | 10 | 3 |
| Sin grabar / revisar | (s/d) | 1 |
| Pagare M + Webpay A | 12 | 1 |

## Beneficios / becas / convenios (cartera consolidada)

| Tipo inferido | Filas | Alumnos | Monto |
|---|---:|---:|---:|
| descuento | 114 | 114 | 11.000.000 |
| beneficio_apoyo | 78 | 66 | 49.909.025 |
| beca | 73 | 72 | 112.833.000 |
| otro | 6 | 5 | 3.797.500 |
| convenio | 5 | 5 | 3.903.000 |

### Top códigos de beneficio

| Código | Descripción | Alumnos | Monto |
|---:|---|---:|---:|
| 1756 | Beneficio  Apoyo UNIACC Renovable | 66 | 47.594.100 |
| 2025 | Descuento matricula noviembre | 51 | 2.550.000 |
| 1744 | Beca Talento Presencial | 45 | 82.556.600 |
| 2028 | Descuento matricula diciembre | 32 | 800.000 |
| 1791 | DESCUENTO ANTICIPACION MATRICULA NUEVO | 31 | 7.650.000 |
| 1795 | Beca Talento Virtual | 14 | 17.937.400 |
| 1811 | Beneficio  Apoyo UNIACC No Renovable | 12 | 2.314.925 |
| 1747 | Beca Apoyo Regional | 7 | 4.404.100 |
| 2026 | Descuento especial convenio no vigente | 4 | 2.978.000 |
| 2003 | Matrcula costo 0 Campaña Rentegro | 3 | 750.000 |
| 1809 | Beca Talento Virtual 2 | 3 | 4.290.800 |
| 1746 | Beca Merito Prueba de Seleccion Universitaria PSU PTU | 2 | 1.118.100 |
| 1760 | MC ASIGNATURAS EN UN SEMESTRE | 1 | 2.085.000 |
| 2002 | Beca Migrante Arancel Renovante | 1 | 2.145.000 |
| 749 | Convenio Carabineros de Chile | 1 | 925.000 |

## Cómo quedó en U+ (lectura)

- `CTAPAG=5`: pagarés
- `CTAPAG=434/435`: tarjeta (crédito/débito) Webpay
- `CTAPAG=440`: cuotas Webpay
- `CTAPAG=373`: aplicación de beneficio
- `CTADOC=14`: cuotas del pagaré; `NUMCUOT` = total cuotas
- `CTADOC=41`: boletas
- `CTADOC=811`: docs Webpay
- `MT_POSBEN`: beneficios grabados al alumno en el periodo

## Casos a revisar

- Sin fila U+ por num_operacion: **0**
- Grabar ERP distinto de ok: **1**
  - 20251DACO1DR087 / op 981456: error — Ya existe el beneficio en MT_POSBEN para este periodo.
- Combinación Pagaré+Pagaré sin CTAPAG 5: **1**
- Combinación con Webpay sin docs tarjeta/440: **0**

## Archivos

- `cab_matriculados_completo_mol_uplus.csv` — maestro para la CAB
- `cab_matriculados_beneficios.csv` — 1 fila por beneficio de cartera
- `cab_matriculados_uplus_test.csv` — agregado U+ por operación
- `cab_matriculados_proceso_cartera.csv` — solo lado MOL
