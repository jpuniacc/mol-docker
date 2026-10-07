ALTER TABLE public.mnp_webpay_transaccion
  ADD COLUMN IF NOT EXISTS installments_number integer,
  ADD COLUMN IF NOT EXISTS respuesta jsonb;
