-- Aranceles referencia CAE por carrera/periodo (MT_CARRER_PAA_PSU, ANO >= 2026).

CREATE TABLE IF NOT EXISTS public.tp_mnp_cae_arancel_referencia (
    cod_carrera text NOT NULL,
    periodo integer NOT NULL,
    ano integer NOT NULL,
    min_curso integer,
    postulantes text,
    postulable integer,
    paga_inscripcion text,
    arancel_x_asignatura text,
    bloquea_vacantes text,
    cupos_regulares integer,
    cupos_especiales integer,
    cupos_sobrecupos integer,
    vacantes integer,
    corte_paa numeric(14, 5),
    corte_psu numeric(14, 5),
    pnd_notem numeric(14, 5),
    nem_punt_min_paa_reg numeric(14, 5),
    nem_psu_reg numeric(14, 5),
    nem_punt_min_psu_reg numeric(14, 5),
    nem_psu_esp numeric(14, 5),
    nem_punt_min_psu_esp numeric(14, 5),
    pnd_verbal numeric(14, 5),
    pnd_matemat numeric(14, 5),
    pnd_hisgeo numeric(14, 5),
    pnd_csoc numeric(14, 5),
    pnd_mat numeric(14, 5),
    pnd_fis numeric(14, 5),
    pnd_quim numeric(14, 5),
    pnd_bio numeric(14, 5),
    verbal_punt_min_paa_reg numeric(14, 5),
    mat_punt_min_paa_reg numeric(14, 5),
    hist_punt_min_paa_reg numeric(14, 5),
    espcs_punt_min_paa_reg numeric(14, 5),
    esp_mat_punt_min_paa_reg numeric(14, 5),
    esp_fis_punt_min_paa_reg numeric(14, 5),
    esp_qui_punt_min_paa_reg numeric(14, 5),
    esp_bio_punt_min_paa_reg numeric(14, 5),
    pnd_verbal_psu numeric(14, 5),
    pnd_matemat_psu numeric(14, 5),
    pnd_hisgeo_psu numeric(14, 5),
    pnd_fis_psu numeric(14, 5),
    pnd_quim_psu numeric(14, 5),
    pnd_bio_psu numeric(14, 5),
    verbal_punt_min_psu_reg numeric(14, 5),
    mat_punt_min_psu_reg numeric(14, 5),
    hist_punt_min_psu_reg numeric(14, 5),
    esp_fis_punt_min_psu_reg numeric(14, 5),
    esp_qui_punt_min_psu_reg numeric(14, 5),
    esp_bio_punt_min_psu_reg numeric(14, 5),
    verbal_psu_esp numeric(14, 5),
    mat_psu_esp numeric(14, 5),
    hist_psu_esp numeric(14, 5),
    esp_fis_psu_esp numeric(14, 5),
    esp_qui_psu_esp numeric(14, 5),
    esp_bio_psu_esp numeric(14, 5),
    verbal_punt_min_psu_esp numeric(14, 5),
    mat_punt_min_psu_esp numeric(14, 5),
    hist_punt_min_psu_esp numeric(14, 5),
    esp_fis_punt_min_psu_esp numeric(14, 5),
    esp_qui_punt_min_psu_esp numeric(14, 5),
    esp_bio_punt_min_psu_esp numeric(14, 5),
    psuesp_ranking numeric(14, 5),
    psureg_ranking numeric(14, 5),
    examina_postulantes text,
    psu_prom_reg numeric(14, 5),
    arancel_referencia numeric(14, 2),
    aprobacion_manual text,
    visar_aa text,
    supernumerarios text,
    usa_plan_cuotas text,
    oculta_mnpan text,
    cod_erp text,
    synced_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tp_mnp_cae_arancel_referencia_pk PRIMARY KEY (cod_carrera, ano, periodo)
);

CREATE INDEX IF NOT EXISTS idx_tp_mnp_cae_arancel_referencia_ano_periodo
    ON public.tp_mnp_cae_arancel_referencia (ano, periodo);

CREATE INDEX IF NOT EXISTS idx_tp_mnp_cae_arancel_referencia_arancel_pos
    ON public.tp_mnp_cae_arancel_referencia (arancel_referencia)
    WHERE arancel_referencia > 0;

CREATE INDEX IF NOT EXISTS idx_tp_mnp_cae_arancel_referencia_synced_at
    ON public.tp_mnp_cae_arancel_referencia (synced_at DESC);

ALTER TABLE public.tp_mnp_cae_arancel_referencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tp_mnp_cae_arancel_referencia_select ON public.tp_mnp_cae_arancel_referencia;
CREATE POLICY tp_mnp_cae_arancel_referencia_select ON public.tp_mnp_cae_arancel_referencia
    FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON TABLE public.tp_mnp_cae_arancel_referencia TO anon, authenticated, service_role;

COMMENT ON TABLE public.tp_mnp_cae_arancel_referencia IS
  'Aranceles referencia CAE por carrera/periodo desde MT_CARRER_PAA_PSU (ANO >= 2026); sync diario + manual.';
