-- Tipo de caso para beca ministerial (solo listar; no se resuelve en MOL).

ALTER TABLE public.mnp_caso_rematricula
    DROP CONSTRAINT IF EXISTS mnp_caso_rematricula_tipo_check;

ALTER TABLE public.mnp_caso_rematricula
    ADD CONSTRAINT mnp_caso_rematricula_tipo_check
    CHECK (tipo IN (
        'CONVENIO_CERTIFICADO',
        'APODERADO_DATOS',
        'CAE_RESOLUCION',
        'ESTATAL_MINEDUC'
    ));
