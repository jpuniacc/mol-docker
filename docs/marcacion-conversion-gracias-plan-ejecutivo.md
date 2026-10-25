# Marcación de conversiones en página de agradecimiento
## Plan ejecutivo — UNIACC Web

**Fecha:** 28 agosto 2026  
**Alcance:** Formularios HubSpot nativos (postulación carrera + descarga malla)  
**Sitio:** www.uniacc.cl (prod) / qasitioweb3.uniacc.cl (QA)

---

## Resumen en una frase

Mover el conteo de conversiones de marketing desde el **momento del envío del formulario** hacia la **página `/gracias/`**, para medir solo postulaciones reales completadas y eliminar inflación histórica en reportes.

---

## Situación actual vs. objetivo

| | Hoy | Objetivo |
|---|-----|----------|
| **Cuándo se cuenta la conversión** | Al presionar "Enviar", en la página de la carrera | Al llegar a `/gracias/` |
| **Riesgo de medición** | Doble conteo, refresh, accesos parciales | Un lead = un evento |
| **Descarga de malla** | Conversión en la misma página + PDF inmediato | Conversión en `/gracias/` + entrega del PDF ahí |
| **Base de datos local** | Se guarda el lead (sin cambio) | Se mantiene igual |

---

## Por qué hacer este cambio

1. **Precisión:** Marketing necesita que el reporte refleje postulaciones confirmadas, no intentos de envío.
2. **Histórico:** Ya hubo distorsión de conversiones en implementaciones anteriores; este diseño la evita por diseño.
3. **Estándar de industria:** La thank-you page es el punto de medición habitual en funnels de admisión.
4. **Trazabilidad:** Cada conversión queda ligada a un `lead_id` real en base de datos local.

---

## Solución propuesta (alto nivel)

```
Usuario envía formulario
        ↓
Lead guardado en BD + HubSpot (sin cambio)
        ↓
Datos de conversión guardados temporalmente en el navegador
        ↓
Redirección a /gracias/
        ↓
Un único evento de conversión (GTM / Analytics)
        ↓
Token eliminado → refresh no vuelve a contar
```

**Reglas clave:**
- Sin token válido en `/gracias/` → **no hay conversión** (protege accesos directos).
- Refresh de `/gracias/` → **no hay segunda conversión**.
- Hero postulación y descarga malla → **mismo destino** (`/gracias/`).

---

## Impacto por tipo de formulario

| Formulario | ¿Cambia para el usuario? | ¿Cambia medición? |
|------------|---------------------------|-------------------|
| Postulación carrera (hero) | Mínimo: sigue yendo a `/gracias/` | Sí: evento solo en gracias |
| Descarga malla | Sí: ya no queda en la misma página; va a `/gracias/` y descarga ahí | Sí: evento solo en gracias |
| Acceso directo a `/gracias/` | N/A | No genera conversión |

---

## Dependencias y coordinación

| Área | Responsable | Acción requerida |
|------|-------------|------------------|
| **Desarrollo web** | Equipo técnico UNIACC | Ajuste JS en child theme WordPress |
| **GTM / Analytics** | Go Point | Actualizar tags y triggers; desactivar los actuales en página formulario |
| **Contenido** | Marketing / Web | Copy en `/gracias/` para flujo malla (mensaje + descarga) |
| **QA** | Técnico + Marketing | Validar 5 casos antes de prod (ver abajo) |

> **Crítico:** El deploy de código y el cambio en GTM deben ser **coordinados el mismo día**. Si solo se cambia uno, las conversiones pueden quedar en cero o duplicadas.

---

## Plan de implementación

| Fase | Duración estimada | Entregable |
|------|-------------------|------------|
| **0. Preparación** | 1 día | Backups, confirmación Go Point, copy `/gracias/` |
| **1. QA** | 1–2 días | Pruebas en qasitioweb3.uniacc.cl |
| **2. Producción** | 1 día | Deploy + purga cache + smoke test |
| **3. Monitoreo** | 48 h | Comparar GTM vs. registros en BD |

**Rollback:** Restaurar archivos anteriores + reactivar tags GTM viejos (< 30 min).

---

## Casos de prueba (aceptación)

| # | Escenario | Resultado esperado |
|---|-----------|-------------------|
| 1 | Postular desde una carrera | 1 conversión en `/gracias/`; 0 en página carrera |
| 2 | Descargar malla | Llega a `/gracias/`, conversión + PDF disponible |
| 3 | Entrar directo a `/gracias/` | Solo pageview; sin conversión |
| 4 | Refrescar `/gracias/` tras postular | Sin segunda conversión |
| 5 | Verificar BD | `lead_id` del evento = registro en tabla local |

---

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Conversiones en cero post-deploy | Media | Deploy coordinado con Go Point; preview GTM obligatorio |
| UX malla confusa | Media | Mensaje claro en `/gracias/` + botón descarga visible |
| Formularios legacy aún disparan evento viejo | Baja | Auditoría de formularios WordPress antiguos |
| Popup bloquea PDF | Baja | Link de descarga directo en la página |

---

## Criterios de éxito

- Marketing valida en GTM Preview que **solo `/gracias/`** dispara conversiones.
- Reportes 48 h post-deploy alineados con registros en base de datos.
- Cero quejas de usuarios por flujo roto en postulación carrera.
- Flujo malla funcional: usuario recibe su PDF desde `/gracias/`.

---

## Decisión requerida

| Item | Estado |
|------|--------|
| Medir conversión solo en `/gracias/` | **Aprobado** (requerimiento marketing) |
| Malla también pasa por `/gracias/` | **Aprobado** |
| Coordinación Go Point para GTM | **Pendiente confirmación fecha** |
| Inicio implementación QA | **Pendiente go/no-go** |

---

## Próximo paso

1. Validar este plan con Marketing y Go Point.
2. Confirmar fecha de ventana de deploy (QA → prod).
3. Ejecutar implementación técnica en child theme WordPress.

---

*Documento ejecutivo para presentación — UNIACC / GrafenoLabs — Agosto 2026*
