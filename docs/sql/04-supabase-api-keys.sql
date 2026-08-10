-- =========================================================================
-- 0. Tablas Pivot / Catálogos (Tipos)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.tp_auth_origenes (
    id integer PRIMARY KEY,
    nombre text NOT NULL UNIQUE,
    descripcion text
);

INSERT INTO public.tp_auth_origenes (id, nombre, descripcion) VALUES
(1, 'rematricula-online', 'Login desde frontend Web Rematricula'),
(2, 'whatsapp', 'Login desde Bot de Whatsapp')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.tp_auth_ambientes (
    id integer PRIMARY KEY,
    nombre text NOT NULL UNIQUE,
    descripcion text
);

INSERT INTO public.tp_auth_ambientes (id, nombre, descripcion) VALUES
(1, 'dev', 'Ambiente de Desarrollo Local'),
(2, 'qa', 'Ambiente de Certificación / Testing'),
(3, 'prod', 'Ambiente de Producción Operativa')
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- 1. Crear la tabla de clientes de API (Asociando Catálogos)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.auth_api_clientes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    origen_id integer NOT NULL REFERENCES public.tp_auth_origenes(id),
    ambiente integer NOT NULL REFERENCES public.tp_auth_ambientes(id),
    descripcion text,
    api_key_hash text NOT NULL,                   -- HASH SHA-256 de la API Key original
    es_activo boolean DEFAULT true,
    creado_en timestamp with time zone DEFAULT now(),
    UNIQUE(origen_id, ambiente)
);

-- Habilitar a Supabase Admin / Service Role para acceder a la tabla
ALTER TABLE public.auth_api_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Servicios Backend pueden leer clientes"
ON public.auth_api_clientes FOR SELECT USING (true); -- o restingir a roles específicos

-- =========================================================================
-- 2. Migración del log de auditoría
-- NOTA: Modificamos origen_peticion a integer, o creamos la columna si no existía.
-- ADVERTENCIA: Validar si la tabla public.log_inicio_sesion necesita CAST de text a int
-- =========================================================================

-- Opcional (Descomentar si origen_peticion ya existe como text y quieres forzar el int):
-- ALTER TABLE public.log_inicio_sesion 
--   ALTER COLUMN origen_peticion TYPE integer USING NULLIF(origen_peticion, '')::integer;

-- O agregar si era nueva
ALTER TABLE public.log_inicio_sesion ADD COLUMN IF NOT EXISTS ambiente integer;
ALTER TABLE public.log_inicio_sesion ADD COLUMN IF NOT EXISTS json_recibido jsonb;

-- 3. Actualizamos la Función (tomando como base la lógica que pasaste pero adaptando orígenes)
CREATE OR REPLACE FUNCTION public.registrar_log_inicio_sesion(
    p_auth_source text,
    p_email text DEFAULT NULL::text,
    p_usuario_local text DEFAULT NULL::text,
    p_tipo_pixarron text DEFAULT NULL::text,
    p_mv_usuario_id uuid DEFAULT NULL::uuid,
    p_url_origen text DEFAULT NULL::text,
    p_exitoso boolean DEFAULT true,
    p_mensaje_error text DEFAULT NULL::text,
    p_origen_peticion integer DEFAULT NULL::integer,  -- <-- ACTUALIZADO A INTEGER
    p_json_recibido jsonb DEFAULT NULL::jsonb,
    p_ambiente integer DEFAULT NULL::integer          -- <-- AÑADIDO PARA AMBIENTE (Int)
) RETURNS void
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE plpgsql
AS
$$
DECLARE
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_local text := nullif(trim(coalesce(p_usuario_local, '')), '');
  v_msg text := nullif(trim(coalesce(p_mensaje_error, '')), '');
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
    p_json_recibido,
    p_ambiente
  );
END;
$$;

COMMENT ON FUNCTION public.registrar_log_inicio_sesion(text, text, text, text, uuid, text, boolean, text, integer, jsonb, integer) IS 'Registra intento y soporta origin_peticion (integer) y ambiente (integer)';
ALTER FUNCTION public.registrar_log_inicio_sesion(text, text, text, text, uuid, text, boolean, text, integer, jsonb, integer) OWNER TO postgres;

-- 4. Creación inicial de llaves (Dummy para iniciar, debes sobreescribir el hash con las reales)
-- Ejemplo de inserción para Rematrícula en Dev:
-- INSERT INTO public.auth_api_clientes (origen_id, ambiente, descripcion, api_key_hash) 
-- VALUES (1, 1, 'Frontend Rematricula DEV', 'AQUI_TU_HASH_SHA256');
