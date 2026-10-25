# mol-docker
ed766f0 feat(rematricula): sync discapacidad a ERP al contestar encuesta
c591a20 feat(rematricula): tipos discapacidad alineados a MT_DISCAPACIDAD
d29e5ff docs(rematricula): plan sync discapacidad ERP
56c23dd docs(rematricula): diseño sync discapacidad ERP y afirmaciones en Supabase

 .../plans/2026-09-25-discapacidad-erp-sync.md      | 303 +++++++++++++++++++++
 .../2026-09-25-discapacidad-erp-sync-design.md     | 125 +++++++++
 src/constants/discapacidadEncuesta.ts              |   8 +-
 src/services/actualizarDiscapacidadMolApi.ts       |  85 ++++++
 .../MatriculaMockDiscapacidadStep.vue              |  11 +
 .../20260925120000_mnp_discapacidad_tipos_mt.sql   | 138 ++++++++++
 6 files changed, 667 insertions(+), 3 deletions(-)

diff --git a/src/constants/discapacidadEncuesta.ts b/src/constants/discapacidadEncuesta.ts
index 7d2b8e8..f7827a4 100644
--- a/src/constants/discapacidadEncuesta.ts
+++ b/src/constants/discapacidadEncuesta.ts
@@ -1,11 +1,13 @@
 export const DISCAPACIDAD_TIPOS = [
-  'Física',
+  'Física-Motora',
+  'Física–Visceral',
   'Visual',
   'Auditiva',
   'Psíquica',
-  'Autismo',
+  'Intelectual',
+  'Espectro del Autismo',
 ] as const
 
 export type DiscapacidadTipo = (typeof DISCAPACIDAD_TIPOS)[number]
 
 export const DISCAPACIDAD_AFIRMACIONES = [
@@ -35,11 +37,11 @@ export const DISCAPACIDAD_ENCUESTA_UI = {
   confirmOmitirConfirm: 'Continuar sin informar',
   avisoIndependencia:
     'Son dos preguntas independientes. Puedes responder solo el tipo, solo las afirmaciones, o ambas. Lo que indiques en una no condiciona la otra.',
   pregunta1Titulo: '1. Tipo de discapacidad',
   pregunta1Badge: 'Obligatoria',
-  pregunta1Subtitulo: 'Clasificación según SENADIS (TyC §4.4).',
+  pregunta1Subtitulo: 'Códigos institucionales alineados a ERP (TyC §4.4).',
   pregunta2Titulo: '2. Afirmaciones',
   pregunta2Badge: 'Opcional',
   pregunta2Subtitulo:
     'Indica si te identificas con alguna de estas situaciones. No está relacionado con el tipo que elegiste arriba.',
   ctaGuardar: 'Guardar y continuar',
diff --git a/src/services/actualizarDiscapacidadMolApi.ts b/src/services/actualizarDiscapacidadMolApi.ts
new file mode 100644
index 0000000..c35c132
--- /dev/null
+++ b/src/services/actualizarDiscapacidadMolApi.ts
@@ -0,0 +1,85 @@
+import { admisionApiBaseUrl } from '@/constants/admisionApi'
+
+const TIMEOUT_MS = 60_000
+
+export type ActualizarDiscapacidadMolPayload = {
+  codcli: string
+  discapacidad: string
+}
+
+export type ActualizarDiscapacidadMolResponse = {
+  ok: boolean
+  message?: string
+  error?: string
+  code?: string
+  data?: {
+    resultado: number
+    mensaje: string
+    raw?: Record<string, unknown>
+  }
+  params?: {
+    codcli: string
+    discapacidad: string
+    ambiente?: 'prod' | 'test'
+    host?: string
+  }
+  duracionMs?: number
+  syncStatus?: string
+}
+
+function apiUrl(path: string): string {
+  const base = admisionApiBaseUrl()
+  return base ? `${base}${path}` : path
+}
+
+export async function actualizarDiscapacidadMolErp(
+  payload: ActualizarDiscapacidadMolPayload,
+): Promise<ActualizarDiscapacidadMolResponse> {
+  const url = apiUrl('/api/rematricula/discapacidad/actualizar-erp')
+  const controller = new AbortController()
+  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
+
+  try {
+    const res = await fetch(url, {
+      method: 'POST',
+      headers: { 'Content-Type': 'application/json' },
+      body: JSON.stringify({
+        codcli: payload.codcli.trim(),
+        discapacidad: payload.discapacidad.trim(),
+      }),
+      signal: controller.signal,
+    })
+
+    let body: ActualizarDiscapacidadMolResponse
+    try {
+      body = (await res.json()) as ActualizarDiscapacidadMolResponse
+    } catch {
+      return {
+        ok: false,
+        error: res.ok
+          ? 'Respuesta inválida del servidor'
+          : `Error HTTP ${res.status} al actualizar discapacidad en ERP`,
+      }
+    }
+
+    if (!res.ok) {
+      return {
+        ok: false,
+        error: body.error || body.message || `Error HTTP ${res.status}`,
+        ...body,
+      }
+    }
+
+    return body
+  } catch (err) {
+    if (err instanceof Error && err.name === 'AbortError') {
+      return { ok: false, error: 'Timeout actualizando discapacidad en ERP' }
+    }
+    return {
+      ok: false,
+      error: err instanceof Error ? err.message : 'Error de red',
+    }
+  } finally {
+    clearTimeout(timer)
+  }
+}
diff --git a/src/views/matricula-mock/MatriculaMockDiscapacidadStep.vue b/src/views/matricula-mock/MatriculaMockDiscapacidadStep.vue
index 6f638c7..60e11f6 100644
--- a/src/views/matricula-mock/MatriculaMockDiscapacidadStep.vue
+++ b/src/views/matricula-mock/MatriculaMockDiscapacidadStep.vue
@@ -24,10 +24,11 @@ import { useMockAlumnoFuente } from '@/composables/useMockAlumnoFuente'
 import {
   DISCAPACIDAD_AFIRMACIONES,
   DISCAPACIDAD_ENCUESTA_UI,
   DISCAPACIDAD_TIPOS,
 } from '@/constants/discapacidadEncuesta'
+import { actualizarDiscapacidadMolErp } from '@/services/actualizarDiscapacidadMolApi'
 import { contextoMolAuditoria } from '@/services/molAuditContext'
 import { guardarDiscapacidadEncuesta } from '@/services/discapacidadEncuesta'
 import { useMockMatriculaContextStore } from '@/stores/mockMatriculaContext'
 import { usePeriodoActivoStore } from '@/stores/periodoActivo'
 
@@ -155,10 +156,20 @@ async function guardar() {
       afirmaciones: [...afirmaciones.value],
     }
     await persistirEncuesta(respuesta)
     mockCtx.setDiscapacidad(respuesta)
     toast.message('Encuesta guardada (mock). En producción se alertaría al CRM institucional.')
+    const ctx = contextoEncuesta()
+    const codcli = (ctx.codcli ?? '').trim()
+    if (codcli && respuesta.tipo) {
+      void actualizarDiscapacidadMolErp({
+        codcli,
+        discapacidad: respuesta.tipo,
+      }).then((r) => {
+        if (!r.ok) console.warn('[discapacidadErp]', r.error ?? r.message)
+      })
+    }
     void router.push({ name: 'matricula-mock-forma-pago' })
   } finally {
     guardando.value = false
   }
 }
