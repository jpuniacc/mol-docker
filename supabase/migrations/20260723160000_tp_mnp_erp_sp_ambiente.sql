-- Ambiente ERP para SP on-demand (prod|test). ETL/integración no usa esta tabla.

CREATE TABLE IF NOT EXISTS public.tp_mnp_erp_sp_ambiente (
    id serial PRIMARY KEY,
    ambiente text NOT NULL CHECK (ambiente IN ('prod', 'test')),
    label text NOT NULL,
    estado boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tp_mnp_erp_sp_ambiente_ambiente_uk UNIQUE (ambiente)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tp_mnp_erp_sp_ambiente_unico_activo
    ON public.tp_mnp_erp_sp_ambiente ((true)) WHERE estado IS TRUE;

COMMENT ON TABLE public.tp_mnp_erp_sp_ambiente IS
    'Ambiente SQL Server para SP on-demand (uniacc-api). Exactamente uno con estado=true. Credenciales solo en .env.';

ALTER TABLE public.tp_mnp_erp_sp_ambiente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tp_mnp_erp_sp_ambiente_select ON public.tp_mnp_erp_sp_ambiente;
CREATE POLICY tp_mnp_erp_sp_ambiente_select ON public.tp_mnp_erp_sp_ambiente
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS tp_mnp_erp_sp_ambiente_update ON public.tp_mnp_erp_sp_ambiente;
CREATE POLICY tp_mnp_erp_sp_ambiente_update ON public.tp_mnp_erp_sp_ambiente
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, UPDATE ON public.tp_mnp_erp_sp_ambiente TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.tp_mnp_erp_sp_ambiente_id_seq TO anon, authenticated, service_role;

INSERT INTO public.tp_mnp_erp_sp_ambiente (ambiente, label, estado)
VALUES
    ('prod', 'Producción', true),
    ('test', 'Test espejado', false)
ON CONFLICT (ambiente) DO UPDATE SET
    label = EXCLUDED.label;

CREATE OR REPLACE FUNCTION public.activar_tp_mnp_erp_sp_ambiente(p_ambiente text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_ambiente IS NULL OR p_ambiente NOT IN ('prod', 'test') THEN
        RAISE EXCEPTION 'Ambiente inválido: % (use prod|test)', p_ambiente;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.tp_mnp_erp_sp_ambiente WHERE ambiente = p_ambiente) THEN
        RAISE EXCEPTION 'Ambiente % no existe', p_ambiente;
    END IF;

    UPDATE public.tp_mnp_erp_sp_ambiente
    SET estado = false, updated_at = now()
    WHERE estado IS TRUE;

    UPDATE public.tp_mnp_erp_sp_ambiente
    SET estado = true, updated_at = now()
    WHERE ambiente = p_ambiente;
END;
$$;

COMMENT ON FUNCTION public.activar_tp_mnp_erp_sp_ambiente(text) IS
    'Desactiva todos los ambientes SP y activa prod|test (atómico).';

GRANT EXECUTE ON FUNCTION public.activar_tp_mnp_erp_sp_ambiente(text) TO anon, authenticated, service_role;

-- Menú: Ambiente ERP SP bajo Mantenedores (solo DVU; TI ve todo)
INSERT INTO public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo)
VALUES (
  'b0000001-0001-4000-8000-000000000040',
  'b0000001-0001-4000-8000-000000000024',
  'link',
  'Ambiente ERP SP',
  'dashboard-mantenedor-erp-sp-ambiente',
  'Database',
  55,
  true
)
ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  tipo = EXCLUDED.tipo,
  label = EXCLUDED.label,
  route_name = EXCLUDED.route_name,
  icon_key = EXCLUDED.icon_key,
  orden = EXCLUDED.orden,
  activo = EXCLUDED.activo;

INSERT INTO public.bo_menu_item_grupo (menu_item_id, codigo_grupo)
VALUES ('b0000001-0001-4000-8000-000000000040', 1)
ON CONFLICT (menu_item_id, codigo_grupo) DO NOTHING;

-- Admisión (grupo 2) no debe ver este ítem
DELETE FROM public.bo_menu_item_grupo
WHERE menu_item_id = 'b0000001-0001-4000-8000-000000000040'
  AND codigo_grupo = 2;
