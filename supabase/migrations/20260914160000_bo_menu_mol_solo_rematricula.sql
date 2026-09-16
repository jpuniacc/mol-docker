-- MOL queda solo para rematrícula.
-- Oculta el grupo Matrícula (Postulaciones, Simulador, Mantenedor carreras)
-- y los ítems Matriculados / Firma Contrato de Rematrícula.
-- Soft-hide: activo = false; se pueden reactivar sin re-seed.

WITH RECURSIVE matricula_tree AS (
  SELECT id
  FROM public.bo_menu_item
  WHERE id = 'b0000001-0001-4000-8000-000000000010'
     OR (parent_id IS NULL AND tipo = 'group' AND lower(label) IN ('matricula', 'matrícula'))
  UNION ALL
  SELECT c.id
  FROM public.bo_menu_item c
  INNER JOIN matricula_tree t ON c.parent_id = t.id
)
UPDATE public.bo_menu_item
SET activo = false
WHERE id IN (SELECT id FROM matricula_tree)
   OR id IN (
     'b0000001-0001-4000-8000-000000000021',
     'b0000001-0001-4000-8000-000000000022'
   )
   OR route_name IN (
     'dashboard-postulantes',
     'dashboard-simulador-uso',
     'dashboard-mantenedor-carreras',
     'dashboard-estado-firma-contrato',
     'dashboard-matriculados'
   );