diff --git a/supabase/migrations/20260925120000_mnp_discapacidad_tipos_mt.sql b/supabase/migrations/20260925120000_mnp_discapacidad_tipos_mt.sql
new file mode 100644
index 0000000..66141ee
--- /dev/null
+++ b/supabase/migrations/20260925120000_mnp_discapacidad_tipos_mt.sql
@@ -0,0 +1,138 @@
+-- Alinear tipo_discapacidad con MT_DISCAPACIDAD.CODIGO (U+), excepto Ninguna.
+
+ALTER TABLE public.mnp_discapacidad_encuesta
+    DROP CONSTRAINT IF EXISTS mnp_discapacidad_encuesta_tipo_chk;
+
+UPDATE public.mnp_discapacidad_encuesta
+SET tipo_discapacidad = 'Física-Motora'
+WHERE tipo_discapacidad = 'Física';
+
+UPDATE public.mnp_discapacidad_encuesta
+SET tipo_discapacidad = 'Espectro del Autismo'
+WHERE tipo_discapacidad = 'Autismo';
+
+ALTER TABLE public.mnp_discapacidad_encuesta
+    ADD CONSTRAINT mnp_discapacidad_encuesta_tipo_chk
+    CHECK (
+        tipo_discapacidad IS NULL
+        OR tipo_discapacidad IN (
+            'Física-Motora',
+            'Física–Visceral',
+            'Visual',
+            'Auditiva',
+            'Psíquica',
+            'Intelectual',
+            'Espectro del Autismo'
+        )
+    );
+
+CREATE OR REPLACE FUNCTION public.guardar_mnp_discapacidad_encuesta(
+    p_contesta boolean,
+    p_tipo_discapacidad text DEFAULT NULL,
+    p_afirmaciones jsonb DEFAULT NULL,
+    p_sesion_id uuid DEFAULT NULL,
+    p_rut_alumno text DEFAULT NULL,
+    p_codcli text DEFAULT NULL,
+    p_nombre_alumno text DEFAULT NULL,
+    p_anio_periodo integer DEFAULT NULL,
+    p_semestre_periodo integer DEFAULT NULL,
+    p_periodo_label text DEFAULT NULL,
+    p_url_origen text DEFAULT NULL,
+    p_es_mock boolean DEFAULT false
+)
+RETURNS uuid
+LANGUAGE plpgsql
+SECURITY DEFINER
+SET search_path = public
+AS $$
+DECLARE
+    v_contesta boolean := COALESCE(p_contesta, false);
+    v_tipo text := nullif(trim(coalesce(p_tipo_discapacidad, '')), '');
+    v_afirmaciones jsonb := p_afirmaciones;
+    v_accion text;
+    v_id uuid;
+    v_tipos_permitidos text[] := ARRAY[
+        'Física-Motora',
+        'Física–Visceral',
+        'Visual',
+        'Auditiva',
+        'Psíquica',
+        'Intelectual',
+        'Espectro del Autismo'
+    ];
+BEGIN
+    IF p_url_origen IS NOT NULL AND length(p_url_origen) > 2048 THEN
+        RAISE EXCEPTION 'url_origen demasiado larga';
+    END IF;
+
+    IF NOT v_contesta THEN
+        v_tipo := NULL;
+        v_afirmaciones := NULL;
+        v_accion := 'omitir';
+    ELSE
+        IF v_tipo IS NULL OR NOT (v_tipo = ANY (v_tipos_permitidos)) THEN
+            RAISE EXCEPTION 'tipo_discapacidad inválido o requerido';
+        END IF;
+        IF v_afirmaciones IS NOT NULL AND jsonb_typeof(v_afirmaciones) <> 'array' THEN
+            RAISE EXCEPTION 'afirmaciones debe ser un array json';
+        END IF;
+        v_accion := 'contesta';
+    END IF;
+
+    INSERT INTO public.mnp_discapacidad_encuesta (
+        contesta,
+        tipo_discapacidad,
+        afirmaciones,
+        sesion_id,
+        rut_alumno,
+        codcli,
+        nombre_alumno,
+        anio_periodo,
+        semestre_periodo,
+        periodo_label,
+        url_origen,
+        es_mock
+    )
+    VALUES (
+        v_contesta,
+        v_tipo,
+        v_afirmaciones,
+        p_sesion_id,
+        nullif(trim(coalesce(p_rut_alumno, '')), ''),
+        nullif(trim(coalesce(p_codcli, '')), ''),
+        nullif(trim(coalesce(p_nombre_alumno, '')), ''),
+        p_anio_periodo,
+        p_semestre_periodo,
+        nullif(trim(coalesce(p_periodo_label, '')), ''),
+        nullif(trim(coalesce(p_url_origen, '')), ''),
+        COALESCE(p_es_mock, false)
+    )
+    RETURNING id INTO v_id;
+
+    PERFORM public.registrar_log_mol_evento(
+        p_sesion_id,
+        'discapacidad',
+        v_accion,
+        'mnp_discapacidad_encuesta',
+        v_id,
+        jsonb_build_object('contesta', v_contesta),
+        p_rut_alumno,
+        p_codcli,
+        p_nombre_alumno,
+        p_anio_periodo,
+        p_semestre_periodo,
+        p_periodo_label,
+        p_url_origen,
+        p_es_mock
+    );
+
+    RETURN v_id;
+END;
+$$;
+
+COMMENT ON FUNCTION public.guardar_mnp_discapacidad_encuesta IS
+    'Guarda respuesta de encuesta discapacidad y registra evento mínimo en log_mol_evento.';
+
+GRANT EXECUTE ON FUNCTION public.guardar_mnp_discapacidad_encuesta(
+    boolean, text, jsonb, uuid, text, text, text, integer, integer, text, text, boolean
+) TO anon, authenticated;

