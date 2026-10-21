<script setup lang="ts">
import { computed, ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Resumen = '504' | 'llego' | 'otro'

type RespuestaOk = {
  ok: true
  guardado: boolean
  resumen: Resumen
  log: unknown
}

type RespuestaError = {
  ok: false
  message: string
}

const usuario = ref('')
const clave = ref('')
const cargando = ref<'conectividad' | 'acceso' | null>(null)
const resumen = ref<Resumen | null>(null)
const guardado = ref(true)
const logTexto = ref('')
const error = ref('')
const copiado = ref(false)

const puedeAcceso = computed(() => usuario.value.trim().length > 0 && clave.value.trim().length > 0)

const textoResumen = computed(() => {
  if (resumen.value === '504') return '504'
  if (resumen.value === 'llego') return 'Llegó a IIS'
  if (resumen.value === 'otro') return 'Otro error'
  return ''
})

async function probar(modo: 'conectividad' | 'acceso'): Promise<void> {
  cargando.value = modo
  error.value = ''
  copiado.value = false
  resumen.value = null
  logTexto.value = ''
  guardado.value = true
  try {
    const cuerpo =
      modo === 'conectividad'
        ? { modo }
        : { modo, usuario: usuario.value.trim(), clave: clave.value }
    const res = await fetch('/api/auth/prueba-pixarron', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(35_000),
    })
    const data = (await res.json()) as RespuestaOk | RespuestaError
    if (!res.ok || data.ok === false) {
      error.value = data.ok === false ? data.message : 'No se pudo completar la prueba.'
      return
    }
    resumen.value = data.resumen
    guardado.value = data.guardado
    logTexto.value = JSON.stringify(data.log, null, 2)
  } catch (causa: unknown) {
    resumen.value = 'otro'
    error.value = causa instanceof Error ? causa.message : 'No se pudo completar la prueba.'
  } finally {
    cargando.value = null
  }
}

async function copiar(): Promise<void> {
  if (!logTexto.value) return
  await navigator.clipboard.writeText(logTexto.value)
  copiado.value = true
}
</script>

<template>
  <div class="relative flex min-h-svh flex-col bg-zinc-100">
    <header class="relative z-10 border-b border-zinc-200/80 bg-white shadow-sm">
      <div class="contenedor flex items-center justify-between gap-4 py-4 pr-4 pl-4 md:pr-6 md:pl-6">
        <img
          src="/Logo/logoUniaccNew.svg"
          alt="Universidad UNIACC"
          class="h-11 w-auto md:h-12"
          width="148"
          height="98"
        />
        <div class="text-right">
          <p class="text-lg font-bold tracking-tight text-zinc-900 md:text-xl">Prueba Pixarrón</p>
          <div class="mt-1 ml-auto h-1 w-24 rounded-full bg-uniacc-orange md:w-28" />
        </div>
      </div>
    </header>

    <main class="relative z-10 flex flex-1 justify-center px-4 py-8">
      <div class="w-full max-w-3xl space-y-6">
        <section class="rounded-2xl bg-white p-6 shadow-xl md:p-8">
          <h1 class="text-xl font-bold text-zinc-900">Llamados a pixarron.uniacc.cl</h1>
          <p class="mt-2 text-sm text-zinc-700">
            Esta prueba sale del servidor de mol.uniacc.cl. La clave se guarda enmascarada.
          </p>

          <div class="mt-6">
            <Button
              type="button"
              class="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-uniacc-orange px-6 font-semibold text-white hover:bg-uniacc-orange/90 disabled:opacity-70"
              :disabled="cargando !== null"
              @click="probar('conectividad')"
            >
              <Loader2 v-if="cargando === 'conectividad'" class="h-4 w-4 animate-spin" />
              Probar conectividad
            </Button>
          </div>

          <form class="mt-8 space-y-4" @submit.prevent="probar('acceso')">
            <div class="space-y-2">
              <Label for="prueba-usuario" class="text-zinc-900">Usuario</Label>
              <Input
                id="prueba-usuario"
                v-model="usuario"
                type="text"
                autocomplete="off"
                :disabled="cargando !== null"
                class="h-11 rounded-lg border-zinc-300 focus-visible:ring-uniacc-orange"
              />
            </div>
            <div class="space-y-2">
              <Label for="prueba-clave" class="text-zinc-900">Clave</Label>
              <Input
                id="prueba-clave"
                v-model="clave"
                type="password"
                autocomplete="off"
                :disabled="cargando !== null"
                class="h-11 rounded-lg border-zinc-300 focus-visible:ring-uniacc-orange"
              />
            </div>
            <Button
              type="submit"
              class="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-uniacc-orange px-6 font-semibold text-white hover:bg-uniacc-orange/90 disabled:opacity-70"
              :disabled="cargando !== null || !puedeAcceso"
            >
              <Loader2 v-if="cargando === 'acceso'" class="h-4 w-4 animate-spin" />
              Probar acceso
            </Button>
          </form>
        </section>

        <section
          v-if="error || resumen || logTexto"
          class="rounded-2xl bg-white p-6 shadow-xl md:p-8"
          aria-live="polite"
        >
          <h2 class="text-lg font-bold text-zinc-900">Resultado</h2>
          <p v-if="textoResumen" class="mt-3 text-2xl font-semibold text-zinc-900">{{ textoResumen }}</p>
          <p v-if="error" class="mt-3 text-sm text-red-700">{{ error }}</p>
          <p v-if="logTexto && !guardado" class="mt-3 text-sm text-red-700">No quedó guardado en el archivo.</p>
          <div v-if="logTexto" class="mt-4">
            <div class="mb-2 flex items-center justify-between gap-3">
              <p class="text-sm font-medium text-zinc-800">Log</p>
              <Button
                type="button"
                variant="outline"
                class="cursor-pointer rounded-full border-uniacc-orange text-uniacc-orange hover:bg-uniacc-orange/10"
                @click="copiar"
              >
                {{ copiado ? 'Copiado' : 'Copiar log' }}
              </Button>
            </div>
            <pre class="max-h-[32rem] overflow-auto rounded-lg bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-100">{{ logTexto }}</pre>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>
