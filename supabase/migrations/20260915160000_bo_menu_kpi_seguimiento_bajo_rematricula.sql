-- KPI / Seguimiento: hijos directos de Rematrícula (no de Mantenedores).
-- Parent correcto: b0000001-0001-4000-8000-000000000020 (grupo Rematrícula).
-- 000024 es el subgrupo Mantenedores.

UPDATE public.bo_menu_item
SET
  parent_id = 'b0000001-0001-4000-8000-000000000020',
  orden = 26,
  activo = true
WHERE id = 'b0000001-0001-4000-8000-000000000041'
  AND route_name = 'dashboard-rematricula-kpi';

UPDATE public.bo_menu_item
SET
  parent_id = 'b0000001-0001-4000-8000-000000000020',
  orden = 27,
  activo = true
WHERE id = 'b0000001-0001-4000-8000-000000000042'
  AND route_name = 'dashboard-rematricula-seguimiento';
