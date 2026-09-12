-- Ítem «Gestión de firmas» bajo Rematrícula (DVU; TI vía grupo 3)

INSERT INTO public.bo_menu_item (
  id, parent_id, tipo, label, route_name, icon_key, orden, activo
) VALUES (
  'b0000001-0001-4000-8000-000000000041',
  'b0000001-0001-4000-8000-000000000020',
  'link',
  'Gestión de firmas',
  'dashboard-gestion-firmas',
  'PenLine',
  15,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.bo_menu_item_grupo (menu_item_id, codigo_grupo)
VALUES ('b0000001-0001-4000-8000-000000000041', 1)
ON CONFLICT (menu_item_id, codigo_grupo) DO NOTHING;
