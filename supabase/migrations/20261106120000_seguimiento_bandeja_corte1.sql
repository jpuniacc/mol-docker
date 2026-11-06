-- Bandeja seguimiento rematrícula CORTE 1: bitácora + outbox (solo esquema) + menú.
-- Solo supabase-dev hasta OK explícito de prod.

CREATE TABLE IF NOT EXISTS public.mnp_seguimiento_contacto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codcli text NOT NULL,
  rut_norm text,
  anio_periodo integer NOT NULL,
  semestre_periodo smallint NOT NULL CHECK (semestre_periodo IN (1, 2)),
  autor_email text NOT NULL,
  canal text NOT NULL CHECK (canal IN (
    'llamada', 'whatsapp', 'correo', 'sms', 'presencial', 'sistema', 'nota'
  )),
  origen text NOT NULL CHECK (origen IN ('manual', 'auto')),
  resultado text,
  nota text,
  respuesta_alumno text,
  proxima_accion text,
  proxima_accion_en timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mnp_seguimiento_contacto_caso_idx
  ON public.mnp_seguimiento_contacto (codcli, anio_periodo, semestre_periodo, created_at DESC);

COMMENT ON TABLE public.mnp_seguimiento_contacto IS
  'Bitácora append-only de contacto staff (seguimiento rematrícula). No usar mnp_caso_rematricula.';

CREATE TABLE IF NOT EXISTS public.mnp_retencion_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rut_norm text NOT NULL,
  anio_periodo integer NOT NULL,
  semestre_periodo smallint NOT NULL CHECK (semestre_periodo IN (1, 2)),
  tipo text NOT NULL CHECK (tipo IN ('mail_2h', 'sms_24h')),
  due_at timestamptz NOT NULL,
  estado text NOT NULL CHECK (estado IN ('pendiente', 'enviado', 'cancelado', 'error')),
  sent_at timestamptz,
  provider_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rut_norm, anio_periodo, semestre_periodo, tipo)
);

CREATE INDEX IF NOT EXISTS mnp_retencion_outbox_periodo_estado_idx
  ON public.mnp_retencion_outbox (anio_periodo, semestre_periodo, estado);

COMMENT ON TABLE public.mnp_retencion_outbox IS
  'Cola retención Mail 2h / SMS 24h. CORTE 1: solo esquema/lectura; enqueue+scheduler = CORTE 2.';

GRANT SELECT, INSERT ON public.mnp_seguimiento_contacto TO service_role;
GRANT SELECT ON public.mnp_retencion_outbox TO service_role;
GRANT SELECT ON public.mnp_seguimiento_contacto TO anon, authenticated;
GRANT SELECT ON public.mnp_retencion_outbox TO anon, authenticated;

-- Menú: Seguimiento rematrícula (coexiste con Gestión Pagos / Firmas)
-- codigo_grupo = 1 (DVU), mismo patrón que Pagos/Firmas; TI ve todo el árbol.
INSERT INTO public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo)
VALUES (
  'b0000001-0001-4000-8000-000000000083',
  'b0000001-0001-4000-8000-000000000020',
  'link',
  'Seguimiento rematrícula',
  'dashboard-bandeja-seguimiento',
  'Inbox',
  26,
  true
)
ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  tipo = EXCLUDED.tipo,
  label = EXCLUDED.label,
  route_name = EXCLUDED.route_name,
  icon_key = EXCLUDED.icon_key,
  orden = EXCLUDED.orden,
  activo = true;

INSERT INTO public.bo_menu_item_grupo (menu_item_id, codigo_grupo)
VALUES ('b0000001-0001-4000-8000-000000000083', 1)
ON CONFLICT (menu_item_id, codigo_grupo) DO NOTHING;

NOTIFY pgrst, 'reload schema';