# uniacc-api-docker
8b943ff feat(rematricula): endpoint actualizar discapacidad ERP
5d81a28 feat(rematricula): servicio SP_MOL_ACTUALIZA_DISCAPACIDAD

 .../rematricula-discapacidad.controller.ts         |  89 ++++++++++
 src/index.ts                                       |   3 +
 src/routes/rematricula-discapacidad.routes.ts      |  12 ++
 src/services/actualiza-discapacidad-mol.service.ts | 180 +++++++++++++++++++++
 4 files changed, 284 insertions(+)

diff --git a/src/controllers/rematricula-discapacidad.controller.ts b/src/controllers/rematricula-discapacidad.controller.ts
new file mode 100644
index 0000000..ddb598f
--- /dev/null
+++ b/src/controllers/rematricula-discapacidad.controller.ts
@@ -0,0 +1,89 @@
+import { Request, Response } from 'express'
+import { body, validationResult } from 'express-validator'
+
+import { actualizaDiscapacidadMolService } from '../services/actualiza-discapacidad-mol.service'
+
+/** Códigos MT_DISCAPACIDAD (UI / SP); no incluye Ninguna. */
+export const DISCAPACIDAD_CODIGOS_PERMITIDOS = [
+  'Física-Motora',
+  'Física–Visceral',
+  'Visual',
+  'Auditiva',
+  'Psíquica',
+  'Intelectual',
+  'Espectro del Autismo',
+] as const
+
+/**
+ * POST /api/rematricula/discapacidad/actualizar-erp
+ * Ejecuta SP_MOL_ACTUALIZA_DISCAPACIDAD.
+ */
+export const validadoresActualizarDiscapacidadErp = [
+  body('codcli').isString().trim().notEmpty().isLength({ max: 20 }),
+  body('discapacidad').isString().trim().notEmpty().isLength({ max: 100 }),
+]
+
+export async function actualizarDiscapacidadErpHttp(req: Request, res: Response): Promise<void> {
+  const errors = validationResult(req)
+  if (!errors.isEmpty()) {
+    res.status(400).json({
+      ok: false,
+      message: 'Parámetros incompletos o inválidos',
+      errors: errors.array(),
+    })
+    return
+  }
+
+  const params = {
+    codcli: String(req.body.codcli).trim(),
+    discapacidad: String(req.body.discapacidad).trim(),
+  }
+
+  if (
+    !DISCAPACIDAD_CODIGOS_PERMITIDOS.includes(
+      params.discapacidad as (typeof DISCAPACIDAD_CODIGOS_PERMITIDOS)[number],
+    )
+  ) {
+    res.status(400).json({
+      ok: false,
+      message: 'Código de discapacidad no permitido',
+      code: 'INVALID_CODE',
+      params,
+      allowed: [...DISCAPACIDAD_CODIGOS_PERMITIDOS],
+    })
+    return
+  }
+
+  try {
+    const result = await actualizaDiscapacidadMolService.actualizar(params)
+
+    if (!result.ok) {
+      const status = result.code === 'ERP_ERROR' ? 502 : 200
+      res.status(status).json({
+        ok: false,
+        message: result.message,
+        error: result.error,
+        code: result.code,
+        params: result.params,
+        duracionMs: result.duracionMs,
+      })
+      return
+    }
+
+    res.json({
+      ok: true,
+      message: result.message,
+      data: result.data,
+      params: result.params,
+      duracionMs: result.duracionMs,
+    })
+  } catch (error) {
+    console.error('[actualiza-discapacidad-mol] controller:', error)
+    res.status(500).json({
+      ok: false,
+      message: 'Error interno actualizando discapacidad en ERP',
+      error: error instanceof Error ? error.message : 'Error desconocido',
+      params,
+    })
+  }
+}
diff --git a/src/index.ts b/src/index.ts
index d5c20cb..763e102 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -8,10 +8,11 @@ import desistimientoRoutes from './routes/desistimiento.routes'
 import firmaAceptaRoutes from './routes/firma-acepta.routes'
 import matriculadosRoutes from './routes/matriculados.routes'
 import authRoutes from './routes/auth.routes'
 import rematriculaContactoOtpRoutes from './routes/rematricula-contacto-otp.routes'
 import rematriculaContactoDatosRoutes from './routes/rematricula-contacto-datos.routes'
