### Task 2: Migración Postgres (tabla, RPCs, menú)

**Files:**
- Create: `supabase/migrations/20261018180000_mnp_nps_rematricula.sql`
- Modify: `src/types/supabase.ts` (fila `MnpNpsRematricula` + Functions)

**Interfaces:**
- Produces RPC:
  - `guardar_mnp_nps_rematricula(...) RETURNS uuid`
  - `estado_mnp_nps_rematricula(p_codcli text, p_anio integer, p_semestre integer) RETURNS jsonb` → `{ "respondio": boolean, "calificacion": number|null }`
- Tabla `public.mnp_nps_rematricula`
- Menú: id `b0000001-0001-4000-8000-000000000048`, route `dashboard-nps-rematricula`, label `NPS rematrícula`, icon `Star`, parent Rematrícula `...000020`, grupo DVU `1`, orden `30`

- [ ] **Step 1: Crear migración** con este contenido (ajustar solo si el linter SQL del repo exige otro estilo):

```sql
-- NPS transaccional de facilidad al finalizar rematrícula.

CREATE TABLE IF NOT EXISTS public.mnp_nps_rematricula (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creado_en timestamptz NOT NULL DEFAULT now(),
    rut_alumno text NOT NULL,
    codcli text NOT NULL,
    codigo_carrera text NOT NULL,
    jornada text NOT NULL,
    anio_periodo integer NOT NULL,
    semestre_periodo integer NOT NULL,
    periodo_label text NULL,
    calificacion smallint NOT NULL,
    comentario text NULL,
    sesion_id uuid NULL
        REFERENCES public.log_sesion_usuario (id) ON DELETE SET NULL,
    url_origen text NULL,
    CONSTRAINT mnp_nps_rematricula_calificacion_chk
        CHECK (calificacion BETWEEN 1 AND 5),
    CONSTRAINT mnp_nps_rematricula_comentario_chk
        CHECK (
            comentario IS NULL
            OR (
                length(comentario) <= 500
                AND calificacion BETWEEN 1 AND 3
            )
        ),
    CONSTRAINT mnp_nps_rematricula_codcli_periodo_uq
        UNIQUE (codcli, anio_periodo, semestre_periodo)
);

CREATE INDEX IF NOT EXISTS idx_mnp_nps_rematricula_periodo
    ON public.mnp_nps_rematricula (anio_periodo, semestre_periodo, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_mnp_nps_rematricula_calificacion
    ON public.mnp_nps_rematricula (calificacion);

COMMENT ON TABLE public.mnp_nps_rematricula IS
    'NPS transaccional de facilidad del flujo de rematrícula (1=muy difícil, 5=muy fácil).';

ALTER TABLE public.mnp_nps_rematricula ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mnp_nps_rematricula_no_select_anon ON public.mnp_nps_rematricula;
CREATE POLICY mnp_nps_rematricula_no_select_anon ON public.mnp_nps_rematricula
    FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS mnp_nps_rematricula_no_insert_anon ON public.mnp_nps_rematricula;
CREATE POLICY mnp_nps_rematricula_no_insert_anon ON public.mnp_nps_rematricula
    FOR INSERT TO anon WITH CHECK (false);

DROP POLICY IF EXISTS mnp_nps_rematricula_no_select_authenticated ON public.mnp_nps_rematricula;
CREATE POLICY mnp_nps_rematricula_no_select_authenticated ON public.mnp_nps_rematricula
    FOR SELECT TO authenticated USING (false);

DROP POLICY IF EXISTS mnp_nps_rematricula_no_insert_authenticated ON public.mnp_nps_rematricula;
CREATE POLICY mnp_nps_rematricula_no_insert_authenticated ON public.mnp_nps_rematricula
    FOR INSERT TO authenticated WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.guardar_mnp_nps_rematricula(
    p_rut_alumno text,
    p_codcli text,
    p_codigo_carrera text,
    p_jornada text,
    p_anio_periodo integer,
    p_semestre_periodo integer,
    p_calificacion integer,
    p_comentario text DEFAULT NULL,
    p_periodo_label text DEFAULT NULL,
    p_sesion_id uuid DEFAULT NULL,
    p_url_origen text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rut text := nullif(trim(coalesce(p_rut_alumno, '')), '');
    v_codcli text := nullif(trim(coalesce(p_codcli, '')), '');
    v_carrera text := nullif(trim(coalesce(p_codigo_carrera, '')), '');
    v_jornada text := nullif(trim(coalesce(p_jornada, '')), '');
    v_comentario text := nullif(trim(coalesce(p_comentario, '')), '');
    v_id uuid;
BEGIN
    IF v_rut IS NULL OR v_codcli IS NULL OR v_carrera IS NULL OR v_jornada IS NULL THEN
        RAISE EXCEPTION 'rut, codcli, codigo_carrera y jornada son obligatorios';
    END IF;
    IF p_anio_periodo IS NULL OR p_semestre_periodo IS NULL THEN
        RAISE EXCEPTION 'periodo inválido';
    END IF;
    IF p_calificacion IS NULL OR p_calificacion < 1 OR p_calificacion > 5 THEN
        RAISE EXCEPTION 'calificacion debe estar entre 1 y 5';
    END IF;
    IF p_calificacion >= 4 THEN
        v_comentario := NULL;
    ELSIF v_comentario IS NOT NULL AND length(v_comentario) > 500 THEN
        v_comentario := left(v_comentario, 500);
    END IF;
    IF p_url_origen IS NOT NULL AND length(p_url_origen) > 2048 THEN
        RAISE EXCEPTION 'url_origen demasiado larga';
    END IF;

    INSERT INTO public.mnp_nps_rematricula (
        rut_alumno, codcli, codigo_carrera, jornada,
        anio_periodo, semestre_periodo, periodo_label,
        calificacion, comentario, sesion_id, url_origen
    ) VALUES (
        v_rut, v_codcli, v_carrera, v_jornada,
        p_anio_periodo, p_semestre_periodo,
        nullif(trim(coalesce(p_periodo_label, '')), ''),
        p_calificacion, v_comentario, p_sesion_id,
        nullif(trim(coalesce(p_url_origen, '')), '')
    )
    RETURNING id INTO v_id;

    PERFORM public.registrar_log_mol_evento(
        p_sesion_id,
        'nps',
        'responde',
        'mnp_nps_rematricula',
        v_id,
        jsonb_build_object('calificacion', p_calificacion),
        v_rut,
        v_codcli,
        NULL,
        p_anio_periodo,
        p_semestre_periodo,
        p_periodo_label,
        p_url_origen,
        false
    );

    RETURN v_id;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'ya existe una respuesta NPS para este alumno y periodo';
END;
$$;

COMMENT ON FUNCTION public.guardar_mnp_nps_rematricula IS
    'Guarda NPS transaccional de rematrícula (una vez por codcli+periodo).';

GRANT EXECUTE ON FUNCTION public.guardar_mnp_nps_rematricula(
    text, text, text, text, integer, integer, integer, text, text, uuid, text
) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.estado_mnp_nps_rematricula(
    p_codcli text,
    p_anio_periodo integer,
    p_semestre_periodo integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_codcli text := nullif(trim(coalesce(p_codcli, '')), '');
    v_cal smallint;
BEGIN
    IF v_codcli IS NULL OR p_anio_periodo IS NULL OR p_semestre_periodo IS NULL THEN
        RETURN jsonb_build_object('respondio', false, 'calificacion', NULL);
    END IF;

    SELECT calificacion INTO v_cal
    FROM public.mnp_nps_rematricula
    WHERE codcli = v_codcli
      AND anio_periodo = p_anio_periodo
      AND semestre_periodo = p_semestre_periodo
    LIMIT 1;

    IF v_cal IS NULL THEN
        RETURN jsonb_build_object('respondio', false, 'calificacion', NULL);
    END IF;

    RETURN jsonb_build_object('respondio', true, 'calificacion', v_cal);
END;
$$;

GRANT EXECUTE ON FUNCTION public.estado_mnp_nps_rematricula(text, integer, integer)
    TO anon, authenticated, service_role;

INSERT INTO public.bo_menu_item (
  id, parent_id, tipo, label, route_name, icon_key, orden, activo
) VALUES (
  'b0000001-0001-4000-8000-000000000048',
  'b0000001-0001-4000-8000-000000000020',
  'link',
  'NPS rematrícula',
  'dashboard-nps-rematricula',
  'Star',
  30,
  true
) ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  tipo = EXCLUDED.tipo,
  label = EXCLUDED.label,
  route_name = EXCLUDED.route_name,
  icon_key = EXCLUDED.icon_key,
  orden = EXCLUDED.orden,
  activo = EXCLUDED.activo;

INSERT INTO public.bo_menu_item_grupo (menu_item_id, codigo_grupo)
VALUES ('b0000001-0001-4000-8000-000000000048', 1)
ON CONFLICT (menu_item_id, codigo_grupo) DO NOTHING;
```

