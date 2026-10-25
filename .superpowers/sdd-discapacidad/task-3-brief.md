### Task 3: Badges en ConvenioVigenteUpload

**Files:**
- Modify: `src/components/rematricula/ConvenioVigenteUpload.vue`

**Interfaces:**
- Consumes: props opcionales `estadoCaso: MnpCasoRematriculaEstado | null`, `motivoRechazo: string | null`
- Produces: UI badge según estado; no implica “listo para pagar” solo por archivo

- [ ] **Step 1: Extend props**

```ts
import type { MnpCasoRematriculaEstado } from '@/types/supabase'

const props = defineProps<{
  match: ConvenioAlumnoMatch
  documento: MockConvenioDocumento | null
  contexto: ContextoMolAuditoriaOpciones
  estadoCaso?: MnpCasoRematriculaEstado | null
  motivoRechazo?: string | null
}>()
```

- [ ] **Step 2: Update template when `documento` exists**

Replace the green “Documento cargado: …” as the sole status with:

```vue
<div v-if="documento" class="mt-3 space-y-2">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="flex flex-wrap items-center gap-2 text-sm">
      <Badge
        v-if="estadoCaso === 'APROBADO'"
        class="bg-green-700"
      >Aprobado</Badge>
      <Badge
        v-else-if="estadoCaso === 'RECHAZADO'"
        variant="destructive"
      >Rechazado</Badge>
      <Badge
        v-else
        class="bg-amber-600"
      >En revisión</Badge>
      <span class="text-zinc-700">{{ documento.nombreArchivo }}</span>
    </div>
    <Button
      v-if="estadoCaso !== 'APROBADO'"
      type="button"
      variant="outline"
      size="sm"
      class="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700"
      :disabled="eliminando"
      @click="eliminar"
    >
      ...
    </Button>
  </div>
  <p v-if="estadoCaso === 'RECHAZADO'" class="text-sm text-red-700">
    {{ motivoRechazo?.trim() || 'Documento rechazado.' }}
    Vuelve a subir el documento.
  </p>
  <p v-else-if="estadoCaso === 'EN_REVISION' || !estadoCaso" class="text-sm text-amber-800">
    Documento enviado. En revisión por tu consejero.
  </p>
</div>
```

If `RECHAZADO`, show upload controls again (or after Eliminar). Simplest: when `estadoCaso === 'RECHAZADO'`, also show the file input block below the message so re-upload works without forcing delete. After successful re-upload, parent opens new `EN_REVISION` and refreshes casos.

- [ ] **Step 3: Commit**

```bash
git add src/components/rematricula/ConvenioVigenteUpload.vue src/views/matricula-mock/FormaPagoMockView.vue
git commit -m "feat(rematricula): badges de estado en certificado convenio"
```

---

