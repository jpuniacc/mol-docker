-- Tablas de admisión (uniacc-api) en schema public para exponerlas vía PostgREST / supabase-js.
-- Convive con mv_usuario, mnp_datos_alumnos, etc. Prefijo mv_* / gestorfirma_* evita choques de nombres.
-- public.mv_matriculados_sync está en la migración siguiente (20260421120001_*).

CREATE OR REPLACE FUNCTION public.uniacc_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Postulantes (sync desde SQL Server MT_INTERE)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mv_postulantes_sync (
  codint TEXT PRIMARY KEY,
  rut TEXT,
  digito TEXT,
  nombre TEXT,
  paterno TEXT,
  materno TEXT,
  sexo TEXT,
  fecnac TIMESTAMP,
  estadocivil TEXT,
  nacionalidad TEXT,
  paisorigen TEXT,
  direccion TEXT,
  ciudad TEXT,
  comuna TEXT,
  telefono TEXT,
  celular TEXT,
  email TEXT,
  codcol TEXT,
  nombrecol TEXT,
  comunacolegio TEXT,
  notaem TEXT,
  anoegreso TEXT,
  carrint1 TEXT,
  carrint2 TEXT,
  carrint3 TEXT,
  carrint4 TEXT,
  carrint5 TEXT,
  nombre_c TEXT,
  nombre_c2 TEXT,
  nombre_c3 TEXT,
  nombre_c4 TEXT,
  nombre_c5 TEXT,
  ano TEXT,
  periodo TEXT,
  fecreg TIMESTAMP,
  fecmod TIMESTAMP,
  usuario TEXT,
  observac1 TEXT,
  observac2 TEXT,
  observac3 TEXT,
  observac4 TEXT,
  observac5 TEXT,
  codmedio TEXT,
  viaconsulta TEXT,
  sede TEXT,
  jornadacarrer TEXT,
  passaporte TEXT,
  fecemisionpa TIMESTAMP,
  fecvenpa TIMESTAMP,
  tipovisa TEXT,
  coldep TEXT,
  post_fuas TEXT,
  post_gratuidad TEXT,
  discapacidad TEXT,
  etnia_indigena TEXT,
  tipodocumento TEXT,
  codmotivo TEXT,
  paisextranjero TEXT,
  es_extranjero TEXT,
  establecimiento TEXT,
  especialidad TEXT,
  postulacion TEXT,
  estados JSONB DEFAULT '[]'::jsonb,
  es_vigente BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sync_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_uniacc_mv_postulantes_sync_rut ON public.mv_postulantes_sync (rut);
CREATE INDEX IF NOT EXISTS idx_uniacc_mv_postulantes_sync_fecreg ON public.mv_postulantes_sync (fecreg);
CREATE INDEX IF NOT EXISTS idx_uniacc_mv_postulantes_sync_ano ON public.mv_postulantes_sync (ano);
CREATE INDEX IF NOT EXISTS idx_uniacc_mv_postulantes_sync_postulacion ON public.mv_postulantes_sync (postulacion);
CREATE INDEX IF NOT EXISTS idx_uniacc_mv_postulantes_sync_carrint1 ON public.mv_postulantes_sync (carrint1);
CREATE INDEX IF NOT EXISTS idx_uniacc_mv_postulantes_sync_comuna ON public.mv_postulantes_sync (comuna);
CREATE INDEX IF NOT EXISTS idx_uniacc_mv_postulantes_sync_sync_ts ON public.mv_postulantes_sync (sync_timestamp);
CREATE INDEX IF NOT EXISTS idx_uniacc_mv_postulantes_sync_es_vigente ON public.mv_postulantes_sync (es_vigente);
CREATE INDEX IF NOT EXISTS idx_uniacc_mv_postulantes_sync_estados ON public.mv_postulantes_sync USING GIN (estados);

COMMENT ON TABLE public.mv_postulantes_sync IS 'Datos sincronizados desde SQL Server (MT_INTERE).';

CREATE TABLE IF NOT EXISTS public.mv_postulante_extras (
  codint TEXT PRIMARY KEY,
  desistido BOOLEAN DEFAULT false,
  fecha_desistimiento TIMESTAMP,
  estado_seguimiento TEXT
    CHECK (
      estado_seguimiento IN (
        'no_contesta',
        'pendiente_documentacion',
        'evaluando',
        'alumno_vigente'
      )
      OR estado_seguimiento IS NULL
    ),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_uniacc_postulante_extras_codint
    FOREIGN KEY (codint) REFERENCES public.mv_postulantes_sync (codint) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_uniacc_mv_postulante_extras_desistido ON public.mv_postulante_extras (desistido);
CREATE INDEX IF NOT EXISTS idx_uniacc_mv_postulante_extras_estado_seg ON public.mv_postulante_extras (estado_seguimiento);

CREATE TABLE IF NOT EXISTS public.mv_postulantes_notificados (
  codint TEXT PRIMARY KEY,
  fecha_notificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_uniacc_postulantes_notif_codint
    FOREIGN KEY (codint) REFERENCES public.mv_postulantes_sync (codint) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_uniacc_mv_postulantes_notif_fecha ON public.mv_postulantes_notificados (fecha_notificacion DESC);

CREATE TABLE IF NOT EXISTS public.mv_historial_estados_seguimiento (
  id SERIAL PRIMARY KEY,
  codint TEXT NOT NULL,
  estado_anterior TEXT,
  estado_nuevo TEXT,
  fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_uniacc_historial_codint
    FOREIGN KEY (codint) REFERENCES public.mv_postulante_extras (codint) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_uniacc_historial_codint ON public.mv_historial_estados_seguimiento (codint);
CREATE INDEX IF NOT EXISTS idx_uniacc_historial_fecha ON public.mv_historial_estados_seguimiento (fecha_cambio DESC);

DROP TRIGGER IF EXISTS tr_uniacc_mv_postulantes_sync_updated_at ON public.mv_postulantes_sync;
CREATE TRIGGER tr_uniacc_mv_postulantes_sync_updated_at
  BEFORE UPDATE ON public.mv_postulantes_sync
  FOR EACH ROW
  EXECUTE FUNCTION public.uniacc_touch_updated_at();

DROP TRIGGER IF EXISTS tr_uniacc_mv_postulante_extras_updated_at ON public.mv_postulante_extras;
CREATE TRIGGER tr_uniacc_mv_postulante_extras_updated_at
  BEFORE UPDATE ON public.mv_postulante_extras
  FOR EACH ROW
  EXECUTE FUNCTION public.uniacc_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.gestorfirma_mv_firma_acepta_sync (
  ano_mat INTEGER NOT NULL,
  periodo_mat INTEGER NOT NULL,
  codcli TEXT NOT NULL,
  estado_traspaso_umas TEXT,
  descripcion_estado_solicitud TEXT,
  rut TEXT,
  paterno TEXT,
  materno TEXT,
  nombre TEXT,
  contrato_id_documento_acepta TEXT,
  contrato_fecha_envio_acepta TIMESTAMP,
  contrato_fecha_recepcion_acepta TIMESTAMP,
  usuario_recepcion_contrato TEXT,
  mandato_id_documento_acepta TEXT,
  mandato_fecha_envio_acepta TIMESTAMP,
  mandato_fecha_recepcion_acepta TIMESTAMP,
  usuario_recepcion_mandato TEXT,
  pendiente_contrato INTEGER,
  pendiente_mandato INTEGER,
  firma_faltante TEXT,
  tipo_programa TEXT,
  cod_facultad TEXT,
  facultad TEXT,
  nombre_jornada TEXT,
  mail TEXT,
  mail_inst TEXT,
  apod_nombre TEXT,
  apod_paterno TEXT,
  apod_materno TEXT,
  apod_mail TEXT,
  apod_celular TEXT,
  contrato_ruta_documento_firmado TEXT,
  mandato_ruta_documento_firmado TEXT,
  sync_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ano_mat, periodo_mat, codcli)
);

CREATE INDEX IF NOT EXISTS idx_uniacc_gestorfirma_firma_rut ON public.gestorfirma_mv_firma_acepta_sync (rut);
CREATE INDEX IF NOT EXISTS idx_uniacc_gestorfirma_firma_ano_per ON public.gestorfirma_mv_firma_acepta_sync (ano_mat, periodo_mat);
CREATE INDEX IF NOT EXISTS idx_uniacc_gestorfirma_firma_faltante ON public.gestorfirma_mv_firma_acepta_sync (firma_faltante);
CREATE INDEX IF NOT EXISTS idx_uniacc_gestorfirma_firma_sync_ts ON public.gestorfirma_mv_firma_acepta_sync (sync_timestamp);

COMMENT ON TABLE public.gestorfirma_mv_firma_acepta_sync IS 'Sync SQL Server PROD_SGF + rutas locales PDF ACEPTA.';

CREATE TABLE IF NOT EXISTS public.gestorfirma_mv_firma_documentos_recibidos (
  id SERIAL PRIMARY KEY,
  ano_mat INTEGER NOT NULL,
  periodo_mat INTEGER NOT NULL,
  codcli TEXT NOT NULL,
  rut TEXT NOT NULL,
  tipo_documento TEXT NOT NULL,
  id_documento_acepta TEXT NOT NULL,
  ruta_documento_firmado TEXT,
  fecha_recepcion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (ano_mat, periodo_mat, codcli, tipo_documento)
);

CREATE INDEX IF NOT EXISTS idx_uniacc_gestorfirma_docs_rut ON public.gestorfirma_mv_firma_documentos_recibidos (rut);
CREATE INDEX IF NOT EXISTS idx_uniacc_gestorfirma_docs_codcli ON public.gestorfirma_mv_firma_documentos_recibidos (codcli);
CREATE INDEX IF NOT EXISTS idx_uniacc_gestorfirma_docs_fecha ON public.gestorfirma_mv_firma_documentos_recibidos (fecha_recepcion);

COMMENT ON TABLE public.gestorfirma_mv_firma_documentos_recibidos IS 'PDFs firmados desde API ACEPTA (no se trunca en sync).';
