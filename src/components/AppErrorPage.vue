<script setup lang="ts">
import Card from './ui/card/Card.vue'
import CardContent from './ui/card/CardContent.vue'

const errorStore = useErrorStore()

const message = ref('')
const customCode = ref(0)
const details = ref('')
const code = ref('')
const hint = ref('')
const statusCode = ref(0)

const error = ref(errorStore.activeError)

if (error.value && !('code' in error.value)) {
  message.value = error.value.message
  customCode.value = error.value.customCode ?? 0
}

if (error.value && 'code' in error.value) {
  message.value = error.value.message
  details.value = error.value.details
  hint.value = error.value.hint
  code.value = error.value.code
  statusCode.value = error.value.statusCode ?? 0
}

// const ErrorTemplate = import.meta.env.DEV
//   ? defineAsyncComponent(() => import('@/components/AppErrorDevSection.vue'))
//   : defineAsyncComponent(() => import('@/components/AppErrorProdSection.vue'))

const ErrorTemplate = defineAsyncComponent(() => import('@/components/AppErrorDevSection.vue'))
</script>

<template>
  <div class="flex-1 space-y-3 px-4 py-8 pt-3">
    <Transition name="fade" mode="out-in">
      <Card>
        <CardContent>
          <main class="contenedor flex-1 space-y-3 px-4 py-8 pt-3">
            <section class="error">
              <ErrorTemplate
                :message
                :customCode
                :code
                :statusCode
                :hint
                :details
                :isCustomError="errorStore.isCustomError"
              />
            </section>
          </main>
        </CardContent>
      </Card>
    </Transition>
  </div>
</template>

<style scoped>
.error {
  @apply mx-auto -mt-20 flex min-h-[90vh] flex-1 items-center justify-center p-10 text-center;
}

:deep(.error__icon) {
  @apply text-7xl text-destructive;
}

:deep(.error__code) {
  @apply text-7xl font-extrabold text-primary;
}

:deep(.error__msg) {
  @apply text-3xl font-extrabold text-primary;
}

:deep(.error)-footer {
  @apply mt-6 flex flex-col items-center justify-center gap-5 font-light;
}

:deep(.error)-footer__text {
  @apply text-lg text-muted-foreground;
}

p {
  @apply my-2;
}
</style>
