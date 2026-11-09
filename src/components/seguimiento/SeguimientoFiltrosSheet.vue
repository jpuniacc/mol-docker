<script setup lang="ts">
import SeguimientoFiltrosRecordatorios from './SeguimientoFiltrosRecordatorios.vue'
import type {FiltrosRecordatorios} from '@/types/recordatoriosEtapa'
import {reactive,watch} from 'vue'
import {Sheet,SheetContent,SheetTitle,SheetDescription} from '@/components/ui/sheet'
import {ORDEN_CHIPS_BANDEJA,ETIQUETA_CHIP_BANDEJA,type ChipBandeja} from '@/utils/seguimientoBandejaChip'
import type {SubetapaFormaPago,FiltroAuxSeguimiento} from '@/services/seguimientoRematriculaApi'
type Filtros={recordatorios?:FiltrosRecordatorios;chip:ChipBandeja|null;subetapa:SubetapaFormaPago;filtroAux:FiltroAuxSeguimiento|null;ejecutivo:string}
const props=defineProps<{open:boolean;value:Filtros;supervisor:boolean;ejecutivos:string[];periodo:string}>()
const emit=defineEmits<{'update:open':[v:boolean];aplicar:[v:Filtros]}>()
const draft=reactive<Filtros>({...props.value})
watch(()=>props.open,v=>{if(v)Object.assign(draft,props.value)},{immediate:true})
function aplicar(){emit('aplicar',{...draft,subetapa:draft.chip==='forma_pago'?draft.subetapa:null,ejecutivo:props.supervisor?draft.ejecutivo:''});emit('update:open',false)}
</script>
<template><Sheet :open="open" @update:open="emit('update:open',$event)"><SheetContent side="bottom" class="max-h-[95dvh] overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
 <SheetTitle class="pr-10 text-lg font-bold text-[#1E3A5F]">Filtros de seguimiento</SheetTitle><SheetDescription>Período {{periodo}} · Cancelar conserva los filtros actuales.</SheetDescription>
 <form class="mt-4 space-y-4" @submit.prevent="aplicar">
 <label v-if="supervisor" class="block text-sm">Consejero<select v-model="draft.ejecutivo" name="ejecutivo" class="mt-1 min-h-11 w-full rounded-md border p-2 text-base"><option value="">Todas las carteras</option><option v-for="e in [...new Set([...ejecutivos,...(draft.ejecutivo?[draft.ejecutivo]:[])])]" :key="e" :value="e">{{e}}</option></select></label>
 <label class="block text-sm">Etapa<select v-model="draft.chip" name="etapa" class="mt-1 min-h-11 w-full rounded-md border p-2 text-base"><option :value="null">Todas</option><option v-for="c in ORDEN_CHIPS_BANDEJA" :key="c" :value="c">{{ETIQUETA_CHIP_BANDEJA[c]}}</option></select></label>
 <label v-if="draft.chip==='forma_pago'" class="block text-sm">Subetapa<select v-model="draft.subetapa" class="mt-1 min-h-11 w-full rounded-md border p-2 text-base"><option :value="null">Todas</option><option value="cae">CAE</option><option value="ministerial">Beneficio ministerial</option><option value="ambos">Ambos</option><option value="resto">Resto</option></select></label>
 <label class="block text-sm">Alerta<select v-model="draft.filtroAux" class="mt-1 min-h-11 w-full rounded-md border p-2 text-base"><option :value="null">Todas</option><option value="sin_contactar_7d">Sin contactar 7 días</option><option value="mail_2h_pdte">Correo 2 h pendiente</option><option value="sms_24h_pdte">SMS 24 h pendiente</option></select></label>
 <SeguimientoFiltrosRecordatorios :model-value="draft.recordatorios??{}" @update:model-value="draft.recordatorios=$event" />
 <div class="sticky bottom-0 grid grid-cols-3 gap-2 bg-white py-3"><button type="button" class="min-h-11 rounded-md border text-sm" @click="Object.assign(draft,{recordatorios:{},chip:null,subetapa:null,filtroAux:null,ejecutivo:''})">Limpiar</button><button type="button" class="min-h-11 rounded-md border text-sm" @click="emit('update:open',false)">Cancelar</button><button type="submit" class="min-h-11 rounded-md bg-[#FF5B00] text-sm font-semibold text-white">Aplicar</button></div>
 </form></SheetContent></Sheet></template>
