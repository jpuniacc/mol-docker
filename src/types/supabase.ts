/** Fila de `mv_usuario` (alineada al DDL en Postgres). */
export type MvUsuarioRow = {
  id: string;
  nombre_usuario: string;
  apellido_usuario: string;
  email: string;
  telefono: string;
  codigo_estado_usuario: number;
  codigo_perfil_usuario: number;
  codigo_grupo: number;
  updated_at: string | null;
  rut_modifica_usuario: string | null;
};

/** `auth_source` en BD: ver migración y CHECK. */
export type LogAuthSource = "mv_ldap" | "pixarron" | "validacion" | "supabase";

/** Auditoría de intentos de sesión (`log_inicio_sesion`). */
export type LogInicioSesionRow = {
  id: string;
  creado_en: string;
  email: string | null;
  usuario_local: string | null;
  auth_source: string;
  tipo_pixarron: string | null;
  mv_usuario_id: string | null;
  url_origen: string | null;
  exitoso: boolean;
  mensaje_error: string | null;
};

/** Fila de `mnp_datos_alumnos` (integración ERP → Postgres). */
export type MnpDatosAlumnosRow = {
  email_personal: string | null;
  email_institucional: string | null;
  telefono_actual: string | null;
  telefono_proceso: string | null;
  rut_apoderado: string | null;
  nombre_apoderado: string | null;
  nombre_alumno: string | null;
  rut_alumno: string | null;
  codcli: string | null;
  anio_ingreso_institucion: number | null;
  tipo_carrera: string | null;
  nombre_social: string | null;
  fecha_nacimiento: string | null;
  nombre_facultad: string | null;
  nombre_escuela: string | null;
  codigo_carrera: string | null;
  nombre_carrera: string | null;
  codigo_plan: string | null;
  nombre_plan: string | null;
  duracion_carrera: number | null;
  jornada_carrera: string | null;
  nivel_alumno: string | null;
  ne: string | null;
  anio_egreso_nem: string | null;
  paa_puntaje_verbal: number | null;
  paa_puntaje_matematica: number | null;
  paa_puntaje_historia: number | null;
  psu_puntaje_verbal: number | null;
  psu_puntaje_matematica: number | null;
  psu_puntaje_historia: number | null;
  tipo_prueba: string | null;
  promedio_prueba: number | null;
  estado_academico: string | null;
  genero: string | null;
  direccion: string | null;
  comuna: string | null;
  ciudad: string | null;
  region: string | null;
  nacionalidad: string | null;
  estado_civil: string | null;
  ultima_matricula: string | null;
  advance: string | null;
  fecha_corte: string | null;
  tiene_discapacidad: string | null;
  descripcion_discapacidad: string | null;
  synced_at: string;
};

/** Fila de `mnp_informacion_finanzas` (cuotas y montos; sync ERP). */
export type MnpInformacionFinanzasRow = {
  codcli: string | null;
  nombre_carrera: string | null;
  nombre_area: string | null;
  modalidad: string | null;
  periodo: string | null;
  rut: string | null;
  nombre_alumno: string | null;
  rut_apoder: string | null;
  nombre_apoderado: string | null;
  mat_primer_ano: string | null;
  monto_matricula: number | null;
  monto_arancel: number | null;
  cuota_matricula: number | null;
  cuota_arancel: number | null;
  desc_matricula: number | null;
  desc_arancel: number | null;
  beca_matricula: number | null;
  beca_arancel: number | null;
  valor_total_matricula: number | null;
  valor_total_arancel: number | null;
  pagos_por_mora: number | null;
  cuotas_matricula_vencidas: number | null;
  monto_matricula_vencidas: number | null;
  monto_arancel_vencidas: number | null;
  monto_matricula_por_vencer: number | null;
  monto_arancel_por_vencer: number | null;
  fecha_corte: string | null;
  synced_at: string;
};

/** Catálogo ERP de tipos de pago (`tp_tipo_pago`). */
export type TpTipoPagoRow = {
  id: number;
  codigo_tipo_pago: number;
  descripcion_tipo_pago: string;
  created_at: string;
};

/** Catálogo ERP de convenios (`tp_convenio`). */
export type TpConvenioRow = {
  id: number;
  codigo_convenio: number;
  descripcion_convenio: string;
  concepto: 'MATRICULA' | 'ARANCEL' | 'AMBOS';
  tipo_descuento: 'PORCENTAJE' | 'MONTO';
  valor_descuento: number;
  activo: boolean;
  created_at: string;
};

