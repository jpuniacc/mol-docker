-- Fix RLS: el front usa anon key (como tp_periodo_activo / bo_menu_item).

DROP POLICY IF EXISTS tp_mnp_convenio_select ON public.tp_mnp_convenio;
CREATE POLICY tp_mnp_convenio_select ON public.tp_mnp_convenio
    FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS tp_mnp_convenio_insert ON public.tp_mnp_convenio;
CREATE POLICY tp_mnp_convenio_insert ON public.tp_mnp_convenio
    FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS tp_mnp_convenio_update ON public.tp_mnp_convenio;
CREATE POLICY tp_mnp_convenio_update ON public.tp_mnp_convenio
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS tp_mnp_convenio_delete ON public.tp_mnp_convenio;
CREATE POLICY tp_mnp_convenio_delete ON public.tp_mnp_convenio
    FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS tp_mnp_convenio_descuento_select ON public.tp_mnp_convenio_descuento;
CREATE POLICY tp_mnp_convenio_descuento_select ON public.tp_mnp_convenio_descuento
    FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS tp_mnp_convenio_descuento_insert ON public.tp_mnp_convenio_descuento;
CREATE POLICY tp_mnp_convenio_descuento_insert ON public.tp_mnp_convenio_descuento
    FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS tp_mnp_convenio_descuento_update ON public.tp_mnp_convenio_descuento;
CREATE POLICY tp_mnp_convenio_descuento_update ON public.tp_mnp_convenio_descuento
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS tp_mnp_convenio_descuento_delete ON public.tp_mnp_convenio_descuento;
CREATE POLICY tp_mnp_convenio_descuento_delete ON public.tp_mnp_convenio_descuento
    FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS tp_mnp_convenio_periodo_select ON public.tp_mnp_convenio_periodo;
CREATE POLICY tp_mnp_convenio_periodo_select ON public.tp_mnp_convenio_periodo
    FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS tp_mnp_convenio_periodo_insert ON public.tp_mnp_convenio_periodo;
CREATE POLICY tp_mnp_convenio_periodo_insert ON public.tp_mnp_convenio_periodo
    FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS tp_mnp_convenio_periodo_update ON public.tp_mnp_convenio_periodo;
CREATE POLICY tp_mnp_convenio_periodo_update ON public.tp_mnp_convenio_periodo
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS tp_mnp_convenio_periodo_delete ON public.tp_mnp_convenio_periodo;
CREATE POLICY tp_mnp_convenio_periodo_delete ON public.tp_mnp_convenio_periodo
    FOR DELETE TO anon, authenticated USING (true);
