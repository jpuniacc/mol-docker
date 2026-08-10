-- La vista v_mnp_mv_plan_pagos usa security_invoker: el rol que consulta (anon/authenticated)
-- necesita SELECT directo sobre la tabla base, no solo sobre la vista.

GRANT SELECT ON public.mnp_mv_plan_pagos_consolidado TO anon, authenticated, service_role;
