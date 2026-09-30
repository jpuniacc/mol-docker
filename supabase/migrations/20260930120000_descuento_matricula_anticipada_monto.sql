-- El descuento de matrícula anticipada es un monto en pesos, no un porcentaje.
-- Los valores 20 y 10 eran porcentajes de ejemplo: no se reinterpretan como pesos.

ALTER TABLE public.tp_mnp_descuento_matricula_anticipada
    ADD COLUMN IF NOT EXISTS monto_descuento numeric(14, 2);

UPDATE public.tp_mnp_descuento_matricula_anticipada
SET monto_descuento = 0
WHERE monto_descuento IS NULL;

ALTER TABLE public.tp_mnp_descuento_matricula_anticipada
    ALTER COLUMN monto_descuento SET NOT NULL;

ALTER TABLE public.tp_mnp_descuento_matricula_anticipada
    DROP CONSTRAINT IF EXISTS tp_mnp_descuento_matricula_anticipada_porcentaje_descuento_check;

ALTER TABLE public.tp_mnp_descuento_matricula_anticipada
    DROP COLUMN IF EXISTS porcentaje_descuento;

ALTER TABLE public.tp_mnp_descuento_matricula_anticipada
    DROP CONSTRAINT IF EXISTS tp_mnp_descuento_matricula_anticipada_monto_chk;

ALTER TABLE public.tp_mnp_descuento_matricula_anticipada
    ADD CONSTRAINT tp_mnp_descuento_matricula_anticipada_monto_chk
        CHECK (monto_descuento >= 0);

COMMENT ON COLUMN public.tp_mnp_descuento_matricula_anticipada.monto_descuento IS
    'Monto del descuento en pesos. No es un porcentaje.';
