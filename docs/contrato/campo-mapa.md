# Mapa PDF contrato ↔ campos MOL (v1 fixture)

Referencia visual: [`../sql/rpt/Contrato_tipo_Uniacc.pdf`](../sql/rpt/Contrato_tipo_Uniacc.pdf).  
Texto legal fijo: [`clausulas.json`](clausulas.json) / [`../../src/assets/contrato/clausulas.json`](../../src/assets/contrato/clausulas.json).

| Bloque PDF | Campo view-model | Origen MOL |
| --- | --- | --- |
| N° operación | `numOperacion` | `pagoMatricula.numOperacion` |
| Fecha contrato | `fechaContratoLabel` | fecha local al generar preview |
| Nombre alumno | `alumno.nombre` | `useMockAlumnoFuente.nombreMostrado` |
| RUT alumno | `alumno.rut` | `rutMostrado` |
| Domicilio alumno | `alumno.domicilio` | dirección + comuna + ciudad |
| Carrera | `alumno.carrera` | `carreraMostrada` |
| Jornada | `alumno.jornada` | `jornadaMostrada` (mapa D/V/AD si aplica) |
| Periodo académico | `periodoAcademico` | `periodoActivo.label` o preflight ano/periodo |
| Sostenedor nombre | `sostenedor.nombre` | `nombreApoderadoMostrado` |
| Sostenedor RUT | `sostenedor.rut` | `rutApoderadoMostrado` |
| Sostenedor domicilio | `sostenedor.domicilio` / `.comuna` | domicilio alumno si no hay otro |
| Nacionalidad / estado civil / profesión | `sostenedor.*` | `—` si no hay dato (mnp) |
| valor matrícula | `valorMatricula` | suma cuotas item=1 o monto plan |
| valor arancel | `valorArancel` | suma cuotas item=2 o resto |
| Tabla cuotas | `cuotas[]` | `pagoMatricula.cuotasDetalle` |
| Emails cl. 17 | `emailAlumno` / `emailApoderado` | correos fuente / plan |
| Representante legal | `representante.*` | fixture `default` (`asignaturasNuevo=false`) |
| N° contrato string | `contrato` | `pagoMatricula.contrato` |

**Fuera de v1:** Crystal / `SP_IMPRESION_INFORME` / cola `MT_IMPRESION`.
