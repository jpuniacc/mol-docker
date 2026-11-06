# Hotfix progreso bandeja — plan corto

> Implementación inline (hotfix). Spec: `docs/superpowers/specs/2026-11-06-hotfix-progreso-bandeja-design.md`

**Goal:** Bandeja con progreso fresco; `forma_pago_ok` reconoce Webpay autorizada (+ RUT sin DV) y borrador medio/autorizada.

## Tasks

1. Migración SQL `20261106190000_…` → apply mol-dev → verificar Catalina `forma_pago`
2. Front: refresh en `cargar()` de bandeja + toast si falla
3. Rebuild mol-dev + smoke RUT `21067143-9`
