<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  postSeguimientoEnviarSms,
  type CasoSeguimientoDetalle,
} from '@/services/seguimientoRematriculaApi'
import {useAuthStore} from '@/stores/auth'
import {claveBorrador,leerBorrador,guardarBorrador,borrarBorrador} from '@/utils/seguimientoBorrador'
import { toast } from 'vue-sonner'
import { formatearTelefono } from '@/utils/seguimientoDrawer'

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

const SMS_DEFAULT =
  'UNIACC: Tu matrícula 2027-1 está pagada, pero falta elegir forma de pago para tu arancel y firmar tu contrato. Completa aquí: mol.uniacc.cl'

const auth=useAuthStore()
const texto = ref(SMS_DEFAULT)
const enviando = ref(false)
const len = computed(() => texto.value.length)
const over = computed(() => len.value > 139)

const draftKey=computed(()=>claveBorrador(auth.email,props.caso.codcli,props.anio,props.semestre,'sms'))
watch([()=>props.open,draftKey],([open])=>{if(open){const d=leerBorrador(draftKey.value);texto.value=typeof d?.texto==='string'?d.texto:SMS_DEFAULT}},{immediate:true})
watch(texto,()=>{if(props.open)guardarBorrador(draftKey.value,{texto:texto.value})})
function descartar(){borrarBorrador(draftKey.value);emit('update:open',false)}
async function enviar(): Promise<void> {
  if (over.value) {
    toast.error('Máximo 139 caracteres')
    return
  }
  enviando.value = true
  try {
    const r = await postSeguimientoEnviarSms(props.caso.codcli, {
      anio: props.anio,
      semestre: props.semestre,
      texto: texto.value,
    })
    if (r.error) {
      toast.error(r.error)
      return
    }
    borrarBorrador(draftKey.value)
    toast.success('SMS enviado')
    emit('enviado')
    emit('update:open', false)
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="left-0 top-0 h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-none p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:left-1/2 md:top-1/2 md:h-auto md:max-h-[90dvh] md:w-[calc(100%-2rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:p-6 md:max-w-lg overflow-y-auto [&_input]:text-base [&_textarea]:text-base [&_button]:min-h-11">
      <DialogHeader>
        <DialogTitle>Enviar SMS · {{ caso.nombre_alumno }}</DialogTitle>
      </DialogHeader>
      <div class="space-y-3 text-sm">
        <div>
          <Label>Para</Label>
          <p class="mt-1 rounded-md border bg-zinc-50 px-3 py-2">
            {{ formatearTelefono(caso.telefono) }}
          </p>
        </div>
        <div>
          <Label>Mensaje</Label>
          <Textarea v-model="texto" class="mt-1" rows="5" />
          <p class="mt-1 flex justify-between text-xs" :class="over ? 'text-red-600' : 'text-zinc-500'">
            <span>{{ len }} / 139</span>
            <span>Tildes → UCS-2 (más segmentos Celmedia)</span>
          </p>
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
          :disabled="enviando || over || !caso.telefono"
          @click="enviar"
        >
          {{ enviando ? 'Enviando…' : 'Enviar SMS' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
