<script setup lang="ts">
import { TriangleAlert } from 'lucide-vue-next' // iconos

const props = defineProps<{
  message: string
  customCode: number
  statusCode: number
  isCustomError: boolean
}>()

const error = ref({
  code: 500,
  msg: 'Algo salió mal',
})

if (props.isCustomError) {
  error.value.code = props.customCode
  error.value.msg = props.message
}

if (props.statusCode === 406) {
  error.value.code = 404
  error.value.msg = 'Esta página no existe'
}

console.error(props.message)
</script>

<template>
  <div>
    <TriangleAlert class="error__icon mx-auto" :size="100" />
    <h1 class="error__code">{{ error.code }}</h1>
    <h1 class="error__msg">{{ error.msg }}</h1>
    <div class="error-footer">
      <p class="error-footer__text">
        Este error quedó registrado en la base de datos para su posterior revision.
      </p>
      <RouterLink :to="{ name: 'dashboard' }">
        <Button class="max-w-36"> Volver al libro </Button>
      </RouterLink>
    </div>
  </div>
</template>
