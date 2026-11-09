<script setup lang="ts">
import type {FiltrosRecordatorios} from '@/types/recordatoriosEtapa'
const props=defineProps<{modelValue:FiltrosRecordatorios}>(),emit=defineEmits<{'update:modelValue':[v:FiltrosRecordatorios]}>()
function cambiar(k:keyof FiltrosRecordatorios,e:Event){emit('update:modelValue',{...props.modelValue,[k]:(e.target as HTMLSelectElement).value||null})}
</script>
<template>
 <fieldset class="min-w-0 space-y-3 rounded border p-3"><legend class="text-sm font-semibold">Recordatorios por etapa</legend>
  <label class="block text-sm">Estado de recordatorio<select :value="modelValue.recordatorio_estado??''" class="mt-1 min-h-11 w-full rounded border p-2 text-base" @change="cambiar('recordatorio_estado',$event)"><option value="">Todos</option><option value="enviado">Enviado</option><option value="pendiente">Pendiente / en proceso</option><option value="error">Error / incierto / diferido</option></select></label>
  <label class="block text-sm">Etapa de recordatorio<select :value="modelValue.recordatorio_etapa??''" class="mt-1 min-h-11 w-full rounded border p-2 text-base" @change="cambiar('recordatorio_etapa',$event)"><option value="">Todas</option><option value="ingreso">Ingreso</option><option value="tyc">TyC</option><option value="datos">Datos</option><option value="forma_pago">Forma de pago</option></select></label>
  <label class="block text-sm">Canal de recordatorio<select :value="modelValue.recordatorio_canal??''" class="mt-1 min-h-11 w-full rounded border p-2 text-base" @change="cambiar('recordatorio_canal',$event)"><option value="">Todos</option><option value="correo">Correo</option><option value="sms">SMS</option></select></label>
 </fieldset>
</template>
