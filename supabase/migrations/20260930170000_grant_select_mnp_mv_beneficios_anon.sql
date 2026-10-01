-- El portal MOL consulta con la llave anon. Estas tablas quedaron sin SELECT para ese rol.

GRANT SELECT ON public.mnp_mv_alumnos_beneficios TO anon;
GRANT SELECT ON public.mnp_mv_alumnos_plan_pago TO anon;
GRANT SELECT ON public.mnp_mv_alumnos_matricular_periodo TO anon;
