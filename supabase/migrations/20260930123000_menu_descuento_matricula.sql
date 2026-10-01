-- El mantenedor se llama «Descuento de matrícula».
UPDATE public.bo_menu_item
SET label = 'Descuento de matrícula'
WHERE route_name = 'dashboard-mantenedor-descuento-matricula-anticipada'
  AND label = 'Descuento matrícula anticipada';
