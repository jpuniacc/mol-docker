<script setup lang="ts">
defineProps<{
  /**
   * Paso en foco: 1 Matrícula, 2 Arancel, 3 Firma.
   * Los anteriores a `pasoActivo` se muestran con ✓.
   */
  pasoActivo: 1 | 2 | 3
}>()
</script>

<template>
  <div
    class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-slate-50 px-4 py-3 text-sm"
    role="list"
    aria-label="Progreso matrícula, arancel y firma"
  >
    <span
      role="listitem"
      :class="
        pasoActivo === 1
          ? 'font-bold text-[#FF5B00]'
          : 'font-semibold text-emerald-700'
      "
    >
      <template v-if="pasoActivo > 1">✓ Matrícula</template>
      <template v-else>1 Matrícula</template>
    </span>
    <span class="text-zinc-400" aria-hidden="true">→</span>
    <span
      role="listitem"
      :class="
        pasoActivo === 2
          ? 'font-bold text-[#FF5B00]'
          : pasoActivo > 2
            ? 'font-semibold text-emerald-700'
            : 'text-zinc-500'
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
