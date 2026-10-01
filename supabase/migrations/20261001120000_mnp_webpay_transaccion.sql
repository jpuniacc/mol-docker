CREATE SEQUENCE IF NOT EXISTS public.mnp_webpay_transaccion_correlativo_seq AS bigint;

CREATE TABLE IF NOT EXISTS public.mnp_webpay_transaccion (
  buy_order text PRIMARY KEY,
  session_id text NOT NULL,
  concepto text NOT NULL,
  codcli text NOT NULL,
  anio_periodo integer NOT NULL,
  semestre_periodo integer NOT NULL,
  correlativo bigint NOT NULL UNIQUE,
  monto integer NOT NULL,
  token text,
  estado text NOT NULL,
  authorization_code text,
  response_code integer,
  payment_type_code text,
  card_last4 text,
  transaction_date timestamptz,
  ambiente text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mnp_webpay_concepto_chk CHECK (concepto IN ('matricula', 'arancel')),
  CONSTRAINT mnp_webpay_estado_chk CHECK (estado IN ('creada', 'autorizada', 'rechazada', 'abortada')),
  CONSTRAINT mnp_webpay_periodo_chk CHECK (semestre_periodo IN (1, 2)),
  CONSTRAINT mnp_webpay_monto_chk CHECK (monto > 0),
  CONSTRAINT mnp_webpay_ambiente_chk CHECK (ambiente IN ('integracion', 'produccion'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mnp_webpay_token
  ON public.mnp_webpay_transaccion (token)
  WHERE token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mnp_webpay_alumno
  ON public.mnp_webpay_transaccion (codcli, anio_periodo, semestre_periodo, concepto, estado);

ALTER TABLE public.mnp_webpay_transaccion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mnp_webpay_no_anon ON public.mnp_webpay_transaccion;
CREATE POLICY mnp_webpay_no_anon ON public.mnp_webpay_transaccion
  FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS mnp_webpay_no_auth ON public.mnp_webpay_transaccion;
CREATE POLICY mnp_webpay_no_auth ON public.mnp_webpay_transaccion
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

GRANT SELECT, INSERT, UPDATE ON public.mnp_webpay_transaccion TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.mnp_webpay_transaccion_correlativo_seq TO service_role;
