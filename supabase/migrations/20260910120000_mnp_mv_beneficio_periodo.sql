-- Catálogo de beneficios / convenios por periodo académico (Excel 2027-01).
-- Independiente de tp_mnp_convenio. Solo seed 2027-01 en adelante.

CREATE TABLE IF NOT EXISTS public.mnp_mv_beneficio_periodo (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    periodo text NOT NULL
        CHECK (periodo ~ '^\d{4}-0[12]$'),
    codigo_beneficio text NOT NULL,
    beneficio text NOT NULL,
    renovable text,
    convenio text,
    flujo text NOT NULL
        CHECK (flujo IN (
            'ESTATAL',
            'MOL_DVU',
            'CONVENIO',
            'FORMA_PAGO',
            'NO_RENOVABLE',
            'NO_VIGENTE',
            'EN_REVISION'
        )),
    aplica boolean NOT NULL,
    requiere_certificado boolean NOT NULL DEFAULT false,
    tipo_certificado text
        CHECK (tipo_certificado IS NULL OR tipo_certificado IN ('AFILIACION', 'ANTIGUEDAD_LABORAL')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (periodo, codigo_beneficio)
);

CREATE INDEX IF NOT EXISTS idx_mnp_mv_beneficio_periodo_aplica
    ON public.mnp_mv_beneficio_periodo (periodo, aplica);

COMMENT ON TABLE public.mnp_mv_beneficio_periodo IS
    'Catálogo de códigos de beneficio por periodo (Excel rematrícula). periodo = YYYY-0S.';

COMMENT ON COLUMN public.mnp_mv_beneficio_periodo.aplica IS
    'true si el código entra al proceso de ese periodo (estatal, MOL/DVU, convenio vigente o forma de pago).';

CREATE OR REPLACE VIEW public.v_mnp_mv_convenios
WITH (security_invoker = true)
AS
SELECT
    id,
    periodo,
    codigo_beneficio,
    beneficio,
    renovable,
    convenio,
    flujo,
    aplica,
    requiere_certificado,
    tipo_certificado,
    created_at
FROM public.mnp_mv_beneficio_periodo
WHERE aplica = true;

COMMENT ON VIEW public.v_mnp_mv_convenios IS
    'Beneficios que aplican en el periodo (aplica = true). Filtrar por periodo, ej. 2027-01.';

ALTER TABLE public.mnp_mv_beneficio_periodo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mnp_mv_beneficio_periodo_select ON public.mnp_mv_beneficio_periodo;
CREATE POLICY mnp_mv_beneficio_periodo_select ON public.mnp_mv_beneficio_periodo
    FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON TABLE public.mnp_mv_beneficio_periodo TO anon, authenticated, service_role;
GRANT SELECT ON public.v_mnp_mv_convenios TO anon, authenticated, service_role;

INSERT INTO public.mnp_mv_beneficio_periodo (
    periodo,
    codigo_beneficio,
    beneficio,
    renovable,
    convenio,
    flujo,
    aplica,
    requiere_certificado,
    tipo_certificado
)
VALUES
    ('2027-01', '6', 'Beca Excelencia Academica', 'BECA ESTATAL', NULL, 'ESTATAL', true, false, NULL),
    ('2027-01', '8', 'Beca Hijo de Profesional de la Educacion', 'BECA ESTATAL', NULL, 'ESTATAL', true, false, NULL),
    ('2027-01', '9', 'Beca Juan Gomez Millas', 'BECA ESTATAL', NULL, 'ESTATAL', true, false, NULL),
    ('2027-01', '10', 'Beca Juan Gomez Millas Extranjero', 'BECA ESTATAL', NULL, 'ESTATAL', true, false, NULL),
    ('2027-01', '12', 'Beca de Articulacion', 'BECA ESTATAL', NULL, 'ESTATAL', true, false, NULL),
    ('2027-01', '13', 'Beca Traspaso Valech', 'BECA ESTATAL', NULL, 'ESTATAL', true, false, NULL),
    ('2027-01', '93', 'Beca Juan Gomez Millas Discapacidad', 'BECA ESTATAL', NULL, 'ESTATAL', true, false, NULL),
    ('2027-01', '2009', 'Compensacion de Beneficio', 'BECA ESTATAL', NULL, 'ESTATAL', true, false, NULL),
    ('2027-01', '1859', 'Beca Migrante Matricula Renovante', 'BECA DVU', NULL, 'MOL_DVU', true, false, NULL),
    ('2027-01', '2002', 'Beca Migrante Arancel Renovante', 'BECA DVU', NULL, 'MOL_DVU', true, false, NULL),
    ('2027-01', '760', 'Beca PSU', 'RENOVACION / PROMEDIO GENERAL 5.5 O SUPERIOR', NULL, 'MOL_DVU', true, false, NULL),
    ('2027-01', '1519', 'BECA NEM', 'RENOVACION / PROMEDIO GENERAL 5.5 O SUPERIOR', NULL, 'MOL_DVU', true, false, NULL),
    ('2027-01', '1636', 'Admision UNIACC', 'RENOVACION / PROMEDIO GENERAL 5.5 O SUPERIOR', NULL, 'MOL_DVU', true, false, NULL),
    ('2027-01', '1640', 'Beca Complementaria Fondo UNIACC', 'RENOVACION / PROMEDIO GENERAL 5.5 O SUPERIOR', NULL, 'MOL_DVU', true, false, NULL),
    ('2027-01', '1641', 'DACC', 'RENOVACION / PROMEDIO GENERAL 5.5 O SUPERIOR', NULL, 'MOL_DVU', true, false, NULL),
    ('2027-01', '1645', 'Beca Egresados de IACC', 'RENOVACION / PROMEDIO GENERAL 5.5 O SUPERIOR', NULL, 'MOL_DVU', true, false, NULL),
    ('2027-01', '1744', 'Beca Talento Presencial', 'RENOVACION / PROMEDIO GENERAL 5.5 O SUPERIOR', NULL, 'MOL_DVU', true, false, NULL),
    ('2027-01', '1745', 'Beca Merito Academico', 'RENOVACION / PROMEDIO GENERAL 5.5 O SUPERIOR', NULL, 'MOL_DVU', true, false, NULL),
    ('2027-01', '1746', 'Beca Merito Prueba de Seleccion Universitaria PSU PTU', 'RENOVACION / PROMEDIO GENERAL 5.5 O SUPERIOR', NULL, 'MOL_DVU', true, false, NULL),
    ('2027-01', '1747', 'Beca Apoyo Regional', 'RENOVACION / PROMEDIO GENERAL 5.5 O SUPERIOR', NULL, 'MOL_DVU', true, false, NULL),
    ('2027-01', '1748', 'Beca Complementaria Becas MINEDUC', 'RENOVACION / PROMEDIO GENERAL 5.5 O SUPERIOR', NULL, 'MOL_DVU', true, false, NULL),
    ('2027-01', '1750', 'Beca EgresadosTitulados UNIACC Hijos y Conyuge', 'RENOVACION / PROMEDIO GENERAL 5.5 O SUPERIOR', NULL, 'MOL_DVU', true, false, NULL),
    ('2027-01', '1756', 'Beneficio Apoyo UNIACC Renovable', 'RENOVACION / PROMEDIO GENERAL 5.5 O SUPERIOR', NULL, 'MOL_DVU', true, false, NULL),
    ('2027-01', '1795', 'Beca Talento Virtual', 'RENOVACION / PROMEDIO GENERAL 5.5 O SUPERIOR', NULL, 'MOL_DVU', true, false, NULL),
    ('2027-01', '1809', 'Beca Talento Virtual 2', 'RENOVACION / PROMEDIO GENERAL 5.5 O SUPERIOR', NULL, 'MOL_DVU', true, false, NULL),
    ('2027-01', '2033', 'BECA ACTRIZ DESTACADA', 'RENOVACION / PROMEDIO GENERAL 5.5 O SUPERIOR', NULL, 'MOL_DVU', true, false, NULL),
    ('2027-01', '1752', 'Beca Funcionarios Sindicalizados Hijos y Conyuges', 'SIN REQUISITO DE NOTAS', NULL, 'MOL_DVU', true, false, NULL),
    ('2027-01', '1753', 'Beca Docente UNIACC', 'SIN REQUISITO DE NOTAS', NULL, 'MOL_DVU', true, false, NULL),
    ('2027-01', '2019', 'RESOLUCION NICOLAS OLIVERA PELEGRI', 'SIN REQUISITO DE NOTAS', NULL, 'MOL_DVU', true, false, NULL),
    ('2027-01', '89', 'SINDICATO BANCOESTADO', NULL, 'SI (CERTIFICADO ANTIGUEDAD LABORAL ACTUALIZADO)', 'CONVENIO', true, true, 'ANTIGUEDAD_LABORAL'),
    ('2027-01', '749', 'Convenio Carabineros de Chile', NULL, 'SI (CERTIFICADO ANTIGUEDAD LABORAL ACTUALIZADO)', 'CONVENIO', true, true, 'ANTIGUEDAD_LABORAL'),
    ('2027-01', '1552', 'CAJA LOS ANDES', NULL, 'SI (CERTIFICADO AFILIACION ACTUALIZADO)', 'CONVENIO', true, true, 'AFILIACION'),
    ('2027-01', '1565', 'CAJA LA ARAUCANA', NULL, 'SI (CERTIFICADO AFILIACION ACTUALIZADO)', 'CONVENIO', true, true, 'AFILIACION'),
    ('2027-01', '1801', 'DESCUENTO PAGO CHEQUE MNP', 'DESCUENTO POR FORMA DE PAGO', NULL, 'FORMA_PAGO', true, false, NULL),
    ('2027-01', '1829', 'Descuento pago contado', 'DESCUENTO POR FORMA DE PAGO', NULL, 'FORMA_PAGO', true, false, NULL),
    ('2027-01', '1855', 'Descuento Forma de Pago Multiple Total', 'DESCUENTO POR FORMA DE PAGO', NULL, 'FORMA_PAGO', true, false, NULL),
    ('2027-01', '1657', 'Beneficio Complementario un periodo Antiguos', 'BENEFICIO NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '1665', 'Anticipacion de Matricula Antiguos', 'BENEFICIO NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '1760', 'MC ASIGNATURAS EN UN SEMESTRE', 'NO ES BECA/NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '1790', 'DESCUENTO ANTICIPACION COLEGIATURA NUEVO', 'BENEFICIO NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '1791', 'DESCUENTO ANTICIPACION MATRICULA NUEVO', 'BENEFICIO NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '1806', 'Descuento Arancel Matricula TLU', 'BENEFICIO NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '1807', 'Ajuste Plan de Pago Antiguos', 'NO ES BECA/NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '1811', 'Beneficio Apoyo UNIACC No Renovable', 'BENEFICIO NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '1812', 'MC 1 ASIG EN CADA SEMESTRE', 'NO ES BECA/NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '1813', 'MC HASTA 4 ASIG DISTRIBUIDAS EN 2 SEMESTRES', 'NO ES BECA/NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '1820', 'MENOR CARGA ACADEMICA TLU', 'NO ES BECA/NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '1825', 'BECA INTERCAMBIO ARANCEL', 'NO ES BECA/NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '1826', 'BECA INTERCAMBIO MATRICULA', 'BENEFICIO NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '1831', 'RESOLUCION CAMBIO CARRERA JORNADA', 'NO ES BECA/NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '1832', 'RESOLUCION CAMBIO CARRERA JORNADA MAT', 'NO ES BECA/NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '1853', 'Ajuste Arancel 2022 BTV1 No Renovable', 'NO ES BECA/NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '2003', 'Matricula costo 0 Campaña Reintegro', 'BENEFICIO NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '2025', 'Descuento matricula noviembre', 'BENEFICIO NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '2028', 'Descuento matricula diciembre', 'BENEFICIO NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '2031', 'Descuento matricula BTU 1 referido', 'BENEFICIO NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '2032', 'Descuento matricula BTU 2 o mas referidos', 'BENEFICIO NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '2034', 'BECA RETENCION PRIMER AÑO', 'BENEFICIO NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '2035', 'Beca Rectoria Arancel', 'BENEFICIO NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '2036', 'Beca Rectoria Matricula', 'BENEFICIO NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '2037', 'Matricula costo 0 Retencion', 'BENEFICIO NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '2039', 'Matricula campaña Marzo', 'BENEFICIO NO RENOVABLE', NULL, 'NO_RENOVABLE', false, false, NULL),
    ('2027-01', '1709', 'MIS BENEFICIOS AFP', NULL, 'NO VIGENTE', 'NO_VIGENTE', false, false, NULL),
    ('2027-01', '1766', 'ASOCIACION DE PILOTOS DE CHILE', NULL, 'NO VIGENTE', 'NO_VIGENTE', false, false, NULL),
    ('2027-01', '1773', 'ENAC Centro de Formacion Tecnica', NULL, 'NO VIGENTE', 'NO_VIGENTE', false, false, NULL),
    ('2027-01', '1775', 'INJUV', NULL, 'NO VIGENTE', 'NO_VIGENTE', false, false, NULL),
    ('2027-01', '2026', 'Descuento especial convenio no vigente', 'EN REVISION', NULL, 'EN_REVISION', false, false, NULL)
ON CONFLICT (periodo, codigo_beneficio) DO UPDATE
SET beneficio = EXCLUDED.beneficio,
    renovable = EXCLUDED.renovable,
    convenio = EXCLUDED.convenio,
    flujo = EXCLUDED.flujo,
    aplica = EXCLUDED.aplica,
    requiere_certificado = EXCLUDED.requiere_certificado,
    tipo_certificado = EXCLUDED.tipo_certificado;
