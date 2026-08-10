-- Matriculados (sync uniacc-api). Migración separada para poder crear la tabla a mano en otros entornos sin duplicar el bloque grande anterior.

CREATE TABLE IF NOT EXISTS public.mv_matriculados_sync (
  ano_mat INTEGER NOT NULL,
  periodo_mat INTEGER NOT NULL,
  codcli TEXT NOT NULL,
  codcarpr TEXT NOT NULL,
  ano_ingreso INTEGER,
  periodo_ingr INTEGER,
  mat_efectiva TEXT,
  fec_mat TEXT,
  hora_mat TEXT,
  rut TEXT,
  dig TEXT,
  nombre TEXT,
  apellido_pat TEXT,
  apellido_mat TEXT,
  carrera TEXT,
  codpestud TEXT,
  nivel TEXT,
  jornada TEXT,
  tipo_carr TEXT,
  facultad TEXT,
  estacad TEXT,
  tipositu TEXT,
  descripcion_situ TEXT,
  tipo_alumno TEXT,
  categoria TEXT,
  lista_mat DECIMAL(18, 2),
  ben_matr DECIMAL(18, 2),
  copago_mat DECIMAL(18, 2),
  documento_mat TEXT,
  lista_arancel DECIMAL(18, 2),
  ben_aran DECIMAL(18, 2),
  copago_ara DECIMAL(18, 2),
  documento_ara TEXT,
  copago_total DECIMAL(18, 2),
  cae_monto DECIMAL(18, 2),
  estado_cae TEXT,
  beca_ministerial TEXT,
  monto_beca_minesterial DECIMAL(18, 2),
  estado_beca_mine TEXT,
  deuda_morosa DECIMAL(18, 2),
  num_bol_fact TEXT,
  num_contrato TEXT,
  estado_firma TEXT,
  fonoact TEXT,
  celularact TEXT,
  mail TEXT,
  mail_inst TEXT,
  caja TEXT,
  usuario_mat TEXT,
  usuario_aprueba_post TEXT,
  rut_apod TEXT,
  dv_apod TEXT,
  nombre_apod TEXT,
  ap_paterno_apod TEXT,
  ap_materno_apod TEXT,
  telefono_apod TEXT,
  mail_apod TEXT,
  pagodoc386 DECIMAL(18, 2),
  fecha_actualizacion TIMESTAMP,
  sync_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ano_mat, periodo_mat, codcli, codcarpr)
);

CREATE INDEX IF NOT EXISTS idx_uniacc_mv_matriculados_rut ON public.mv_matriculados_sync (rut);
CREATE INDEX IF NOT EXISTS idx_uniacc_mv_matriculados_codcarpr ON public.mv_matriculados_sync (codcarpr);
CREATE INDEX IF NOT EXISTS idx_uniacc_mv_matriculados_tipo_alumno ON public.mv_matriculados_sync (tipo_alumno);
CREATE INDEX IF NOT EXISTS idx_uniacc_mv_matriculados_fec_mat ON public.mv_matriculados_sync (fec_mat);
CREATE INDEX IF NOT EXISTS idx_uniacc_mv_matriculados_facultad ON public.mv_matriculados_sync (facultad);
CREATE INDEX IF NOT EXISTS idx_uniacc_mv_matriculados_estado_firma ON public.mv_matriculados_sync (estado_firma);
CREATE INDEX IF NOT EXISTS idx_uniacc_mv_matriculados_sync_ts ON public.mv_matriculados_sync (sync_timestamp);

COMMENT ON TABLE public.mv_matriculados_sync IS 'Matriculados sincronizados desde SQL Server UNIACC.';
