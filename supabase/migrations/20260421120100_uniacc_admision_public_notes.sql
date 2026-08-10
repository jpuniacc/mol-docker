-- Tablas uniacc en public: visibles en PostgREST (schema public expuesto por defecto).
-- Configura RLS y políticas en el Dashboard de Supabase o en migraciones dedicadas
-- (no revocamos permisos sobre todo public para no afectar mv_usuario, mnp_datos_alumnos, etc.).

COMMENT ON FUNCTION public.uniacc_touch_updated_at() IS 'Trigger updated_at para tablas mv_postulantes_sync y mv_postulante_extras.';