/** Convenio institucional MNP (`tp_mnp_convenio`). */
export type TpMnpConvenioRow = {
  id: string;
  codigo_beneficio: string | null;
  institucion: string;
  beneficiarios: string | null;
  estado: 'VIGENTE' | 'EN_TRAMITE' | 'NO_VIGENTE';
  obs_1: string | null;
  obs_2: string | null;
  concepto: 'MATRICULA' | 'ARANCEL' | 'AMBOS';
  activo: boolean;
  created_at: string;
  updated_at: string;
};

/** Descuento por oferta (`tp_mnp_convenio_descuento`). */
export type TpMnpConvenioDescuentoRow = {
  id: string;
  convenio_id: string;
  oferta_codigo: string;
  aplica: boolean;
  porcentaje: number | null;
};

/** Vigencia por periodo (`tp_mnp_convenio_periodo`). */
export type TpMnpConvenioPeriodoRow = {
  id: string;
  convenio_id: string;
  anio_periodo: number;
  semestre_periodo: number;
  activo: boolean;
};

/** Documento de vigencia de convenio subido por el alumno (`mnp_convenio_documento`). */
export type MnpConvenioDocumentoRow = {
  id: string;
  creado_en: string;
  convenio_id: string | null;
  codigo_beneficio: string | null;
  cod_beneficio_alumno: string | null;
  estado_convenio: string | null;
  storage_bucket: string;
  storage_path: string;
  nombre_archivo: string | null;
  mime: string | null;
  tamano_bytes: number | null;
  sesion_id: string | null;
  rut_alumno: string | null;
  codcli: string | null;
  nombre_alumno: string | null;
  anio_periodo: number | null;
  semestre_periodo: number | null;
  periodo_label: string | null;
  url_origen: string | null;
  es_mock: boolean;
  eliminado_en: string | null;
};

/** Fila de `tp_periodo_activo` (periodo académico de rematrícula). */
export type TpPeriodoActivoRow = {
  id: number;
  anio_periodo: number;
  semestre_periodo: number;
  created_at: string;
  estado: boolean;
};

/** Ambiente SQL Server para SP on-demand (`tp_mnp_erp_sp_ambiente`). */
export type TpMnpErpSpAmbienteRow = {
  id: number;
  ambiente: 'prod' | 'test';
  label: string;
  estado: boolean;
  created_at: string;
  updated_at: string;
};

/** Fila de `tp_terminos_condiciones` (TyC MOL rich text). */
export type TpTerminosCondicionesRow = {
  id: number;
  codigo: string;
  titulo: string;
  contenido_html: string;
  created_at: string;
  updated_at: string;
};

/** Configuración OTP contacto (`tp_contacto_otp_config`). */
export type TpContactoOtpConfigRow = {
  id: number;
  codigo: string;
  otp_email_segundos: number;
  otp_sms_segundos: number;
  otp_email_reintento_segundos: number;
  otp_sms_reintento_segundos: number;
  updated_at: string;
};

/** Fila de `log_sesion_usuario` (duración de sesión). */
export type LogSesionUsuarioRow = {
  id: string;
  inicio_en: string;
  fin_en: string | null;
  duracion_segundos: number | null;
  motivo_cierre: 'logout' | 'beacon' | 'timeout' | null;
  email: string | null;
  usuario_local: string | null;
  auth_source: string | null;
  mv_usuario_id: string | null;
  url_origen: string | null;
  user_agent: string | null;
};

/** Fila de `log_mol_tyc_respuesta` (aceptación/rechazo TyC por alumno). */
export type LogMolTycRespuestaRow = {
  id: string;
  creado_en: string;
  accion: 'acepta' | 'rechaza';
  codigo_tyc: string;
  tyc_updated_at: string;
  tyc_titulo: string;
  rut_alumno: string | null;
  codcli: string | null;
  nombre_alumno: string | null;
  anio_periodo: number | null;
  semestre_periodo: number | null;
  periodo_label: string | null;
  url_origen: string | null;
  es_mock: boolean;
  sesion_id: string | null;
};

/** Fila de `log_mol_contacto_otp` (eventos OTP contacto). */
export type LogMolContactoOtpRow = {
  id: string;
  creado_en: string;
  canal: 'correo' | 'telefono';
  evento: 'envio' | 'reenvio' | 'verificar_ok' | 'verificar_fallido' | 'continuar_sin_otp';
  numero_envio: number | null;
  contacto_mascara: string | null;
  rut_alumno: string | null;
  codcli: string | null;
  nombre_alumno: string | null;
  anio_periodo: number | null;
  semestre_periodo: number | null;
  periodo_label: string | null;
  url_origen: string | null;
  es_mock: boolean;
  sesion_id: string | null;
};

