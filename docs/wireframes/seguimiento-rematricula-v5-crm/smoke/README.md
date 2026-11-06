# Smoke UX v5 CRM — mol-dev

**Fecha:** 2026-11-06  
**Deploy:** `uniacc-api` + `mol-dev` rebuild; migración `20261106200000_seguimiento_v5_crm.sql` aplicada en `supabase-db`.

## API (verificado en contenedor)

| Check | Resultado |
|-------|-----------|
| `GET /board` 8 columnas | OK (`sin_ingreso`…`matriculado`, totales coherentes) |
| `GET /kpi` `sin_contactar_7d` | OK (presente) |
| `GET /casos/:codcli` enrichment | OK (email/tel/firmantes/medios; ej. matriculado `20251MUIN1DR017`) |

## UI funcional (requiere sesión BO)

Checklist manual (login LDAP):

1. Toggle Lista / Board  
2. Drawer chip ≠ 8: Contactar disabled «Próximamente» + Agregar nota  
3. Drawer Matriculado U+: sin Contactar; datos contacto si BD tiene  
4. Alerta +7d filtra lista (pill quitar)

Capturas 4×: guardar aquí como `lista.png`, `board.png`, `drawer-curso.png`, `drawer-matriculado.png` tras smoke visual.

## T5 hooks

Helper `registrarEventoSistema` + migración `origen=sistema` listos.  
**Hooks Webpay / TuFirma / matricular diferidos** (follow-up) por riesgo en caminos de pago/firma.

## Fuera de este PR

Hotfix progreso `forma_pago_ok` / Webpay — track aparte.
