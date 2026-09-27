-- Login alumno (sin fila en mv_usuario): el front consulta mnp_datos_alumnos con la anon key.
-- Sin GRANT a anon, PostgREST responde 401 Unauthorized y el login corta con
-- MSG_ACCESO_MNP_VERIFICACION_FALLIDA.

GRANT SELECT ON TABLE public.mnp_datos_alumnos TO anon;
