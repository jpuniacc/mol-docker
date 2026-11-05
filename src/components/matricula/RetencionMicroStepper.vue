<script setup lang="ts">
defineProps<{
  /** 1 = matrícula hecha (arancel pendiente), 2 = arancel listo (firma pendiente), 3 = firma */
  pasoActivo: 1 | 2 | 3
}>()
</script>

<template>
  <div
    class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-slate-50 px-4 py-3 text-sm"
    role="list"
    aria-label="Progreso post-pago"
  >
    <span
      role="listitem"
      class="font-semibold"
      :class="pasoActivo > 1 ? 'text-emerald-700' : 'text-emerald-700'"
    >
      ✓ Matrícula
    </span>
    <span class="text-zinc-400" aria-hidden="true">→</span>
    <span
      role="listitem"
      :class="
        pasoActivo === 2
          ? 'font-bold text-[#FF5B00]'
          : pasoActivo > 2
            ? 'font-semibold text-emerald-700'
            : 'font-bold text-[#FF5B00]'
      "
    >
      <template v-if="pasoActivo > 2">✓ Arancel</template>
      <template v-else>2 Arancel</template>
    </span>
    <span class="text-zinc-400" aria-hidden="true">→</span>
    <span
      role="listitem"
      :class="pasoActivo === 3 ? 'font-bold text-[#FF5B00]' : 'text-zinc-500'"
    >
      3 Firma
    </span>
  </div>
</template>
