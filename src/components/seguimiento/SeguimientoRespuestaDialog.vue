<script setup lang="ts">
import {ref,watch,computed} from 'vue'
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {fechaHoraChileInput,fechaHoraChileIso,etiquetaFechaChile} from '@/utils/seguimientoNota'
import type {ContactoSeguimiento,RespuestaSeguimientoPayload} from '@/services/seguimientoRematriculaApi'
const props=defineProps<{open:boolean;bitacora:ContactoSeguimiento[];guardando:boolean;error:string|null}>()
const emit=defineEmits<{'update:open':[boolean];guardar:[RespuestaSeguimientoPayload]}>()
const canal=ref('correo'),fecha=ref(''),comentario=ref(''),vinculo=ref(''),requestId=ref(''),errorLocal=ref('')
watch(()=>props.open,open=>{if(open){canal.value='correo';fecha.value=fechaHoraChileInput(new Date().toISOString());comentario.value='';vinculo.value='';requestId.value=crypto.randomUUID();errorLocal.value=''}},{immediate:true})
watch(canal,()=>{vinculo.value=''})
const contactos=computed(()=>props.bitacora.filter(c=>!c.es_respuesta&&c.origen==='manual'&&c.canal===canal.value))
function guardar(){if(props.guardando)return;const iso=fechaHoraChileIso(fecha.value);if(!iso||Date.parse(iso)>Date.now()){errorLocal.value='Fecha inválida o futura (America/Santiago)';return}errorLocal.value='';emit('guardar',{requestId:requestId.value,contactoId:vinculo.value||null,canal:canal.value,fecha:iso,comentario:comentario.value.trim()||null})}
</script>
<template>
 <Dialog :open="open" @update:open="v=>{if(!guardando)emit('update:open',v)}"><DialogContent class="max-md:inset-0 max-md:left-0 max-md:top-0 max-md:h-[100dvh] max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:overflow-y-auto max-md:rounded-none"><DialogHeader><DialogTitle>Alumno respondió</DialogTitle><DialogDescription>No envía mensajes. Registro manual auditable en America/Santiago.</DialogDescription></DialogHeader>
  <form class="space-y-4" @submit.prevent="guardar">
   <label class="block">Canal<select v-model="canal" class="mt-1 min-h-11 w-full rounded border px-3 text-base"><option value="correo">Correo</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option><option value="llamada">Llamada</option></select></label>
   <label class="block">Fecha y hora (Chile)<input v-model="fecha" type="datetime-local" required class="mt-1 min-h-11 w-full rounded border px-3 text-base" /></label>
   <label class="block">Contacto saliente al que responde<select v-model="vinculo" class="mt-1 min-h-11 w-full rounded border px-3 text-base"><option value="">Sin contacto vinculado (no afecta tasa)</option><option v-for="c in contactos" :key="c.id" :value="c.id">{{etiquetaFechaChile(c.fecha_contacto||c.created_at)}} · {{c.autor_email}}</option></select></label>
   <p class="text-xs text-zinc-500">Vincula solo si corresponde a ese contacto. Una respuesta por contacto; fuera de 7 días se registra pero no suma a la tasa. Los contactos históricos mantienen N/D.</p>
   <label class="block">Comentario opcional<textarea v-model="comentario" maxlength="2000" rows="3" class="mt-1 w-full rounded border p-3 text-base" /></label>
   <p v-if="error||errorLocal" role="alert" class="text-sm text-red-700">{{error||errorLocal}}</p>
   <DialogFooter class="sticky bottom-0 gap-2 bg-white py-3"><Button type="button" variant="outline" class="min-h-11" :disabled="guardando" @click="emit('update:open',false)">Cancelar</Button><Button type="submit" class="min-h-11" :disabled="guardando">{{guardando?'Registrando…':'Registrar respuesta'}}</Button></DialogFooter>
  </form>
 </DialogContent></Dialog>
</template>
