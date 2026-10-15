-- Lista MOL de alumnos que pueden pagar matrícula aunque U+ informe deuda.
-- No modifica MT_CLIENT. La administran DVU y TI.

CREATE TABLE IF NOT EXISTS public.mnp_desbloqueo_toma_ramos (
    id bigserial PRIMARY KEY,
    rut_cuerpo text NOT NULL,
    dv char(1) NOT NULL,
    codcli text NOT NULL,
    desbloqueado boolean NOT NULL DEFAULT true,
    actualizado_por text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT mnp_desbloqueo_toma_ramos_rut_chk
        CHECK (rut_cuerpo ~ '^[0-9]{7,8}$'),
    CONSTRAINT mnp_desbloqueo_toma_ramos_dv_chk
        CHECK (dv ~ '^[0-9K]$'),
    CONSTRAINT mnp_desbloqueo_toma_ramos_codcli_chk
        CHECK (codcli ~ '^[A-Z0-9]{4,20}$'),
    CONSTRAINT mnp_desbloqueo_toma_ramos_unico
        UNIQUE (rut_cuerpo, codcli)
);

CREATE INDEX IF NOT EXISTS idx_mnp_desbloqueo_toma_ramos_rut
    ON public.mnp_desbloqueo_toma_ramos (rut_cuerpo)
    WHERE desbloqueado IS TRUE;

COMMENT ON TABLE public.mnp_desbloqueo_toma_ramos IS
    'Excepción MOL al bloqueo de deuda en el pago de matrícula. No escribe DESBL_TOMARAMOS.';

CREATE OR REPLACE FUNCTION public.mnp_desbloqueo_toma_ramos_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_mnp_desbloqueo_toma_ramos_updated_at
    ON public.mnp_desbloqueo_toma_ramos;
CREATE TRIGGER tr_mnp_desbloqueo_toma_ramos_updated_at
    BEFORE UPDATE ON public.mnp_desbloqueo_toma_ramos
    FOR EACH ROW
    EXECUTE FUNCTION public.mnp_desbloqueo_toma_ramos_touch_updated_at();

ALTER TABLE public.mnp_desbloqueo_toma_ramos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mnp_desbloqueo_toma_ramos_select
    ON public.mnp_desbloqueo_toma_ramos;
CREATE POLICY mnp_desbloqueo_toma_ramos_select
    ON public.mnp_desbloqueo_toma_ramos
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS mnp_desbloqueo_toma_ramos_insert
    ON public.mnp_desbloqueo_toma_ramos;
CREATE POLICY mnp_desbloqueo_toma_ramos_insert
    ON public.mnp_desbloqueo_toma_ramos
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS mnp_desbloqueo_toma_ramos_update
    ON public.mnp_desbloqueo_toma_ramos;
CREATE POLICY mnp_desbloqueo_toma_ramos_update
    ON public.mnp_desbloqueo_toma_ramos
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS mnp_desbloqueo_toma_ramos_delete
    ON public.mnp_desbloqueo_toma_ramos;
CREATE POLICY mnp_desbloqueo_toma_ramos_delete
    ON public.mnp_desbloqueo_toma_ramos
    FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mnp_desbloqueo_toma_ramos
    TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.mnp_desbloqueo_toma_ramos_id_seq
    TO anon, authenticated, service_role;

INSERT INTO public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo)
VALUES (
    'b0000001-0001-4000-8000-000000000046',
    'b0000001-0001-4000-8000-000000000024',
    'link',
    'Desbloqueo alumno deuda',
    'dashboard-mantenedor-desbloqueo-toma-ramos',
    'Unlock',
    46,
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
VALUES ('b0000001-0001-4000-8000-000000000046', 1)
ON CONFLICT (menu_item_id, codigo_grupo) DO NOTHING;

DELETE FROM public.bo_menu_item_grupo
WHERE menu_item_id = 'b0000001-0001-4000-8000-000000000046'
  AND codigo_grupo = 2;
