-- DVU (codigo_grupo = 1) ve todo el menú activo de MOL
-- excepto Backoffice: mantenedor de menú y mantenedor de usuarios (solo TI).
-- Incluye el mock de prueba de flujo (antes solo Admisión).

WITH RECURSIVE backoffice_tree AS (
  SELECT id
  FROM public.bo_menu_item
  WHERE id = 'b0000001-0001-4000-8000-000000000060'
     OR route_name IN ('dashboard-backoffice-menu', 'dashboard-backoffice-usuarios')
  UNION ALL
  SELECT c.id
  FROM public.bo_menu_item c
  INNER JOIN backoffice_tree t ON c.parent_id = t.id
)
INSERT INTO public.bo_menu_item_grupo (menu_item_id, codigo_grupo)
SELECT i.id, 1
FROM public.bo_menu_item i
WHERE i.activo = true
  AND i.id NOT IN (SELECT id FROM backoffice_tree)
ON CONFLICT (menu_item_id, codigo_grupo) DO NOTHING;

DELETE FROM public.bo_menu_item_grupo
WHERE codigo_grupo = 1
  AND menu_item_id IN (
    SELECT id FROM public.bo_menu_item
    WHERE id = 'b0000001-0001-4000-8000-000000000060'
       OR parent_id = 'b0000001-0001-4000-8000-000000000060'
       OR route_name IN ('dashboard-backoffice-menu', 'dashboard-backoffice-usuarios')
  );
