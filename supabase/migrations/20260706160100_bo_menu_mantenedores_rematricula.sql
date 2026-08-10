-- Grupo «Mantenedores» bajo Rematrícula + ítem «Periodo activo» (DVU; TI ve todo sin fila grupo).

INSERT INTO public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo)
VALUES (
  'b0000001-0001-4000-8000-000000000024',
  'b0000001-0001-4000-8000-000000000020',
  'group',
  'Mantenedores',
  NULL,
  'Settings',
  40,
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
  'b0000001-0001-4000-8000-000000000025',
  'b0000001-0001-4000-8000-000000000024',
  'link',
  'Periodo activo',
  'dashboard-mantenedor-periodo-activo',
  'Calendar',
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

INSERT INTO public.bo_menu_item_grupo (menu_item_id, codigo_grupo)
VALUES
  ('b0000001-0001-4000-8000-000000000024', 1),
  ('b0000001-0001-4000-8000-000000000025', 1)
ON CONFLICT (menu_item_id, codigo_grupo) DO NOTHING;
