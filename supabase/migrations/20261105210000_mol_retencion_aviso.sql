-- Avisos de retención post-pago matrícula Webpay (correo 2h / SMS 24h).
-- Solo aplicar en supabase-dev hasta aprobación de prod.

CREATE TABLE IF NOT EXISTS public.mol_retencion_aviso (
  id bigserial PRIMARY KEY,
  creado_en timestamptz NOT NULL DEFAULT now(),
  codcli text NOT NULL,
  rut_alumno text,
  anio_periodo integer NOT NULL,
  semestre_periodo smallint NOT NULL,
  buy_order_matricula text,
  ventana text NOT NULL CHECK (ventana IN ('2h', '24h')),
  canal text NOT NULL CHECK (canal IN ('correo', 'sms')),
  resultado text NOT NULL DEFAULT 'enviado',
  mensaje text,
  payload jsonb,
  UNIQUE (codcli, anio_periodo, semestre_periodo, ventana, canal)
);

CREATE INDEX IF NOT EXISTS mol_retencion_aviso_periodo_idx
  ON public.mol_retencion_aviso (anio_periodo, semestre_periodo, creado_en DESC);

COMMENT ON TABLE public.mol_retencion_aviso IS
  'Log de recordatorios retención post-Webpay matrícula; evita duplicados por ventana/canal.';
