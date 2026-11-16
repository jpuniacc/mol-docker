-- Instante en que el cobro Webpay quedó grabado en U+ vía sp_mol_grabar_plan_pagos.
-- Distinto de transaction_date (Transbank) y de FECREG día de caja en ERP.
ALTER TABLE public.mnp_webpay_transaccion
  ADD COLUMN IF NOT EXISTS grabado_en timestamptz NULL;

COMMENT ON COLUMN public.mnp_webpay_transaccion.grabado_en IS
  'Timestamp MOL cuando el plan de pagos escribió este cobro en U+';