/** Fila de `log_mol_evento` (timeline unificado MOL). */
export type LogMolEventoRow = {
  id: string;
  creado_en: string;
  sesion_id: string | null;
  categoria: string;
  accion: string;
  origen_tabla: string | null;
  origen_id: string | null;
  payload: Record<string, unknown> | null;
  rut_alumno: string | null;
  codcli: string | null;
  nombre_alumno: string | null;
  anio_periodo: number | null;
  semestre_periodo: number | null;
  periodo_label: string | null;
  url_origen: string | null;
  es_mock: boolean;
};

/** Fila de `v_log_mol_sesion_timeline` (timeline con hora Chile). */
export type VLogMolSesionTimelineRow = {
  id: string;
  sesion_id: string | null;
  categoria: string;
  accion: string;
  creado_en: string;
  creado_en_santiago: string;
  creado_en_chile_txt: string;
  rut_alumno: string | null;
  codcli: string | null;
  nombre_alumno: string | null;
  es_mock: boolean;
  payload: Record<string, unknown> | null;
  origen_tabla: string | null;
  origen_id: string | null;
  anio_periodo: number | null;
  semestre_periodo: number | null;
  periodo_label: string | null;
  url_origen: string | null;
};

/** Fila de `mnp_discapacidad_encuesta` (respuestas encuesta discapacidad MOL). */
export type MnpDiscapacidadEncuestaRow = {
  id: string;
  creado_en: string;
  contesta: boolean;
  tipo_discapacidad: string | null;
  afirmaciones: string[] | null;
  sesion_id: string | null;
  rut_alumno: string | null;
  codcli: string | null;
  nombre_alumno: string | null;
  anio_periodo: number | null;
  semestre_periodo: number | null;
  periodo_label: string | null;
  url_origen: string | null;
  es_mock: boolean;
};

/** Fila de `mnp_resolucion_cae` (resolución CAE por periodo). */
export type MnpResolucionCaeRow = {
  id: string;
  codcli: string;
  anio_periodo: number;
  semestre_periodo: number;
  resolucion_disponible: boolean;
  estado_cae: string | null;
  creado_en: string;
  actualizado_en: string;
};

/** Fila de `mnp_verificacion_cae_mol` (historial verificación CAE MOL). */
export type MnpVerificacionCaeMolRow = {
  id: string;
  creado_en: string;
  resultado: 'continua' | 'pendiente_resolucion';
  sesion_id: string | null;
  rut_alumno: string | null;
  codcli: string | null;
  nombre_alumno: string | null;
  anio_periodo: number | null;
  semestre_periodo: number | null;
  periodo_label: string | null;
  url_origen: string | null;
  es_mock: boolean;
};

/** Ítem en `beneficios_detalle` (vista `v_mnp_mv_plan_pagos`). */
export type PlanPagosMvBeneficioDetalle = {
  cod_beneficio: string | null;
  descripcion: string | null;
  monto: number | null;
  monto_aprobado?: number | null;
  monto_solicitado?: number | null;
  porc_apr: number | null;
  porc_sol?: number | null;
  aplicable: string | null;
  estado: string | null;
};


/** Fila de `mnp_mt_arancel` (aranceles MT_ARANCEL desde ERP U+). */
export type MtArancelRow = {
  cod_carrera: string | null;
  ano: number | null;
  anio_ini: number | null;
  anio_fin: number | null;
  monto: number | null;
  fec_mod: string | null;
  fec_ini_vig: string | null;
  fec_ter_vig: string | null;
  documentos: string | null;
  cuotas: number | null;
  moneda: number | null;
  matricula: number | null;
  periodo: number | null;
  categoria_alumno: number | null;
  combo: number | null;
  jornada: string | null;
  periodo_ingreso: number | null;
  periodo_final: number | null;
  arancel_renov: number | null;
  matricula_renov: number | null;
  synced_at: string;
};

