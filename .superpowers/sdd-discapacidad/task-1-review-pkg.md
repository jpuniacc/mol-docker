## Commits
5d81a28 feat(rematricula): servicio SP_MOL_ACTUALIZA_DISCAPACIDAD

## Stat
 src/services/actualiza-discapacidad-mol.service.ts | 180 +++++++++++++++++++++
 1 file changed, 180 insertions(+)

## Diff
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
