-- Limpieza: eliminar artefactos de la versión inicial mol_discapacidad_encuesta
-- (renombrados a mnp_discapacidad_encuesta en 20260707180000).

DROP FUNCTION IF EXISTS public.guardar_mol_discapacidad_encuesta(
    boolean, text, jsonb, uuid, text, text, text, integer, integer, text, text, boolean
);

DROP TABLE IF EXISTS public.mol_discapacidad_encuesta CASCADE;
