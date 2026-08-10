-- Asegura acceso DVU+TI (no Admisión) en ítems Mantenedores Rematrícula bajo ...000024.

DELETE FROM public.bo_menu_item_grupo g
USING public.bo_menu_item i
WHERE g.menu_item_id = i.id
  AND g.codigo_grupo = 2
  AND (
    i.parent_id = 'b0000001-0001-4000-8000-000000000024'
    OR i.id = 'b0000001-0001-4000-8000-000000000024'
  );

-- Vistas ERP / mantenedores Rematrícula (hijos directos del grupo Rematricula ...000020 también)
DELETE FROM public.bo_menu_item_grupo g
USING public.bo_menu_item i
WHERE g.menu_item_id = i.id
  AND g.codigo_grupo = 2
  AND i.route_name IN (
    'dashboard-mantenedor-periodo-activo',
    'dashboard-mantenedor-alumnos-matricular',
    'dashboard-vista-aranceles-erp',
    'dashboard-vista-beneficios-erp',
    'dashboard-vista-estado-cae-alumnos',
    'dashboard-vista-cae-arancel-referencia',
    'dashboard-mantenedor-convenios',
    'dashboard-mantenedor-terminos-condiciones',
    'dashboard-mantenedor-contacto-otp',
    'dashboard-mantenedor-descuento-matricula-anticipada'
  );