- [ ] **Step 2: Tipar en `src/types/supabase.ts`**

Agregar interfaz fila:

```ts
export type MnpNpsRematricula = {
  id: string
  creado_en: string
  rut_alumno: string
  codcli: string
  codigo_carrera: string
  jornada: string
  anio_periodo: number
  semestre_periodo: number
  periodo_label: string | null
  calificacion: number
  comentario: string | null
  sesion_id: string | null
  url_origen: string | null
}
```

Y en `Functions` del Database tipado (mismo bloque que `guardar_mnp_discapacidad_encuesta`):

```ts
guardar_mnp_nps_rematricula: {
  Args: {
    p_rut_alumno: string
    p_codcli: string
    p_codigo_carrera: string
    p_jornada: string
    p_anio_periodo: number
    p_semestre_periodo: number
    p_calificacion: number
    p_comentario?: string | null
    p_periodo_label?: string | null
    p_sesion_id?: string | null
    p_url_origen?: string | null
  }
  Returns: string
}
estado_mnp_nps_rematricula: {
  Args: {
    p_codcli: string
    p_anio_periodo: number
    p_semestre_periodo: number
  }
  Returns: Json
}
```

- [ ] **Step 3: Aplicar migración** en el entorno local/test del equipo (comando habitual del repo; no inventar reset destructivo).

- [ ] **Step 4: Commit** (solo si el usuario lo pide)

---

