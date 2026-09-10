# Catálogo de beneficios por periodo (`mnp_mv_beneficio_periodo`)

Fecha: 2026-09-10  
Proyecto: `mol-docker`  
Estado: implementado (migración + seed 2027-01 en Supabase local)

## Problema

Los códigos vigentes para rematrícula 2027-01 viven en un Excel. MOL no tiene un catálogo versionado por periodo que diga, con claridad, cuáles aplican, con qué flujo (estatal vs MOL/DVU) y si el convenio pide certificado.

## Decisiones

| Tema | Decisión |
|------|----------|
| Alcance de filas | Los 67 códigos del Excel `cod_beneficios.xlsx` |
| Periodo | Campo `periodo` texto; primera carga `2027-01`. No se carga 2026 ni periodos anteriores |
| Nombre | Tabla física `mnp_mv_beneficio_periodo` (no reutilizar `tp_mnp_convenio`) |
| Vista de los que aplican | `v_mnp_mv_convenios` = misma tabla filtrada `aplica = true` |
| Código 2026 (En revisión) | `aplica = false`; no hay flujo especial |
| Consumo ahora | Solo catálogo en Supabase (seed). Mock y mantenedor quedan fuera |
| Relación con `tp_mnp_convenio` | Independiente. El mantenedor de convenios no se toca |

## Modelo

```text
cod_beneficios.xlsx ──► seed SQL ──► mnp_mv_beneficio_periodo
                                           │
                                           └── v_mnp_mv_convenios (aplica = true)
```

Clave de negocio: `(periodo, codigo_beneficio)` única.

### Columnas

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `periodo` | text NOT NULL | Formato `YYYY-0S`, ej. `2027-01` |
| `codigo_beneficio` | text NOT NULL | Código ERP / Excel |
| `beneficio` | text NOT NULL | Nombre |
| `renovable` | text | Valor crudo de `RENOVABLE POR NOTAS` |
| `convenio` | text | Valor crudo de `CONVENIO` |
| `flujo` | text NOT NULL | Ver catálogo abajo |
| `aplica` | boolean NOT NULL | Si el código entra al proceso de ese periodo |
| `requiere_certificado` | boolean NOT NULL DEFAULT false | |
| `tipo_certificado` | text | `AFILIACION` / `ANTIGUEDAD_LABORAL` / null |
| `created_at` | timestamptz | default now() |

Check de `flujo`:

- `ESTATAL` — otro flujo (MINEDUC / estatal)
- `MOL_DVU` — mismo flujo MOL (incluye DVU, renovable con/sin notas)
- `CONVENIO` — mismo flujo MOL + certificado si corresponde
- `FORMA_PAGO` — mismo flujo; se recalcula, no se hereda
- `NO_RENOVABLE` — no se arrastra
- `NO_VIGENTE` — convenio caído
- `EN_REVISION` — no aplica (reservado; 2026 queda así con `aplica = false`)

Check de `periodo`: `^\d{4}-0[12]$`.

Índices: único `(periodo, codigo_beneficio)`; índice `(periodo, aplica)`.

## Regla `aplica` (2027-01)

`aplica = true` (36):

- 8 estatales (`ESTATAL`)
- 21 MOL/DVU (`MOL_DVU`)
- 4 convenios vigentes (`CONVENIO`)
- 3 forma de pago (`FORMA_PAGO`)

`aplica = false` (31):

- 26 no renovables
- 4 convenios no vigentes (1709, 1766, 1773, 1775)
- 1 código 2026 En revisión

Convenios vigentes que piden certificado:

| Código | Institución | `tipo_certificado` |
|---|---|---|
| 89 | Sindicato BancoEstado | `ANTIGUEDAD_LABORAL` |
| 749 | Carabineros de Chile | `ANTIGUEDAD_LABORAL` |
| 1552 | Caja Los Andes | `AFILIACION` |
| 1565 | Caja La Araucana | `AFILIACION` |

Fuente de seed: `docs/becas-beneficios/cod_beneficios_flujos_2027-01.csv` alineado al Excel.

## Seguridad y acceso

Mismo patrón que `mnp_mt_beneficio`:

- RLS habilitado
- `SELECT` para `anon`, `authenticated`, `service_role`
- Sin INSERT/UPDATE/DELETE desde el front en este MVP (la carga es migración/seed)
- `GRANT SELECT` a esos roles
- Vista `v_mnp_mv_convenios` también `SELECT` only

## Fuera de alcance (este paso)

- Consumo desde el mock de rematrícula
- Mantenedor / pantalla de edición
- Seed de periodos 2026 o anteriores
- Cambiar `tp_mnp_convenio` / `tp_mnp_convenio_periodo`
- Lógica de promedio 5,5 o validación de certificado

## Criterios de éxito

1. Existe `mnp_mv_beneficio_periodo` con 67 filas `periodo = '2027-01'`.
2. `v_mnp_mv_convenios` devuelve 36 filas para `2027-01`.
3. Código 2026 está en la tabla con `aplica = false` y `flujo = EN_REVISION`.
4. No hay filas con `periodo` 2026.
5. Consulta típica: `SELECT * FROM v_mnp_mv_convenios WHERE periodo = '2027-01'`.
