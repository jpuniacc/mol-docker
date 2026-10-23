-- Desbloqueo alumno deuda queda en Rematrícula, justo debajo de NPS rematrícula.
-- 000020 es el grupo Rematrícula. 000024 es el subgrupo Mantenedores.

UPDATE public.bo_menu_item
SET
  parent_id = 'b0000001-0001-4000-8000-000000000020',
  orden = 31,
  activo = true
WHERE id = 'b0000001-0001-4000-8000-000000000046'
  AND route_name = 'dashboard-mantenedor-desbloqueo-toma-ramos';
