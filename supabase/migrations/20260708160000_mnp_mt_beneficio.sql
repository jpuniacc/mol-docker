-- Tabla MNP: catálogo de beneficios ERP (extract mt_beneficio.sql, Vigencia = 'Si')

CREATE TABLE IF NOT EXISTS public.mnp_mt_beneficio (
    cod_beneficio integer,
    descripcion text,
    porcmax numeric(14, 5),
    montomax numeric(14, 2),
    tipo text,
    aplicable integer,
    usuario integer,
    fec_mod timestamptz,
    apliconcepto text,
    automatico text,
    matricula text,
    benpaa text,
    formapago integer,
    aplical text,
    ano integer,
    exclusivo text,
    prioridad integer,
    codsede text,
    tipocarr text,
    variable text,
    benpromo text,
    bencarrera text,
    anos_duracion numeric(14, 8),
    categoria integer,
    cupos integer,
    ano_egreso_desde integer,
    ano_egreso_hasta integer,
    pagoasociado text,
    origen_beneficio text,
    requisito text,
    fpagogenerada integer,
    jornada text,
    clase integer,
    vigencia text,
    codigo_mineduc integer,
    montocorreccion numeric(14, 8),
    omitetopebeneficios text,
    tipoweb text,
    escala text,
    exclusion text,
    personal text,
    ano_beneficio integer,
    periodo_beneficio integer,
    fecha_inicial timestamptz,
    fecha_final timestamptz,
    monto_tope numeric(14, 2),
    benexcluyente text,
    synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mnp_mt_beneficio_cod
    ON public.mnp_mt_beneficio (cod_beneficio);

CREATE INDEX IF NOT EXISTS idx_mnp_mt_beneficio_tipo
    ON public.mnp_mt_beneficio (tipo);

CREATE INDEX IF NOT EXISTS idx_mnp_mt_beneficio_origen
    ON public.mnp_mt_beneficio (origen_beneficio);

CREATE INDEX IF NOT EXISTS idx_mnp_mt_beneficio_synced_at
    ON public.mnp_mt_beneficio (synced_at DESC);

ALTER TABLE public.mnp_mt_beneficio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mnp_mt_beneficio_select ON public.mnp_mt_beneficio;
CREATE POLICY mnp_mt_beneficio_select ON public.mnp_mt_beneficio
    FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON TABLE public.mnp_mt_beneficio TO anon, authenticated, service_role;

COMMENT ON TABLE public.mnp_mt_beneficio IS
  'Catálogo MT_BENEFICIO desde ERP U+ (Vigencia = Si); carga vía sync_erp_to_supabase.py.';
