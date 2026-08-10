<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/composables/utils'
import { sanitizeRichTextHtml } from '@/utils/sanitizeRichTextHtml'

const props = withDefaults(
  defineProps<{
    html: string
    class?: string
  }>(),
  {
    html: '',
    class: '',
  },
)

const safeHtml = computed(() => sanitizeRichTextHtml(props.html))
</script>

<template>
  <div :class="cn('rich-text-content text-sm leading-relaxed text-zinc-800', props.class)" v-html="safeHtml" />
</template>

<style scoped>
.rich-text-content :deep(h2) {
  @apply mb-3 text-base font-semibold text-zinc-900;
}
.rich-text-content :deep(h3) {
  @apply mb-2 font-semibold text-zinc-900;
}
.rich-text-content :deep(p) {
  @apply mb-3;
}
.rich-text-content :deep(ul) {
  @apply mb-3 list-disc space-y-1 pl-5;
}
.rich-text-content :deep(ol) {
  @apply mb-3 list-decimal space-y-1 pl-5;
}
.rich-text-content :deep(a) {
  @apply text-uniacc-orange underline underline-offset-2;
}
.rich-text-content :deep(strong) {
  @apply font-semibold;
}
</style>
