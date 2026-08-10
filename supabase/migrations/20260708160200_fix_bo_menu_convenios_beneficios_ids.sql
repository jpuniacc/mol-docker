-- Corrige colisión de id: Beneficios ERP pisó el ítem Convenios (...000030).
-- Convenios → ...000030 ; Beneficios ERP → ...000031

-- Restaurar Convenios en su id original
INSERT INTO public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo)
VALUES (
  'b0000001-0001-4000-8000-000000000030',
  'b0000001-0001-4000-8000-000000000024',
  'link',
  'Convenios',
  'dashboard-mantenedor-convenios',
  'Handshake',
  30,
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
VALUES ('b0000001-0001-4000-8000-000000000030', 1)
ON CONFLICT (menu_item_id, codigo_grupo) DO NOTHING;

-- Beneficios ERP en id propio
INSERT INTO public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo)
VALUES (
  'b0000001-0001-4000-8000-000000000031',
  'b0000001-0001-4000-8000-000000000024',
  'link',
  'Beneficios ERP',
  'dashboard-vista-beneficios-erp',
  'Gift',
  26,
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
VALUES ('b0000001-0001-4000-8000-000000000031', 1)
ON CONFLICT (menu_item_id, codigo_grupo) DO NOTHING;
