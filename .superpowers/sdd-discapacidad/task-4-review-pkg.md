## Commits
ed766f0 feat(rematricula): sync discapacidad a ERP al contestar encuesta

## Stat
 src/services/actualizarDiscapacidadMolApi.ts       | 85 ++++++++++++++++++++++
 .../MatriculaMockDiscapacidadStep.vue              | 11 +++
 2 files changed, 96 insertions(+)

## Diff
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
@@ -19,20 +19,21 @@ import { Badge } from '@/components/ui/badge'
 import { Button } from '@/components/ui/button'
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
 import { Checkbox } from '@/components/ui/checkbox'
 import { Label } from '@/components/ui/label'
 import { useMockAlumnoFuente } from '@/composables/useMockAlumnoFuente'
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
 
 const ui = DISCAPACIDAD_ENCUESTA_UI
 
 const router = useRouter()
 const mockCtx = useMockMatriculaContextStore()
 const periodoActivo = usePeriodoActivoStore()
@@ -150,20 +151,30 @@ async function guardar() {
   guardando.value = true
   try {
     const respuesta = {
       contesta: true as const,
       tipo: tipoDiscapacidad.value,
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
 </script>
 
 <template>
   <div class="space-y-6">
     <Alert
