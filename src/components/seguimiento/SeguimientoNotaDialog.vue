<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { CANALES_ACCION, fechaHoraChileInput, prepararNotaFormulario, type NotaContactoPayload } from '@/utils/seguimientoNota'
const props = defineProps<{ open: boolean; guardando: boolean; error?: string | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; guardar: [nota: NotaContactoPayload] }>()
const form = reactive({fecha_contacto:'',canal:'llamada',nota:'',proxima_fecha:'',proxima_canales:[] as string[],proxima_comentario:''})
const errorLocal = ref<string | null>(null)
watch(() => props.open, (open) => {
  if (!open) return
  Object.assign(form,{fecha_contacto:fechaHoraChileInput(),canal:'llamada',nota:'',proxima_fecha:'',proxima_canales:[],proxima_comentario:''})
  errorLocal.value = null
}, {immediate:true})
function toggleCanal(canal: string) {
  form.proxima_canales = form.proxima_canales.includes(canal) ? form.proxima_canales.filter(c=>c!==canal) : [...form.proxima_canales,canal]
}
function guardar() {
  if (props.guardando) return
  const resultado = prepararNotaFormulario(form)
  errorLocal.value = resultado.error
  if (resultado.data) emit('guardar',resultado.data)
}
</script>
<template>
  <Dialog :open="open" @update:open="v => !guardando && emit('update:open',v)">
    <DialogContent class="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto p-4 sm:p-6">
      <DialogHeader><DialogTitle>Agregar nota</DialogTitle></DialogHeader>
      <form class="space-y-4" @submit.prevent="guardar">
        <fieldset class="min-w-0 rounded-lg border border-zinc-200 p-3 sm:p-4" :disabled="guardando">
          <legend class="px-1 text-sm font-semibold text-zinc-900">1. Nota (lo que pasó)</legend>
          <div class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="min-w-0">
              <label for="nota-fecha" class="text-xs text-zinc-500">Fecha y hora del contacto</label>
              <Input id="nota-fecha" v-model="form.fecha_contacto" type="datetime-local" required class="mt-1 min-w-0 w-full" />
            </div>
            <div class="min-w-0">
              <label for="nota-canal" class="text-xs text-zinc-500">Canal</label>
              <select id="nota-canal" v-model="form.canal" class="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="llamada">Llamada</option><option value="correo">Correo</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option><option value="nota">Nota</option><option value="presencial">Presencial</option>
              </select>
            </div>
            <div class="sm:col-span-2">
              <label for="nota-comentario" class="text-xs text-zinc-500">Comentario <span class="text-red-600">*</span></label>
              <Textarea id="nota-comentario" v-model="form.nota" required maxlength="10000" rows="4" class="mt-1" placeholder="Ej.: contestó, paga el arancel el lunes" />
            </div>
          </div>
        </fieldset>
        <fieldset class="min-w-0 rounded-lg border border-zinc-200 p-3 sm:p-4" :disabled="guardando">
          <legend class="px-1 text-sm font-semibold text-zinc-900">2. Próxima acción (opcional)</legend>
          <label for="accion-fecha" class="text-xs text-zinc-500">Fecha y hora</label>
          <Input id="accion-fecha" v-model="form.proxima_fecha" type="datetime-local" class="mt-1 min-w-0 w-full sm:w-auto" />
          <p id="accion-canales-label" class="mb-1 mt-3 text-xs text-zinc-500">Canales (uno o varios)</p>
          <div class="flex flex-wrap gap-2" role="group" aria-labelledby="accion-canales-label">
            <button v-for="canal in CANALES_ACCION" :key="canal.value" type="button" :aria-pressed="form.proxima_canales.includes(canal.value)" :class="['cursor-pointer rounded-full border px-3 py-1.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-600',form.proxima_canales.includes(canal.value)?'border-[#FF5B00] bg-orange-50 text-orange-800':'border-zinc-200 bg-white text-zinc-700']" @click="toggleCanal(canal.value)">
              <span aria-hidden="true">{{ form.proxima_canales.includes(canal.value) ? '✓' : '+' }}</span> {{ canal.label }}
            </button>
          </div>
          <label for="accion-comentario" class="mt-3 block text-xs text-zinc-500">Comentario</label>
          <Textarea id="accion-comentario" v-model="form.proxima_comentario" maxlength="10000" rows="3" class="mt-1" placeholder="Ej.: confirmar pago y recordar firma" />
          <p class="mt-2 text-xs text-zinc-500">Si completas esta tarjeta, indica fecha y al menos un canal. Aparece en Próxima acción de la bandeja; no envía mensajes automáticamente.</p>
        </fieldset>
        <p class="text-xs text-zinc-500">Todas las fechas y horas corresponden a Chile (America/Santiago).</p>
        <p v-if="errorLocal || error" role="alert" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorLocal || error }}</p>
        <DialogFooter class="gap-2">
          <Button type="button" variant="outline" :disabled="guardando" class="cursor-pointer" @click="emit('update:open',false)">Cancelar</Button>
          <Button type="submit" :disabled="guardando" class="cursor-pointer bg-[#FF5B00] hover:bg-[#FF5B00]/90">{{ guardando ? 'Guardando…' : 'Guardar' }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