/** Fila de `tp_mnp_cae_arancel_referencia` (MT_CARRER_PAA_PSU desde ERP U+, ANO >= 2026). */
export type TpMnpCaeArancelReferenciaRow = {
  cod_carrera: string;
  periodo: number;
  ano: number;
  min_curso: number | null;
  postulantes: string | null;
  postulable: number | null;
  paga_inscripcion: string | null;
  arancel_x_asignatura: string | null;
  bloquea_vacantes: string | null;
  cupos_regulares: number | null;
  cupos_especiales: number | null;
  cupos_sobrecupos: number | null;
  vacantes: number | null;
  corte_paa: number | null;
  corte_psu: number | null;
  pnd_notem: number | null;
  nem_punt_min_paa_reg: number | null;
  nem_psu_reg: number | null;
  nem_punt_min_psu_reg: number | null;
  nem_psu_esp: number | null;
  nem_punt_min_psu_esp: number | null;
  pnd_verbal: number | null;
  pnd_matemat: number | null;
  pnd_hisgeo: number | null;
  pnd_csoc: number | null;
  pnd_mat: number | null;
  pnd_fis: number | null;
  pnd_quim: number | null;
  pnd_bio: number | null;
  verbal_punt_min_paa_reg: number | null;
  mat_punt_min_paa_reg: number | null;
  hist_punt_min_paa_reg: number | null;
  espcs_punt_min_paa_reg: number | null;
  esp_mat_punt_min_paa_reg: number | null;
  esp_fis_punt_min_paa_reg: number | null;
  esp_qui_punt_min_paa_reg: number | null;
  esp_bio_punt_min_paa_reg: number | null;
  pnd_verbal_psu: number | null;
  pnd_matemat_psu: number | null;
  pnd_hisgeo_psu: number | null;
  pnd_fis_psu: number | null;
  pnd_quim_psu: number | null;
  pnd_bio_psu: number | null;
  verbal_punt_min_psu_reg: number | null;
  mat_punt_min_psu_reg: number | null;
  hist_punt_min_psu_reg: number | null;
  esp_fis_punt_min_psu_reg: number | null;
  esp_qui_punt_min_psu_reg: number | null;
  esp_bio_punt_min_psu_reg: number | null;
  verbal_psu_esp: number | null;
  mat_psu_esp: number | null;
  hist_psu_esp: number | null;
  esp_fis_psu_esp: number | null;
  esp_qui_psu_esp: number | null;
  esp_bio_psu_esp: number | null;
  verbal_punt_min_psu_esp: number | null;
  mat_punt_min_psu_esp: number | null;
  hist_punt_min_psu_esp: number | null;
  esp_fis_punt_min_psu_esp: number | null;
  esp_qui_punt_min_psu_esp: number | null;
  esp_bio_punt_min_psu_esp: number | null;
  psuesp_ranking: number | null;
  psureg_ranking: number | null;
  examina_postulantes: string | null;
  psu_prom_reg: number | null;
  arancel_referencia: number | null;
  aprobacion_manual: string | null;
  visar_aa: string | null;
  supernumerarios: string | null;
  usa_plan_cuotas: string | null;
  oculta_mnpan: string | null;
  cod_erp: string | null;
  synced_at: string;
};

