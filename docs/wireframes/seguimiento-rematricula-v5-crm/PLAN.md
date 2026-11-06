# Seguimiento rematrícula — UX v5 CRM HubSpot-lite

**Estado:** propuesta visual · NO IMPLEMENTADO  
**Stamp:** DATOS FICTICIOS · UX CRM PROPUESTA / NO IMPLEMENTADO  
**Ruta servidor:** `/opt/mol-docker/docs/wireframes/seguimiento-rematricula-v5-crm/`  
**Colores:** naranja `#FF5B00` · navy `#1E3A5F`

## Problema
La bandeja v3/v4 se siente tablero/panel compacto, no CRM de trabajo diario. Juan Pablo pidió look tipo HubSpot: lista + ficha, timeline, propiedades.

## Decisión de diseño (aprobada)
| Decisión | Valor |
|---|---|
| Enfoque | **A — HubSpot-lite** |
| Vista default | **Lista** + filtros izq ~220px + tabla lean |
| Alternativa | Toggle **Lista \| Board** (mismas columnas 1–8) |
| Apertura caso | **Drawer derecho ~480px** (lista/board detrás) |
| Matriculado U+ | Solo **Agregar nota** interna; SIN correo/SMS/WA/Contactar |

## Estructura UI
1. **Header:** título · select Cartera · buscar · Actualizar · toggle Lista|Board  
2. **Filtros izq (~220px):** cartera, etapa embudo 1–8, alertas  
3. **Centro:** tabla lean (Alumno · Etapa · Último contacto · Próxima · Ejecutivo) **o** board por etapa  
4. **Drawer:** cabecera (nombre, RUT, codcli, chip, carrera) · acciones · propiedades · timeline · recordatorios si M&&!F  

## Reglas drawer
| Chip | Contactar / correo / SMS / WA | Agregar nota | Propiedades contacto |
|---|---|---|---|
| 1–7 (en curso) | Contactar ▾ (Corte 2) | Sí | Datos API reales |
| 8 Matriculado U+ | **Ocultar siempre** | **Sí** (única acción) | Datos API reales (no «—» fijos) |

Recordatorios automáticos: solo si matrícula Webpay sí **y** firma no (M && !F).

## API mínima (lectura)
Enriquecer `GET .../casos/:codcli` con email, teléfono y resumen firmantes desde fuentes ya usadas en MOL (borrador / contacto / TuFirma). Sin eso el drawer sigue vacío aunque el layout mejore.

## Entregables
| Archivo | Contenido |
|---|---|
| `01-lista-filtros.png` | Bandeja lista + sidebar filtros |
| `02-board.png` | Vista board por etapas 1–8 |
| `03-drawer-en-curso.png` | Drawer forma de pago · Contactar + Agregar nota |
| `04-drawer-matriculado.png` | Florencia Matriculado U+ · solo Agregar nota + datos reales |
| `05-checklist.png` | Checklist PR |
| `PROMPT-AGENTE-CURSOR-UX-V5-CRM.md` | Prompt Cursor |

## Relación con otros tracks
- Hotfix progreso (Catalina / forma de pago): independiente.  
- Corte 2: habilita Contactar real solo para chips ≠ matriculado.  
- v4 UX: descartada a favor de este CRM HubSpot-lite.
