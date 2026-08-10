-- Tabla MNP: aranceles ERP (extract mt_arancel.sql)

CREATE TABLE IF NOT EXISTS public.mnp_mt_arancel (
    cod_carrera text,
    ano integer,
    anio_ini integer,
    anio_fin integer,
    monto numeric(14, 2),
    fec_mod timestamptz,
    fec_ini_vig timestamptz,
    fec_ter_vig timestamptz,
    documentos text,
    cuotas integer,
    moneda integer,
    matricula numeric(14, 2),
    periodo integer,
    categoria_alumno integer,
    combo integer,
    jornada text,
    periodo_ingreso integer,
    periodo_final integer,
    arancel_renov integer,
    matricula_renov integer,
    synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mnp_mt_arancel_codcarr_ano
    ON public.mnp_mt_arancel (cod_carrera, ano, categoria_alumno, periodo);

CREATE INDEX IF NOT EXISTS idx_mnp_mt_arancel_ano_jornada
    ON public.mnp_mt_arancel (ano, jornada);

CREATE INDEX IF NOT EXISTS idx_mnp_mt_arancel_synced_at
    ON public.mnp_mt_arancel (synced_at DESC);

COMMENT ON TABLE public.mnp_mt_arancel IS 'Aranceles MT_ARANCEL desde ERP U+ (ANO >= 2026); carga vía sync_erp_to_supabase.py.';
