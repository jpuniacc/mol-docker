-- Campaña reintegro: becas del Excel aplican aunque U+ no las tenga asignadas/renovables.

ALTER TABLE public.mnp_cartera_beneficios
    ADD COLUMN IF NOT EXISTS fuerza_aplica boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.mnp_cartera_beneficios.fuerza_aplica IS
    'true = mostrar y calcular el beneficio aunque U+ no lo tenga asignado ni el catálogo diga renovable.';