+import rematriculaDiscapacidadRoutes from './routes/rematricula-discapacidad.routes'
 import rematriculaApoderadoRoutes from './routes/rematricula-apoderado.routes'
 import rematriculaAlumnosPeriodoRoutes from './routes/rematricula-alumnos-periodo.routes'
 import rematriculaArancelesRoutes from './routes/rematricula-aranceles.routes'
 import rematriculaArancelRoutes from './routes/rematricula-arancel.routes'
 import rematriculaBeneficiosRoutes from './routes/rematricula-beneficios.routes'
@@ -82,10 +83,11 @@ app.use('/api/postulantes', postulantesRoutes)     // Después (rutas genéricas
 app.use('/api/firma-acepta', firmaAceptaRoutes)
 app.use('/api/matriculados', matriculadosRoutes)
 app.use('/api/auth', authRoutes)                   // Autenticación LDAP
 app.use('/api/rematricula/contacto-otp', rematriculaContactoOtpRoutes)
 app.use('/api/rematricula/contacto', rematriculaContactoDatosRoutes)
+app.use('/api/rematricula/discapacidad', rematriculaDiscapacidadRoutes)
 app.use('/api/rematricula/apoderado', rematriculaApoderadoRoutes)
 app.use('/api/rematricula/alumnos-periodo', rematriculaAlumnosPeriodoRoutes)
 app.use('/api/rematricula/aranceles', rematriculaArancelesRoutes)
 app.use('/api/rematricula/arancel', rematriculaArancelRoutes)
 app.use('/api/rematricula/beneficios', rematriculaBeneficiosRoutes)
