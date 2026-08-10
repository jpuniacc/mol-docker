<script setup lang="ts">
import { cn } from '@/composables/utils'
import { TabsList, type TabsListProps } from 'radix-vue'
import { computed, type HTMLAttributes } from 'vue'

const props = defineProps<TabsListProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props

  return delegated
})
</script>

<template>
  <div class="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
    <TabsList
      v-bind="delegatedProps"
      :class="cn(
        'inline-flex items-center justify-center rounded-md bg-muted p-1 text-muted-foreground min-w-max md:min-w-0',
        props.class,
      )"
    >
      <slot />
    </TabsList>
  </div>
</template>
