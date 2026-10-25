## Commits
c591a20 feat(rematricula): tipos discapacidad alineados a MT_DISCAPACIDAD

## Stat
 .superpowers/sdd-discapacidad/task-3-report.md     |  56 +++++++++
 src/constants/discapacidadEncuesta.ts              |   8 +-
 .../20260925120000_mnp_discapacidad_tipos_mt.sql   | 138 +++++++++++++++++++++
 3 files changed, 199 insertions(+), 3 deletions(-)

## Diff
diff --git a/src/constants/discapacidadEncuesta.ts b/src/constants/discapacidadEncuesta.ts
index 7d2b8e8..f7827a4 100644
--- a/src/constants/discapacidadEncuesta.ts
+++ b/src/constants/discapacidadEncuesta.ts
@@ -1,16 +1,18 @@
 export const DISCAPACIDAD_TIPOS = [
-  'Física',
+  'Física-Motora',
+  'Física–Visceral',
   'Visual',
   'Auditiva',
   'Psíquica',
-  'Autismo',
+  'Intelectual',
+  'Espectro del Autismo',
 ] as const
 
 export type DiscapacidadTipo = (typeof DISCAPACIDAD_TIPOS)[number]
 
 export const DISCAPACIDAD_AFIRMACIONES = [
   'Soy usuario de silla de ruedas o alguna ayuda técnica para desplazarme',
   'Soy usuario de lengua de señas',
   'Soy una persona ciega',
   'Ninguna de las anteriores',
 ] as const
@@ -30,19 +32,19 @@ export const DISCAPACIDAD_ENCUESTA_UI = {
   opcionOmitirHint: 'Puedes continuar sin registrar información de discapacidad.',
   confirmOmitirTitle: '¿Continuar sin informar?',
   confirmOmitirMessage:
     'Puedes omitir esta encuesta sin afectar tu matrícula. No se guardará tipo ni afirmaciones.',
   confirmOmitirCancel: 'Cancelar',
   confirmOmitirConfirm: 'Continuar sin informar',
   avisoIndependencia:
     'Son dos preguntas independientes. Puedes responder solo el tipo, solo las afirmaciones, o ambas. Lo que indiques en una no condiciona la otra.',
   pregunta1Titulo: '1. Tipo de discapacidad',
   pregunta1Badge: 'Obligatoria',
-  pregunta1Subtitulo: 'Clasificación según SENADIS (TyC §4.4).',
+  pregunta1Subtitulo: 'Códigos institucionales alineados a ERP (TyC §4.4).',
   pregunta2Titulo: '2. Afirmaciones',
   pregunta2Badge: 'Opcional',
   pregunta2Subtitulo:
     'Indica si te identificas con alguna de estas situaciones. No está relacionado con el tipo que elegiste arriba.',
   ctaGuardar: 'Guardar y continuar',
   ctaGuardando: 'Guardando…',
   ctaAyuda: 'Solo necesitas completar el tipo para continuar. Las afirmaciones son voluntarias.',
 } as const