@@ -168,10 +170,11 @@ async function startServer() {
       console.log(`   - GET    /api/auth/ldap-health`)
       console.log(`   - POST   /api/rematricula/contacto-otp/email/solicitar`)
       console.log(`   - POST   /api/rematricula/contacto-otp/email/verificar`)
       console.log(`   - POST   /api/rematricula/contacto/actualizar-datos-erp`)
       console.log(`   - POST   /api/rematricula/contacto/sync-mt-client-prod-to-test`)
+      console.log(`   - POST   /api/rematricula/discapacidad/actualizar-erp`)
       console.log(`   - POST   /api/rematricula/apoderado/aviso-desactualizado`)
       console.log(`   - POST   /api/rematricula/apoderado/refresh-from-erp`)
       console.log(`   - POST   /api/rematricula/alumnos-periodo/sync`)
       console.log(`   - POST   /api/rematricula/alumno/contrato/preview-pdf`)
       console.log(`   - POST   /api/rematricula/alumno/contrato/firma/ensure`)
diff --git a/src/routes/rematricula-discapacidad.routes.ts b/src/routes/rematricula-discapacidad.routes.ts
new file mode 100644
index 0000000..240876a
--- /dev/null
+++ b/src/routes/rematricula-discapacidad.routes.ts
@@ -0,0 +1,12 @@
+import { Router } from 'express'
+
+import {
+  actualizarDiscapacidadErpHttp,
+  validadoresActualizarDiscapacidadErp,
+} from '../controllers/rematricula-discapacidad.controller'
+
+const router = Router()
+
+router.post('/actualizar-erp', validadoresActualizarDiscapacidadErp, actualizarDiscapacidadErpHttp)
+
+export default router
diff --git a/src/services/actualiza-discapacidad-mol.service.ts b/src/services/actualiza-discapacidad-mol.service.ts
new file mode 100644
index 0000000..86e37d4
--- /dev/null
+++ b/src/services/actualiza-discapacidad-mol.service.ts
@@ -0,0 +1,180 @@
+import sql from 'mssql'
+
+import { getConnectionErpSp, hostEnmascarado, type ErpSpAmbiente } from '../config/database-erp-sp'
+import { resolveAmbienteActivo } from './erp-sp-ambiente.service'
+
+export type ActualizaDiscapacidadMolParams = {
+  codcli: string
+  discapacidad: string
+  ambiente?: ErpSpAmbiente
+  host?: string
+}
+
+export type ActualizaDiscapacidadMolData = {
+  resultado: string
+  raw: Record<string, unknown>
+}
+
+export type ActualizaDiscapacidadMolResult =
+  | {
+      ok: true
+      message: string
+      data: ActualizaDiscapacidadMolData
+      params: ActualizaDiscapacidadMolParams
+      duracionMs: number
+    }
+  | {
+      ok: false
+      message: string
+      error?: string
+      code: 'ERP_ERROR' | 'NO_ROWS' | 'INVALID_CODE'
+      params: ActualizaDiscapacidadMolParams
+      duracionMs: number
+    }
+
+function pickStr(row: Record<string, unknown>, ...keys: string[]): string | null {
+  const lower = Object.fromEntries(
+    Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]),
+  )
+  for (const key of keys) {
+    const v = lower[key.toLowerCase()]
+    if (v == null) continue
+    const s = String(v).trim()
+    if (s.length > 0) return s
+  }
+  return null
+}
+
+function serializeRaw(row: Record<string, unknown>): Record<string, unknown> {
+  const out: Record<string, unknown> = {}
+  for (const [k, v] of Object.entries(row)) {
+    if (v instanceof Date) out[k] = v.toISOString()
+    else if (typeof v === 'bigint') out[k] = Number(v)
+    else if (v != null && typeof v === 'object' && 'toFixed' in (v as object)) {
+      out[k] = Number(v as unknown as number)
+    } else out[k] = v
+  }
+  return out
+}
+
+function classifySpFailureCode(
+  errorMessage: string | null,
+  row: Record<string, unknown>,
+): 'INVALID_CODE' | 'ERP_ERROR' {
+  const codeField = pickStr(row, 'CODE', 'code', 'CODIGO', 'codigo')
+  if (codeField?.toUpperCase() === 'INVALID_CODE') return 'INVALID_CODE'
+
+  if (!errorMessage) return 'ERP_ERROR'
+  const lower = errorMessage.toLowerCase()
+  if (
+    lower.includes('mt_discapacidad') ||
+    (lower.includes('discapacidad') &&
+      (lower.includes('inválid') ||
+        lower.includes('invalid') ||
+        lower.includes('no existe') ||
+        lower.includes('no valido') ||
+        lower.includes('no válido')))
+  ) {
+    return 'INVALID_CODE'
+  }
+  return 'ERP_ERROR'
+}
+
+export class ActualizaDiscapacidadMolService {
+  async actualizar(input: {
+    codcli: string
+    discapacidad: string
+  }): Promise<ActualizaDiscapacidadMolResult> {
+    const started = Date.now()
+    const { ambiente, label } = await resolveAmbienteActivo()
+    const host = hostEnmascarado(ambiente)
+    const params: ActualizaDiscapacidadMolParams = {
+      codcli: String(input.codcli).trim(),
+      discapacidad: String(input.discapacidad).trim(),
+      ambiente,
+      host,
+    }
+
+    console.log(
+      `[actualiza-discapacidad-mol] ambiente=${ambiente} (${label}) host=${host} codcli=${params.codcli}`,
+    )
+
+    try {
+      const pool = await getConnectionErpSp(ambiente)
+      const result = await pool
+        .request()
+        .input('CODCLI', sql.VarChar(20), params.codcli)
+        .input('DISCAPACIDAD', sql.VarChar(100), params.discapacidad)
+        .query(`
+EXEC SP_MOL_ACTUALIZA_DISCAPACIDAD
+    @CODCLI = @CODCLI,
+    @DISCAPACIDAD = @DISCAPACIDAD
+`)
+
+      const recordset = (result.recordset ?? []) as Record<string, unknown>[]
+      if (recordset.length === 0) {
+        console.warn(`[actualiza-discapacidad-mol] codcli=${params.codcli} resultado=NO_ROWS`)
+        return {
+          ok: false,
+          code: 'NO_ROWS',
+          message: 'El SP no devolvió filas',
+          params,
+          duracionMs: Date.now() - started,
+        }
+      }
+
+      const row = recordset[0]
+      const resultado = pickStr(row, 'RESULTADO', 'resultado') ?? ''
+      const errorMessage = pickStr(row, 'ERROR_MESSAGE', 'error_message', 'MENSAJE', 'mensaje')
+
+      console.log(
+        `[actualiza-discapacidad-mol] codcli=${params.codcli} resultado=${resultado || '-'}`,
+      )
+
+      if (resultado.toUpperCase() === 'OK') {
+        const message =
+          errorMessage ?? pickStr(row, 'MENSAJE', 'mensaje') ?? 'Discapacidad actualizada correctamente'
+        return {
+          ok: true,
+          message,
+          data: {
+            resultado,
+            raw: serializeRaw(row),
+          },
+          params,
+          duracionMs: Date.now() - started,
+        }
+      }
+
+      const message =
+        errorMessage ??
+        (resultado.toUpperCase() === 'ERROR'
+          ? 'El SP reportó error al actualizar discapacidad'
+          : 'Respuesta inesperada del SP')
+
+      const code = classifySpFailureCode(errorMessage, row)
+
+      return {
+        ok: false,
+        code,
+        message,
+        error: errorMessage ?? undefined,
+        params,
+        duracionMs: Date.now() - started,
+      }
+    } catch (err) {
+      const message = err instanceof Error ? err.message : String(err)
+      console.error('[actualiza-discapacidad-mol] error:', message)
+      return {
+        ok: false,
+        code: 'ERP_ERROR',
+        message: 'Error ejecutando SP_MOL_ACTUALIZA_DISCAPACIDAD',
+        error: message,
+        params,
+        duracionMs: Date.now() - started,
+      }
+    }
+  }
+}
+
+export const actualizaDiscapacidadMolService = new ActualizaDiscapacidadMolService()
