# Seguimiento rematrícula — UX v4 (modo trabajo)

**Estado:** propuesta visual · NO IMPLEMENTADO  
**Stamp:** DATOS FICTICIOS  
**Ruta servidor:** `/opt/mol-docker/docs/wireframes/seguimiento-rematricula-v4-ux/`

## Problema
La bandeja v3 se siente como tablero de métricas. Además el panel de **Matriculado U+** muestra Email/Tel/Firmantes en «—» (placeholder del corte UI) y aún ofrece CTAs de envío que no corresponden a un caso cerrado.

## Principio
**Trabajo primero** en bandeja. En panel: datos reales de contacto/progreso; **si chip = matriculado → solo consulta** (sin correo/SMS/WhatsApp/Contactar).

## Entregables
| Archivo | Contenido |
|---|---|
| `01-antes-vs-despues.png` | Gap AS-IS vs TO-BE |
| `02-bandeja-trabajo.png` | Bandeja compacta |
| `03-panel-caso.png` | Panel en curso (forma de pago) |
| `04-checklist-ux-v4.png` | Checklist PR |
| `05-panel-matriculado.png` | Panel Matriculado U+: datos + **sin** acciones de envío |
| `PROMPT-AGENTE-CURSOR-UX-V4.md` | Prompt Cursor |

## Reglas panel
| Chip | Contacto email/tel/firmantes | Agregar contacto | Contactar / correo / SMS / WA |
|---|---|---|---|
| 1–7 (en curso) | Mostrar datos API (no «—» fijos) | Sí | Corte 2 (ocultar o tooltip) |
| 8 Matriculado U+ | Mostrar datos API | Ocultar (o solo nota interna si se decide) | **Ocultar siempre** |

## API mínima (sí entra en este track UX si hace falta)
Enriquecer `GET .../casos/:codcli` con email alumno, teléfono y resumen firmantes desde fuentes ya usadas en MOL (borrador / contacto / TuFirma). Sin eso el panel sigue vacío aunque el layout mejore.

## Relación
- Hotfix progreso: independiente.
- Corte 2: habilita Contactar solo para chips ≠ matriculado.