diff --git a/supabase/migrations/20260925120000_mnp_discapacidad_tipos_mt.sql b/supabase/migrations/20260925120000_mnp_discapacidad_tipos_mt.sql
new file mode 100644
index 0000000..66141ee
--- /dev/null
+++ b/supabase/migrations/20260925120000_mnp_discapacidad_tipos_mt.sql
@@ -0,0 +1,138 @@
+-- Alinear tipo_discapacidad con MT_DISCAPACIDAD.CODIGO (U+), excepto Ninguna.
+
+ALTER TABLE public.mnp_discapacidad_encuesta
+    DROP CONSTRAINT IF EXISTS mnp_discapacidad_encuesta_tipo_chk;
+
+UPDATE public.mnp_discapacidad_encuesta
+SET tipo_discapacidad = 'Física-Motora'
+WHERE tipo_discapacidad = 'Física';
+
+UPDATE public.mnp_discapacidad_encuesta
+SET tipo_discapacidad = 'Espectro del Autismo'
+WHERE tipo_discapacidad = 'Autismo';
+
+ALTER TABLE public.mnp_discapacidad_encuesta
+    ADD CONSTRAINT mnp_discapacidad_encuesta_tipo_chk
+    CHECK (
+        tipo_discapacidad IS NULL
+        OR tipo_discapacidad IN (
+            'Física-Motora',
+            'Física–Visceral',
+            'Visual',
+            'Auditiva',
+            'Psíquica',
+            'Intelectual',
+            'Espectro del Autismo'
+        )
+    );
+
+CREATE OR REPLACE FUNCTION public.guardar_mnp_discapacidad_encuesta(
+    p_contesta boolean,
+    p_tipo_discapacidad text DEFAULT NULL,
+    p_afirmaciones jsonb DEFAULT NULL,
+    p_sesion_id uuid DEFAULT NULL,
+    p_rut_alumno text DEFAULT NULL,
+    p_codcli text DEFAULT NULL,
+    p_nombre_alumno text DEFAULT NULL,
+    p_anio_periodo integer DEFAULT NULL,
+    p_semestre_periodo integer DEFAULT NULL,
+    p_periodo_label text DEFAULT NULL,
+    p_url_origen text DEFAULT NULL,
+    p_es_mock boolean DEFAULT false
+)
+RETURNS uuid
+LANGUAGE plpgsql
+SECURITY DEFINER
+SET search_path = public
+AS $$
+DECLARE
+    v_contesta boolean := COALESCE(p_contesta, false);
+    v_tipo text := nullif(trim(coalesce(p_tipo_discapacidad, '')), '');
+    v_afirmaciones jsonb := p_afirmaciones;
+    v_accion text;
+    v_id uuid;
+    v_tipos_permitidos text[] := ARRAY[
+        'Física-Motora',
+        'Física–Visceral',
+        'Visual',
+        'Auditiva',
+        'Psíquica',
+        'Intelectual',
+        'Espectro del Autismo'
+    ];
+BEGIN
+    IF p_url_origen IS NOT NULL AND length(p_url_origen) > 2048 THEN
+        RAISE EXCEPTION 'url_origen demasiado larga';
+    END IF;
+
+    IF NOT v_contesta THEN
+        v_tipo := NULL;
+        v_afirmaciones := NULL;
+        v_accion := 'omitir';
+    ELSE
+        IF v_tipo IS NULL OR NOT (v_tipo = ANY (v_tipos_permitidos)) THEN
+            RAISE EXCEPTION 'tipo_discapacidad inválido o requerido';
+        END IF;
+        IF v_afirmaciones IS NOT NULL AND jsonb_typeof(v_afirmaciones) <> 'array' THEN
+            RAISE EXCEPTION 'afirmaciones debe ser un array json';
+        END IF;
+        v_accion := 'contesta';
+    END IF;
+
+    INSERT INTO public.mnp_discapacidad_encuesta (
+        contesta,
+        tipo_discapacidad,
+        afirmaciones,
+        sesion_id,
+        rut_alumno,
+        codcli,
+        nombre_alumno,
+        anio_periodo,
+        semestre_periodo,
+        periodo_label,
+        url_origen,
+        es_mock
+    )
+    VALUES (
+        v_contesta,
+        v_tipo,
+        v_afirmaciones,
+        p_sesion_id,
+        nullif(trim(coalesce(p_rut_alumno, '')), ''),
+        nullif(trim(coalesce(p_codcli, '')), ''),
+        nullif(trim(coalesce(p_nombre_alumno, '')), ''),
+        p_anio_periodo,
+        p_semestre_periodo,
+        nullif(trim(coalesce(p_periodo_label, '')), ''),
+        nullif(trim(coalesce(p_url_origen, '')), ''),
+        COALESCE(p_es_mock, false)
+    )
+    RETURNING id INTO v_id;
+
+    PERFORM public.registrar_log_mol_evento(
+        p_sesion_id,
+        'discapacidad',
+        v_accion,
+        'mnp_discapacidad_encuesta',
+        v_id,
+        jsonb_build_object('contesta', v_contesta),
+        p_rut_alumno,
+        p_codcli,
+        p_nombre_alumno,
+        p_anio_periodo,
+        p_semestre_periodo,
+        p_periodo_label,
+        p_url_origen,
+        p_es_mock
+    );
+
+    RETURN v_id;
+END;
+$$;
+
+COMMENT ON FUNCTION public.guardar_mnp_discapacidad_encuesta IS
+    'Guarda respuesta de encuesta discapacidad y registra evento mínimo en log_mol_evento.';
+
+GRANT EXECUTE ON FUNCTION public.guardar_mnp_discapacidad_encuesta(
+    boolean, text, jsonb, uuid, text, text, text, integer, integer, text, text, boolean
+) TO anon, authenticated;
