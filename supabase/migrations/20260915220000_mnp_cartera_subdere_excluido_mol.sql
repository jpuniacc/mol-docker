-- SUBDERE: siguen en cartera, excluidos del flujo MOL (mismo bloqueo que fuera de cartera).

ALTER TABLE public.mnp_cartera_oficial
  ADD COLUMN IF NOT EXISTS excluido_mol boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.mnp_cartera_oficial.excluido_mol IS
  'true = fuera del flujo MOL (SUBDERE / NEDA). Sigue en cartera; no se borra.';

CREATE OR REPLACE FUNCTION public.refresh_fuera_cartera_oficial()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    n integer;
BEGIN
    UPDATE public.mnp_mv_plan_pagos_consolidado c
    SET fuera_cartera_oficial = NOT EXISTS (
        SELECT 1
        FROM public.mnp_cartera_oficial o
        WHERE o.excluido_mol = false
          AND o.rut_norm = regexp_replace(
            upper(replace(replace(coalesce(c.rut_alumno, ''), '.', ''), '-', '')),
            '[^0-9K]',
            '',
            'g'
        )
    );
    SELECT count(*)::integer INTO n
    FROM public.mnp_mv_plan_pagos_consolidado
    WHERE fuera_cartera_oficial;
    RETURN n;
END;
$$;

COMMENT ON FUNCTION public.refresh_fuera_cartera_oficial() IS
  'fuera_cartera_oficial = true si el RUT no está en mnp_cartera_oficial o excluido_mol.';

GRANT EXECUTE ON FUNCTION public.refresh_fuera_cartera_oficial() TO service_role;

UPDATE public.mnp_cartera_oficial
SET excluido_mol = true
WHERE rut_norm IN (
  '102974840',
  '103411890',
  '109791334',
  '11476051K',
  '11619130K',
  '118846125',
  '11956168K',
  '119562589',
  '119736250',
  '121259826',
  '121340925',
  '12167792K',
  '122260887',
  '123868900',
  '125033245',
  '125395511',
  '12586760K',
  '126064527',
  '126065612',
  '126836325',
  '128697144',
  '130550282',
  '131104812',
  '132172021',
  '136665278',
  '137652528',
  '138238555',
  '139144619',
  '139159071',
  '141374931',
  '145386969',
  '151209505',
  '154309586',
  '155721154',
  '157043285',
  '159620743',
  '161490830',
  '161764175',
  '162476785',
  '164059421',
  '164240894',
  '16484336K',
  '165263987',
  '166623014',
  '166673062',
  '167881858',
  '168210124',
  '170697189',
  '170808940',
  '173795955',
  '174202192',
  '174642893',
  '176958367',
  '17922030K',
  '181878339',
  '184477793',
  '18950540K',
  '191418476',
  '191649974',
  '192786231',
  '91318628',
  '97479992'
);

SELECT public.refresh_fuera_cartera_oficial();