/** Fila de `tp_mnp_descuento_matricula_anticipada` (descuentos matrícula anticipada MNP). */
export type TpMnpDescuentoMatriculaAnticipadaRow = {
  id: number;
  cod_beneficio: number;
  nombre: string;
  periodo: string;
  vigencia_desde: string;
  vigencia_hasta: string;
  aplicable_a: 'MATRICULA' | 'ARANCEL';
  porcentaje_descuento: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

/** Fila de `mnp_mt_beneficio` (catálogo MT_BENEFICIO desde ERP U+, Vigencia = Si). */
export type MtBeneficioRow = {
  cod_beneficio: number | null;
  descripcion: string | null;
  porcmax: number | null;
  montomax: number | null;
  tipo: string | null;
  aplicable: number | null;
  usuario: number | null;
  fec_mod: string | null;
  apliconcepto: string | null;
  automatico: string | null;
  matricula: string | null;
  benpaa: string | null;
  formapago: number | null;
  aplical: string | null;
  ano: number | null;
  exclusivo: string | null;
  prioridad: number | null;
  codsede: string | null;
  tipocarr: string | null;
  variable: string | null;
  benpromo: string | null;
  bencarrera: string | null;
  anos_duracion: number | null;
  categoria: number | null;
  cupos: number | null;
  ano_egreso_desde: number | null;
  ano_egreso_hasta: number | null;
  pagoasociado: string | null;
  origen_beneficio: string | null;
  requisito: string | null;
  fpagogenerada: number | null;
  jornada: string | null;
  clase: number | null;
  vigencia: string | null;
  codigo_mineduc: number | null;
  montocorreccion: number | null;
  omitetopebeneficios: string | null;
  tipoweb: string | null;
  escala: string | null;
  exclusion: string | null;
  personal: string | null;
  ano_beneficio: number | null;
  periodo_beneficio: number | null;
  fecha_inicial: string | null;
  fecha_final: string | null;
  monto_tope: number | null;
  benexcluyente: string | null;
  synced_at: string;
};

/** Fila de `mnp_estado_cae_alumnos` (MT_POSBEN del periodo activo). */
export type MnpEstadoCaeAlumnoRow = {
  cod_beneficio_cargado: number | null;
  orden: number | null;
  codcli: string | null;
  cod_carrera: string | null;
  ano: number | null;
  periodo: number | null;
  porc_sol: number | null;
  porc_apr: number | null;
  monto_sol: number | null;
  monto_apr: number | null;
  monto: number | null;
  aprobado: string | null;
  aplicable: number | null;
  fec_mod: string | null;
  fec_aprob: string | null;
  fec_asig: string | null;
  total_sol: number | null;
  monto_int: number | null;
  porc_int: number | null;
  fec_anulacion: string | null;
  estado: number | null;
  porc_par: number | null;
  num_operacion: number | null;
  tipo_asignacion: string | null;
  confirma_monto: string | null;
  monto_cae_aprobado: number | null;
  porc_original: number | null;
  monto_original: number | null;
  cod_beneficio: number | null;
  descripcion: string | null;
  nombre_estado_beneficio: string | null;
  anio_matricula: number | null;
  periodo_matricula: number | null;
  synced_at: string;
};

/** Fila de `v_mnp_mv_plan_pagos` (matrícula MV + plan de pago + beneficios). */
export type PlanPagosMvRow = {
  codcli: string | null;
  rut: string | null;
  nombre_alumno: string | null;
  apellido_paterno_alumno: string | null;
  apellido_materno_alumno: string | null;
  rut_apoder: string | null;
  nombre_apoderado: string | null;
  apellido_paterno_apoderado: string | null;
  apellido_materno_apoderado: string | null;
  estado_academico: string | null;
  ano_ingreso: number | null;
  periodo_ingreso: number | null;
  categoria_alumno: number | null;
  /** Código jornada ERP (AD/D/V/S) desde consolidado; param @JORNADA del SP de arancel. */
  jornada_carrera: string | null;
  cod_carrera: string | null;
  carrera: string | null;
  codigo_planestudio: string | null;
  nombre_planestudios: string | null;
  direccion: string | null;
  comuna: string | null;
  ciudad: string | null;
  mail: string | null;
  telefono: string | null;
  telefono_apoderado: string | null;
  discapacidad: string | null;
  ramos_aprobados: number | null;
  ramos_reprobados: number | null;
  ult_matricula: string | null;
  ultima_situacion?: string | null;
  periodo_rematricula?: string | null;
  prom_ultimo_periodo: number | null;
  prom_anio: number | null;
  precio_matricula: number | null;
  cuotas_matricula: number | null;
  doc_pago_matricula: string | null;
  precio_arancel: number | null;
  cuotas_arancel: number | null;
  doc_pago_arancel: string | null;
  monto_beneficio_matricula: number | null;
  monto_beneficio_arancel: number | null;
  beneficios_detalle: PlanPagosMvBeneficioDetalle[] | null;
  anio_matricula: number | null;
  periodo_matricula: number | null;
  periodo: string | null;
  synced_at: string;
  nombre_carrera: string | null;
  monto_matricula: number | null;
  monto_arancel: number | null;
  cuota_matricula: number | null;
  cuota_arancel: number | null;
  beca_matricula: number | null;
  beca_arancel: number | null;
  valor_total_matricula: number | null;
  valor_total_arancel: number | null;
  alumno_cae?: string | null;
  tiene_beneficio?: string | null;
  beneficio_ano?: number | null;
  beneficio_periodo?: number | null;
  cantidad_beneficios?: number | null;
  monto_total_beneficios?: number | null;
};

/** Ítem del menú lateral del backoffice (`bo_menu_item`). */
export type BoMenuItemRow = {
  id: string;
  parent_id: string | null;
  tipo: "link" | "group";
  label: string;
  route_name: string | null;
  icon_key: string | null;
  orden: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type BoMenuItemGrupoRow = {
  menu_item_id: string;
  codigo_grupo: number;
};

/** Usado en UI (p. ej. data-table-dropdown). */
export type MvLibroMatriculaRow = {
  id: number;
  rut_alumno: string;
  numero_matricula_alumno: number;
  nombre_completo_alumno: string;
  codigo_estado_alumno: number;
  estado_alumno?: string | null;
  fecha_retiro_escuela?: string | null;
  causa_retiro_alumno?: string | null;
  rut_usuario_modifica?: string | null;
  fecha_modificacion?: string | null;
};

export type Database = {
  public: {
    Tables: {
      mv_usuario: {
        Row: MvUsuarioRow;
        Insert: Omit<MvUsuarioRow, "id"> & { id?: string };
        Update: Partial<MvUsuarioRow>;
        Relationships: [];
      };
      mv_libro_matricula: {
        Row: MvLibroMatriculaRow;
        Insert: Partial<MvLibroMatriculaRow>;
        Update: Partial<MvLibroMatriculaRow>;
        Relationships: [];
      };
      log_inicio_sesion: {
        Row: LogInicioSesionRow;
        Insert: Omit<LogInicioSesionRow, "id" | "creado_en"> & {
          id?: string;
          creado_en?: string;
        };
        Update: Partial<LogInicioSesionRow>;
        Relationships: [];
      };
      mnp_datos_alumnos: {
        Row: MnpDatosAlumnosRow;
        Insert: Partial<MnpDatosAlumnosRow> & { synced_at?: string };
        Update: Partial<MnpDatosAlumnosRow>;
        Relationships: [];
      };
      mnp_informacion_finanzas: {
        Row: MnpInformacionFinanzasRow;
        Insert: Partial<MnpInformacionFinanzasRow> & { synced_at?: string };
        Update: Partial<MnpInformacionFinanzasRow>;
        Relationships: [];
      };
      tp_tipo_pago: {
        Row: TpTipoPagoRow;
        Insert: Omit<TpTipoPagoRow, "id" | "created_at"> & {
          id?: number;
          created_at?: string;
        };
        Update: Partial<Omit<TpTipoPagoRow, "id">>;
        Relationships: [];
      };
      tp_convenio: {
        Row: TpConvenioRow;
        Insert: Omit<TpConvenioRow, "id" | "created_at"> & {
          id?: number;
          created_at?: string;
        };
        Update: Partial<Omit<TpConvenioRow, "id">>;
        Relationships: [];
      };
      tp_mnp_convenio: {
        Row: TpMnpConvenioRow;
        Insert: Omit<TpMnpConvenioRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<TpMnpConvenioRow, "id">>;
        Relationships: [];
      };
      tp_mnp_convenio_descuento: {
        Row: TpMnpConvenioDescuentoRow;
        Insert: Omit<TpMnpConvenioDescuentoRow, "id"> & { id?: string };
        Update: Partial<Omit<TpMnpConvenioDescuentoRow, "id">>;
        Relationships: [];
      };
      tp_mnp_convenio_periodo: {
        Row: TpMnpConvenioPeriodoRow;
        Insert: Omit<TpMnpConvenioPeriodoRow, "id"> & { id?: string };
        Update: Partial<Omit<TpMnpConvenioPeriodoRow, "id">>;
        Relationships: [];
      };
      mnp_convenio_documento: {
        Row: MnpConvenioDocumentoRow;
        Insert: Omit<
          MnpConvenioDocumentoRow,
          "id" | "creado_en" | "storage_bucket" | "eliminado_en"
        > & {
          id?: string;
          creado_en?: string;
          storage_bucket?: string;
          eliminado_en?: string | null;
        };
        Update: Partial<Omit<MnpConvenioDocumentoRow, "id">>;
        Relationships: [];
      };
      tp_periodo_activo: {
        Row: TpPeriodoActivoRow;
        Insert: Omit<TpPeriodoActivoRow, "id" | "created_at"> & {
          id?: number;
          created_at?: string;
        };
        Update: Partial<Omit<TpPeriodoActivoRow, "id">>;
        Relationships: [];
      };
      tp_mnp_erp_sp_ambiente: {
        Row: TpMnpErpSpAmbienteRow;
        Insert: Omit<TpMnpErpSpAmbienteRow, "id" | "created_at" | "updated_at"> & {
          id?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<TpMnpErpSpAmbienteRow, "id">>;
        Relationships: [];
      };
      mnp_simulador_tipo_pago: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      mnp_simulador_convenio: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      mnp_simulador_beca_estado: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      mnp_simulador_regla: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      mnp_simulacion_plan_pago: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      mnp_simulacion_plan_pago_detalle: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      mnp_mt_arancel: {
        Row: MtArancelRow;
        Insert: Omit<MtArancelRow, "synced_at"> & { synced_at?: string };
        Update: Partial<MtArancelRow>;
        Relationships: [];
      };
      mnp_mt_beneficio: {
        Row: MtBeneficioRow;
        Insert: Omit<MtBeneficioRow, "synced_at"> & { synced_at?: string };
        Update: Partial<MtBeneficioRow>;
        Relationships: [];
      };
      mnp_estado_cae_alumnos: {
        Row: MnpEstadoCaeAlumnoRow;
        Insert: Omit<MnpEstadoCaeAlumnoRow, "synced_at"> & { synced_at?: string };
        Update: Partial<MnpEstadoCaeAlumnoRow>;
        Relationships: [];
      };
      tp_mnp_cae_arancel_referencia: {
        Row: TpMnpCaeArancelReferenciaRow;
        Insert: Omit<TpMnpCaeArancelReferenciaRow, "synced_at"> & { synced_at?: string };
        Update: Partial<TpMnpCaeArancelReferenciaRow>;
        Relationships: [];
      };
      tp_mnp_descuento_matricula_anticipada: {
        Row: TpMnpDescuentoMatriculaAnticipadaRow;
        Insert: Omit<
          TpMnpDescuentoMatriculaAnticipadaRow,
          "id" | "created_at" | "updated_at"
        > & {
          id?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<TpMnpDescuentoMatriculaAnticipadaRow, "id">>;
        Relationships: [];
      };
      bo_menu_item: {
        Row: BoMenuItemRow;
        Insert: Omit<BoMenuItemRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<BoMenuItemRow, "id">>;
        Relationships: [];
      };
      bo_menu_item_grupo: {
        Row: BoMenuItemGrupoRow;
        Insert: BoMenuItemGrupoRow;
        Update: Partial<BoMenuItemGrupoRow>;
        Relationships: [];
      };
      /** Admisión: sincronizado desde SQL Server (lectura vía supabase-js). */
      mv_postulantes_sync: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      mv_postulante_extras: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      mv_postulantes_notificados: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      mv_historial_estados_seguimiento: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      gestorfirma_mv_firma_acepta_sync: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      gestorfirma_mv_firma_documentos_recibidos: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      mv_matriculados_sync: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: {
      v_mnp_mv_plan_pagos: {
        Row: PlanPagosMvRow;
        Relationships: [];
      };
      v_log_mol_sesion_timeline: {
        Row: VLogMolSesionTimelineRow;
        Relationships: [];
      };
    };
    Functions: {
      activar_tp_periodo_activo: {
        Args: { p_id: number };
        Returns: undefined;
      };
      activar_tp_mnp_erp_sp_ambiente: {
        Args: { p_ambiente: string };
        Returns: undefined;
      };
      actualizar_estado_alumno: {
        Args: {
          p_rut: string;
          p_numero_matricula: number;
          p_codigo_estado: number;
          p_fecha_retiro: string;
          p_causa_retiro: string;
          p_rut_modificador: string;
        };
        Returns: unknown;
      };
      registrar_log_inicio_sesion: {
        Args: {
          p_auth_source: string;
          p_email?: string | null;
          p_usuario_local?: string | null;
          p_tipo_pixarron?: string | null;
          p_mv_usuario_id?: string | null;
          p_url_origen?: string | null;
          p_exitoso?: boolean;
          p_mensaje_error?: string | null;
        };
        Returns: undefined;
      };
      iniciar_log_sesion: {
        Args: {
          p_email?: string | null;
          p_usuario_local?: string | null;
          p_auth_source?: string | null;
          p_mv_usuario_id?: string | null;
          p_url_origen?: string | null;
          p_user_agent?: string | null;
        };
        Returns: string;
      };
      cerrar_log_sesion: {
        Args: {
          p_session_id: string;
          p_motivo?: string | null;
        };
        Returns: undefined;
      };
      registrar_log_mol_tyc_respuesta: {
        Args: {
          p_accion: string;
          p_codigo_tyc?: string | null;
          p_tyc_updated_at?: string | null;
          p_tyc_titulo?: string | null;
          p_rut_alumno?: string | null;
          p_codcli?: string | null;
          p_nombre_alumno?: string | null;
          p_anio_periodo?: number | null;
          p_semestre_periodo?: number | null;
          p_periodo_label?: string | null;
          p_url_origen?: string | null;
          p_es_mock?: boolean | null;
          p_sesion_id?: string | null;
        };
        Returns: undefined;
      };
      registrar_log_mol_contacto_otp: {
        Args: {
          p_canal: string;
          p_evento: string;
          p_numero_envio?: number | null;
          p_contacto_mascara?: string | null;
          p_rut_alumno?: string | null;
          p_codcli?: string | null;
          p_nombre_alumno?: string | null;
          p_anio_periodo?: number | null;
          p_semestre_periodo?: number | null;
          p_periodo_label?: string | null;
          p_url_origen?: string | null;
          p_es_mock?: boolean | null;
          p_sesion_id?: string | null;
        };
        Returns: undefined;
      };
      registrar_log_mol_evento: {
        Args: {
          p_sesion_id?: string | null;
          p_categoria?: string | null;
          p_accion?: string | null;
          p_origen_tabla?: string | null;
          p_origen_id?: string | null;
          p_payload?: Record<string, unknown> | null;
          p_rut_alumno?: string | null;
          p_codcli?: string | null;
          p_nombre_alumno?: string | null;
          p_anio_periodo?: number | null;
          p_semestre_periodo?: number | null;
          p_periodo_label?: string | null;
          p_url_origen?: string | null;
          p_es_mock?: boolean | null;
        };
        Returns: string;
      };
      guardar_mnp_discapacidad_encuesta: {
        Args: {
          p_contesta: boolean;
          p_tipo_discapacidad?: string | null;
          p_afirmaciones?: string[] | Record<string, unknown>[] | null;
          p_sesion_id?: string | null;
          p_rut_alumno?: string | null;
          p_codcli?: string | null;
          p_nombre_alumno?: string | null;
          p_anio_periodo?: number | null;
          p_semestre_periodo?: number | null;
          p_periodo_label?: string | null;
          p_url_origen?: string | null;
          p_es_mock?: boolean | null;
        };
        Returns: string;
      };
      registrar_mnp_convenio_documento: {
        Args: {
          p_storage_path: string;
          p_convenio_id?: string | null;
          p_codigo_beneficio?: string | null;
          p_cod_beneficio_alumno?: string | null;
          p_estado_convenio?: string | null;
          p_nombre_archivo?: string | null;
          p_mime?: string | null;
          p_tamano_bytes?: number | null;
          p_sesion_id?: string | null;
          p_rut_alumno?: string | null;
          p_codcli?: string | null;
          p_nombre_alumno?: string | null;
          p_anio_periodo?: number | null;
          p_semestre_periodo?: number | null;
          p_periodo_label?: string | null;
          p_url_origen?: string | null;
          p_es_mock?: boolean | null;
        };
        Returns: string;
      };
      eliminar_mnp_convenio_documento: {
        Args: {
          p_storage_path: string;
          p_sesion_id?: string | null;
          p_rut_alumno?: string | null;
          p_codcli?: string | null;
          p_nombre_alumno?: string | null;
          p_anio_periodo?: number | null;
          p_semestre_periodo?: number | null;
          p_periodo_label?: string | null;
          p_url_origen?: string | null;
          p_es_mock?: boolean | null;
        };
        Returns: number;
      };
      ejecutar_verificacion_cae_mol: {
        Args: {
          p_codcli: string;
          p_anio_periodo: number;
          p_semestre_periodo: number;
          p_sesion_id?: string | null;
          p_rut_alumno?: string | null;
          p_nombre_alumno?: string | null;
          p_periodo_label?: string | null;
          p_url_origen?: string | null;
          p_es_mock?: boolean | null;
        };
        Returns: {
          resultado: 'continua' | 'pendiente_resolucion';
          verificacion_id?: string;
          mensaje?: string;
        };
      };
      /** Stats dashboard postulantes (RPC; antes GET /api/postulantes/stats). */
      uniacc_postulantes_stats: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      uniacc_matriculados_stats: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      uniacc_marcar_desistido: {
        Args: { p_codint: string };
        Returns: undefined;
      };
      uniacc_desmarcar_desistido: {
        Args: { p_codint: string };
        Returns: undefined;
      };
      uniacc_set_estado_seguimiento: {
        Args: { p_codint: string; p_estado: string | null };
        Returns: undefined;
      };
      uniacc_matriculados_page: {
        Args: {
          p_page?: number;
          p_limit?: number;
          p_search?: string | null;
          p_tipo_alumno?: string | null;
          p_facultad?: string | null;
          p_carrera?: string | null;
          p_estado_firma?: string | null;
          p_estado_cae?: string | null;
          p_fecha_desde?: string | null;
          p_fecha_hasta?: string | null;
        };
        Returns: unknown;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
