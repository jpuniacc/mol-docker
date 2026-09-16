-- Restaura el grupo Backoffice (solo TI).
-- Las migraciones de Convenios (...000030) y Casos rematrícula (...000040)
-- reutilizaron los UUID originales del Backoffice. El «Mantenedor de usuarios»
-- (...000050) quedó como hijo de un link y el menú no lo renderiza.

INSERT INTO public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo)
VALUES (
  'b0000001-0001-4000-8000-000000000060',
  NULL,
  'group',
  'Backoffice',
  NULL,
  'Briefcase',
  45,
  true
)
ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  tipo = EXCLUDED.tipo,
  label = EXCLUDED.label,
  route_name = EXCLUDED.route_name,
  icon_key = EXCLUDED.icon_key,
  orden = EXCLUDED.orden,
  activo = EXCLUDED.activo;

INSERT INTO public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo)
VALUES (
  'b0000001-0001-4000-8000-000000000061',
  'b0000001-0001-4000-8000-000000000060',
  'link',
  'Mantenedor menú',
  'dashboard-backoffice-menu',
  'Menu',
  10,
  true
)
ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  tipo = EXCLUDED.tipo,
  label = EXCLUDED.label,
  route_name = EXCLUDED.route_name,
  icon_key = EXCLUDED.icon_key,
  orden = EXCLUDED.orden,
  activo = EXCLUDED.activo;

UPDATE public.bo_menu_item
SET
  parent_id = 'b0000001-0001-4000-8000-000000000060',
  tipo = 'link',
  label = 'Mantenedor de usuarios',
  route_name = 'dashboard-backoffice-usuarios',
  icon_key = 'Users',
  orden = 20,
  activo = true
WHERE id = 'b0000001-0001-4000-8000-000000000050';

-- Sin filas en bo_menu_item_grupo: solo TI (codigo_grupo = 3) ve el bloque.
DELETE FROM public.bo_menu_item_grupo
WHERE menu_item_id IN (
  'b0000001-0001-4000-8000-000000000050',
  'b0000001-0001-4000-8000-000000000060',
  'b0000001-0001-4000-8000-000000000061'
);
