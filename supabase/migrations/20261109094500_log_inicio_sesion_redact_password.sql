-- Defensa en BD: no persistir contraseñas/secretos en log_inicio_sesion.json_recibido.
-- Aplica redacción en la RPC y un trigger BEFORE INSERT/UPDATE.
-- Dev only en esta ronda; no implica deploy a prod.

CREATE OR REPLACE FUNCTION public.jsonb_redact_sensitive_keys(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_result jsonb;
  v_key text;
  v_val jsonb;
  v_obj jsonb := '{}'::jsonb;
  v_arr jsonb := '[]'::jsonb;
  v_elem jsonb;
BEGIN
  IF p_data IS NULL THEN
    RETURN NULL;
  END IF;

  IF jsonb_typeof(p_data) = 'array' THEN
    FOR v_elem IN SELECT value FROM jsonb_array_elements(p_data)
    LOOP
      v_arr := v_arr || jsonb_build_array(public.jsonb_redact_sensitive_keys(v_elem));
    END LOOP;
    RETURN v_arr;
  END IF;

  IF jsonb_typeof(p_data) <> 'object' THEN
    RETURN p_data;
  END IF;

  FOR v_key, v_val IN SELECT key, value FROM jsonb_each(p_data)
  LOOP
    IF lower(v_key) ~ '^(password|passwd|pass|pwd|clave|secret|token|authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key|client[_-]?secret)$' THEN
      CONTINUE;
    END IF;
    v_obj := v_obj || jsonb_build_object(v_key, public.jsonb_redact_sensitive_keys(v_val));
  END LOOP;

  RETURN v_obj;
END;
$$;

COMMENT ON FUNCTION public.jsonb_redact_sensitive_keys(jsonb) IS
  'Elimina claves sensibles (password, token, etc.) de un jsonb de forma recursiva.';

CREATE OR REPLACE FUNCTION public.registrar_log_inicio_sesion(
  p_auth_source text,
  p_email text DEFAULT NULL::text,
  p_usuario_local text DEFAULT NULL::text,
  p_tipo_pixarron text DEFAULT NULL::text,
  p_mv_usuario_id uuid DEFAULT NULL::uuid,
  p_url_origen text DEFAULT NULL::text,
  p_exitoso boolean DEFAULT true,
  p_mensaje_error text DEFAULT NULL::text,
  p_origen_peticion integer DEFAULT NULL::integer,
  p_json_recibido jsonb DEFAULT NULL::jsonb,
  p_ambiente integer DEFAULT NULL::integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_local text := nullif(trim(coalesce(p_usuario_local, '')), '');
  v_msg text := nullif(trim(coalesce(p_mensaje_error, '')), '');
  v_json jsonb := public.jsonb_redact_sensitive_keys(p_json_recibido);
BEGIN
  IF p_auth_source IS NULL OR p_auth_source NOT IN ('mv_ldap', 'pixarron', 'validacion', 'supabase') THEN
    RAISE EXCEPTION 'auth_source inválido';
  END IF;

  IF p_exitoso THEN
    IF v_email IS NULL OR v_local IS NULL THEN
      RAISE EXCEPTION 'email y usuario_local requeridos si exitoso';
    END IF;
    IF v_msg IS NOT NULL THEN
      RAISE EXCEPTION 'mensaje_error debe ser null si exitoso';
    END IF;
  ELSE
    IF v_email IS NULL AND v_local IS NULL THEN
      RAISE EXCEPTION 'se requiere email o usuario_local en intento fallido';
    END IF;
    IF v_msg IS NULL THEN
      RAISE EXCEPTION 'mensaje_error requerido si no exitoso';
    END IF;
    IF length(v_msg) > 1024 THEN
      RAISE EXCEPTION 'mensaje_error demasiado largo';
    END IF;
  END IF;

  IF v_email IS NOT NULL AND length(v_email) > 512 THEN
    RAISE EXCEPTION 'longitud email excedida';
  END IF;
  IF v_local IS NOT NULL AND length(v_local) > 512 THEN
    RAISE EXCEPTION 'longitud usuario_local excedida';
  END IF;
  IF p_tipo_pixarron IS NOT NULL AND length(p_tipo_pixarron) > 256 THEN
    RAISE EXCEPTION 'tipo_pixarron demasiado largo';
  END IF;
  IF p_url_origen IS NOT NULL AND length(p_url_origen) > 2048 THEN
    RAISE EXCEPTION 'url_origen demasiado larga';
  END IF;

  INSERT INTO public.log_inicio_sesion (
    email,
    usuario_local,
    auth_source,
    tipo_pixarron,
    mv_usuario_id,
    url_origen,
    exitoso,
    mensaje_error,
    origen_peticion,
    json_recibido,
    ambiente
  )
  VALUES (
    v_email,
    v_local,
    p_auth_source,
    CASE WHEN p_exitoso THEN nullif(trim(p_tipo_pixarron), '') ELSE NULL END,
    CASE WHEN p_exitoso THEN p_mv_usuario_id ELSE NULL END,
    nullif(trim(coalesce(p_url_origen, '')), ''),
    p_exitoso,
    CASE WHEN p_exitoso THEN NULL ELSE v_msg END,
    p_origen_peticion,
    v_json,
    p_ambiente
  );
END;
$$;

COMMENT ON FUNCTION public.registrar_log_inicio_sesion(text, text, text, text, uuid, text, boolean, text, integer, jsonb, integer) IS
  'Inserta intento de sesión; redacta claves sensibles de p_json_recibido antes de persistir.';

GRANT EXECUTE ON FUNCTION public.registrar_log_inicio_sesion(text, text, text, text, uuid, text, boolean, text, integer, jsonb, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.registrar_log_inicio_sesion(text, text, text, text, uuid, text, boolean, text, integer, jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.jsonb_redact_sensitive_keys(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.jsonb_redact_sensitive_keys(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_log_inicio_sesion_redact_json()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.json_recibido := public.jsonb_redact_sensitive_keys(NEW.json_recibido);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_inicio_sesion_redact_json ON public.log_inicio_sesion;
CREATE TRIGGER trg_log_inicio_sesion_redact_json
  BEFORE INSERT OR UPDATE OF json_recibido ON public.log_inicio_sesion
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_log_inicio_sesion_redact_json();

COMMENT ON TRIGGER trg_log_inicio_sesion_redact_json ON public.log_inicio_sesion IS
  'Defensa: elimina password/secretos de json_recibido antes de INSERT/UPDATE.';
