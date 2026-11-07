<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import RichTextEditor from '@/components/rich-text/RichTextEditor.vue'
import {
  postSeguimientoEnviarCorreo,
  putFirmaEjecutivo,
  type CasoSeguimientoDetalle,
  type PlantillaCorreoSeguimiento,
} from '@/services/seguimientoRematriculaApi'
import { useAuthStore } from '@/stores/auth'
import {claveBorrador,leerBorrador,guardarBorrador,borrarBorrador} from '@/utils/seguimientoBorrador'
import { toast } from 'vue-sonner'

const props = defineProps<{
  open: boolean
  caso: CasoSeguimientoDetalle
  anio: number
  semestre: number
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  enviado: []
}>()

const auth = useAuthStore()
const plantilla = ref<PlantillaCorreoSeguimiento>('retencion_2h')
const asunto = ref('¡Tu matrícula ya está pagada! Completa tu rematrícula 2027-1')
const html = ref(
  '<p><b>¡Gracias por realizar el pago de tu matrícula para el período académico 2027-1!</b></p><p>Hemos recibido tu pago. Completa forma de pago de arancel y firma de contrato.</p>',
)
const incluirFirma = ref(true)
const enviando = ref(false)

const draftKey=computed(()=>claveBorrador(auth.email,props.caso.codcli,props.anio,props.semestre,'correo'))
const inicial={plantilla:plantilla.value,asunto:asunto.value,html:html.value,incluirFirma:incluirFirma.value},restaurando=ref(false)
watch([()=>props.open,draftKey],async([open])=>{if(!open)return;restaurando.value=true;const d=leerBorrador(draftKey.value);plantilla.value=d && ['retencion_2h','recordatorio_firma','recordatorio_forma_pago','personalizado'].includes(String(d.plantilla))?d.plantilla as PlantillaCorreoSeguimiento:inicial.plantilla;asunto.value=typeof d?.asunto==='string'?d.asunto:inicial.asunto;html.value=typeof d?.html==='string'?d.html:inicial.html;incluirFirma.value=typeof d?.incluirFirma==='boolean'?d.incluirFirma:inicial.incluirFirma;await nextTick();restaurando.value=false},{immediate:true})
watch([plantilla,asunto,html,incluirFirma],()=>{if(props.open && !restaurando.value)guardarBorrador(draftKey.value,{plantilla:plantilla.value,asunto:asunto.value,html:html.value,incluirFirma:incluirFirma.value})})
function descartar(){borrarBorrador(draftKey.value);emit('update:open',false)}
const PLANTILLAS: Array<{ id: PlantillaCorreoSeguimiento; label: string }> = [
  { id: 'retencion_2h', label: 'Retención 2h' },
  { id: 'recordatorio_firma', label: 'Recordatorio firma' },
  { id: 'recordatorio_forma_pago', label: 'Forma de pago / arancel' },
  { id: 'personalizado', label: 'Personalizado' },
]

watch(plantilla, (p) => {
  if(restaurando.value)return
  if (p === 'retencion_2h') {
    asunto.value = '¡Tu matrícula ya está pagada! Completa tu rematrícula 2027-1'
  } else if (p === 'recordatorio_firma') {
    asunto.value = 'Recordatorio: firma tu contrato de rematrícula 2027-1'
  } else if (p === 'recordatorio_forma_pago') {
    asunto.value = 'Recordatorio: elige forma de pago de tu arancel 2027-1'
  }
})

async function onFileFirma(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
    toast.error('Solo PNG o JPG')
    return
  }
  const buf = await file.arrayBuffer()
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
  const r = await putFirmaEjecutivo({
    mime: file.type as 'image/png' | 'image/jpeg',
    base64,
  })
  if (r.error) toast.error(r.error)
  else toast.success('Firma guardada')
}

async function enviar(): Promise<void> {
  enviando.value = true
  try {
    const r = await postSeguimientoEnviarCorreo(props.caso.codcli, {
      anio: props.anio,
      semestre: props.semestre,
      plantilla: plantilla.value,
      asunto: asunto.value,
      html: html.value,
      incluirFirma: incluirFirma.value,
    })
    if (r.error) {
      toast.error(r.error)
      return
    }
    borrarBorrador(draftKey.value)
    toast.success('Correo enviado')
    emit('enviado')
    emit('update:open', false)
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="left-0 top-0 h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-none p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:left-1/2 md:top-1/2 md:h-auto md:max-h-[90dvh] md:w-[calc(100%-2rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:p-6 md:max-w-2xl overflow-y-auto [&_input]:text-base [&_textarea]:text-base [&_button]:min-h-11">
      <DialogHeader>
        <DialogTitle>Enviar correo · {{ caso.nombre_alumno }}</DialogTitle>
      </DialogHeader>
      <div class="space-y-3 text-sm">
        <div>
          <Label>De (sesión)</Label>
          <Input class="mt-1 bg-zinc-50" :model-value="auth.email ?? ''" readonly />
        </div>
        <div>
          <Label>Para</Label>
          <Input class="mt-1" :model-value="caso.email_alumno ?? ''" readonly />
        </div>
        <div class="flex flex-wrap gap-1">
          <button
            v-for="p in PLANTILLAS"
            :key="p.id"
            type="button"
            class="cursor-pointer rounded-full border px-2.5 py-1 text-xs"
            :class="
              plantilla === p.id
                ? 'border-[#FF5B00] bg-orange-50 text-[#FF5B00]'
                : 'border-zinc-200'
            "
            @click="plantilla = p.id"
          >
            {{ p.label }}
          </button>
        </div>
        <div>
          <Label>Asunto</Label>
          <Input v-model="asunto" class="mt-1" />
        </div>
        <div>
          <Label>Cuerpo</Label>
          <div class="mt-1 max-h-64 overflow-y-auto rounded-md border">
            <RichTextEditor v-model="html" />
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <label class="flex cursor-pointer items-center gap-2 text-xs">
            <input v-model="incluirFirma" type="checkbox" class="cursor-pointer" />
            Incluir firma guardada
          </label>
          <label class="cursor-pointer text-xs text-[#FF5B00] underline">
            Subir firma
            <input type="file" accept="image/png,image/jpeg" class="hidden" @change="onFileFirma" />
          </label>
        </div>
      </div>
      <p class="text-xs text-zinc-500">Borrador privado de esta pestaña (24 h); cancelar lo conserva.</p>
      <DialogFooter class="sticky bottom-0 gap-2 bg-white py-2">
        <Button type="button" variant="outline" class="cursor-pointer" @click="emit('update:open', false)">
          Cancelar
        </Button>
        <Button type="button" variant="outline" @click="descartar">Descartar borrador</Button>
        <Button
          type="button"
          class="cursor-pointer bg-[#FF5B00] hover:bg-[#FF5B00]/90"
          :disabled="enviando || !caso.email_alumno"
          @click="enviar"
        >
          {{ enviando ? 'Enviando…' : 'Enviar' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
