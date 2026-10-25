# Task 3 Review — Migración `mnp_cartera_beneficios`

**Range:** `43a85d0..95ade5b` · **Commit:** `95ade5b` · **Verdict:** ✅ Aprobado (1 nota menor)

**Diff:** `.superpowers/sdd/task-3-mnp_cartera_beneficios.diff`

## Spec

| Requisito | OK |
|-----------|----|
| Tabla con campos spec + PK `(periodo, codcli_excel)` + índice `(periodo, rut_norm)` | ✓ |
| CHECK periodo `^\d{4}-0[12]$` (alineado `mnp_mv_beneficio_periodo`, `2027-01`) | ✓ |
| RLS SELECT anon/authenticated + GRANTs (patrón `mnp_cartera_oficial`) | ✓ |
| RPC `consultar_cartera_beneficios`: codcli preferido, fallback rut, vacío si ambos null | ✓ |
| Types `MnpCarteraBeneficiosRow` + RPC en `supabase.ts` | ✓ |

## Quality

- Migración idempotente (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`); comentario de tabla útil.
- RPC `STABLE` + `SECURITY DEFINER` coherente con lectura vía API; **falta `SET search_path = public`** (resto del repo lo incluye).
- Sin políticas INSERT/UPDATE: correcto — carga Task 4 vía `service_role`.
- Fallback `rut_norm` puede devolver >1 fila; documentado en brief; caller debe elegir.
- Aplicada en `supabase@uniacc-desarrollo`; RPC vacío con params nulos verificado.

## Next

Task 4: `scripts/load_cartera_beneficios.py` → UPSERT en tabla.
