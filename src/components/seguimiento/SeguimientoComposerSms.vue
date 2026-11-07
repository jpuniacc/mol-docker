<script setup lang="ts">
import { computed, ref } from 'vue'
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

const SMS_DEFAULT =
  'UNIACC: Tu matrícula 2027-1 está pagada, pero falta elegir forma de pago para tu arancel y firmar tu contrato. Completa aquí: mol.uniacc.cl'

const texto = ref(SMS_DEFAULT)
const enviando = ref(false)
const len = computed(() => texto.value.length)
const over = computed(() => len.value > 139)

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
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>Enviar SMS · {{ caso.nombre_alumno }}</DialogTitle>
      </DialogHeader>
      <div class="space-y-3 text-sm">
        <div>
          <Label>Para</Label>
          <p class="mt-1 rounded-md border bg-zinc-50 px-3 py-2">
            {{ caso.telefono ?? '—' }}
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
      <DialogFooter class="gap-2">
        <Button type="button" variant="outline" class="cursor-pointer" @click="emit('update:open', false)">
          Cancelar
        </Button>
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
