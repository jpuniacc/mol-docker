-- TyC rechazado entra a la bandeja; el ítem de menú pasa a Rematrícula (junto a Firma/Matriculados).

ALTER TABLE public.mnp_caso_rematricula
    DROP CONSTRAINT IF EXISTS mnp_caso_rematricula_tipo_check;

ALTER TABLE public.mnp_caso_rematricula
    ADD CONSTRAINT mnp_caso_rematricula_tipo_check
    CHECK (tipo IN (
        'CONVENIO_CERTIFICADO',
        'APODERADO_DATOS',
        'CAE_RESOLUCION',
        'ESTATAL_MINEDUC',
        'TYC_RECHAZO'
    ));

UPDATE public.bo_menu_item
SET
    parent_id = 'b0000001-0001-4000-8000-000000000020',
    label = 'Casos rematrícula',
    icon_key = 'Inbox',
    orden = 25,
    activo = true
WHERE id = 'b0000001-0001-4000-8000-000000000040';

INSERT INTO public.bo_menu_item_grupo (menu_item_id, codigo_grupo)
VALUES ('b0000001-0001-4000-8000-000000000040', 1)
ON CONFLICT (menu_item_id, codigo_grupo) DO NOTHING;
