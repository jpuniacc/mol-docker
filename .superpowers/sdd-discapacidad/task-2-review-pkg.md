## Commits
8b943ff feat(rematricula): endpoint actualizar discapacidad ERP

## Stat
 .../rematricula-discapacidad.controller.ts         | 89 ++++++++++++++++++++++
 src/index.ts                                       |  3 +
 src/routes/rematricula-discapacidad.routes.ts      | 12 +++
 3 files changed, 104 insertions(+)

## Diff
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
@@ -3,20 +3,21 @@ import './env'
 
 import express, { Application, Request, Response } from 'express'
 import cors from 'cors'
 import postulantesRoutes from './routes/postulantes.routes'
 import desistimientoRoutes from './routes/desistimiento.routes'
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
 import rematriculaEstadoCaeAlumnosRoutes from './routes/rematricula-estado-cae-alumnos.routes'
 import rematriculaCaeArancelReferenciaRoutes from './routes/rematricula-cae-arancel-referencia.routes'
 import rematriculaErpSpAmbienteRoutes from './routes/rematricula-erp-sp-ambiente.routes'
 import rematriculaDocpagRoutes from './routes/rematricula-docpag.routes'
 import rematriculaAlumnoRoutes from './routes/rematricula-alumno.routes'
@@ -77,20 +78,21 @@ app.get('/api/health', (req: Request, res: Response) => {
 })
 
 // Rutas - IMPORTANTE: Rutas específicas ANTES de genéricas
 app.use('/api/postulantes', desistimientoRoutes)  // Primero (rutas específicas como /:codint/historial-estados)
 app.use('/api/postulantes', postulantesRoutes)     // Después (rutas genéricas como /:id)
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
 app.use('/api/rematricula/estado-cae-alumnos', rematriculaEstadoCaeAlumnosRoutes)
 app.use('/api/rematricula/cae-arancel-referencia', rematriculaCaeArancelReferenciaRoutes)
 app.use('/api/rematricula/erp-sp-ambiente', rematriculaErpSpAmbienteRoutes)
 app.use('/api/rematricula/docpag', rematriculaDocpagRoutes)
 app.use('/api/rematricula/alumno', rematriculaAlumnoRoutes)
@@ -163,20 +165,21 @@ async function startServer() {
       console.log(`   - GET    /api/matriculados`)
       console.log(`   - GET    /api/matriculados/stats`)
       console.log(`   - GET    /api/matriculados/export`)
       console.log(`   - POST   /api/matriculados/sync`)
       console.log(`   - POST   /api/auth/validate`)
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
       console.log(`   - GET    /api/rematricula/alumno/contrato/firma`)
       console.log(`   - GET    /api/rematricula/alumno/contrato/firma/:numOperacion/documento`)
       console.log(`   - GET    /api/rematricula/alumno/contrato/firma/:numOperacion`)
     })
   } catch (error) {
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
