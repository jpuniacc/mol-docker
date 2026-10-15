<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Hand, Loader2, Lock, User } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sanitizeUsernameInput } from '@/composables/utils'
import { runLoginFlow } from '@/services/auth'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import { useProximamenteStore } from '@/stores/proximamente'
import {
  clasificarDesbloqueo,
  guardarDesbloqueoProximamente,
  mensajeProximamenteVisible,
} from '@/utils/proximamenteGate'

const route = useRoute()
const router = useRouter()
const periodoActivo = usePeriodoActivoStore()
const proximamente = useProximamenteStore()

const username = ref('')
const password = ref('')
const loading = ref(false)

const tituloRematricula = computed(() => periodoActivo.tituloRematricula)
const mensaje = computed(() => mensajeProximamenteVisible(proximamente.mensajeVisible))

onMounted(() => {
  void periodoActivo.ensureLoaded()
  void proximamente.ensureLoaded()
})

function onUsernameModelUpdate(value: string | number | undefined) {
  username.value = sanitizeUsernameInput(String(value ?? ''))
}

async function onSubmit() {
  const u = username.value.trim()
  if (!u || !password.value) {
    toast.error('Ingresa usuario y contraseña.')
    return
  }

  loading.value = true
  try {
    const result = await runLoginFlow(
      u,
      btoa(password.value),
      typeof window !== 'undefined' ? window.location.href : null,
    )
    const desbloqueo = clasificarDesbloqueo(result)
    if (!desbloqueo.ok) {
      toast.error(desbloqueo.message)
      return
    }
    guardarDesbloqueoProximamente()
    password.value = ''
    await router.replace({ name: 'login', query: route.query })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="relative flex min-h-svh flex-col">
    <div aria-hidden="true" class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        class="absolute inset-0 scale-105 bg-cover bg-center"
        style="
          background-image: url('https://images.unsplash.com/photo-1564981797816-8373666a2217?auto=format&fit=crop&w=1920&q=80');
          filter: blur(10px);
        "
      />
      <div class="absolute inset-0 bg-black/55" />
    </div>

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
          <p class="text-lg font-bold tracking-tight text-zinc-900 md:text-xl">{{ tituloRematricula }}</p>
          <div class="mt-1 ml-auto h-1 w-24 rounded-full bg-uniacc-orange md:w-28" />
        </div>
      </div>
    </header>

    <main class="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
      <div class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div
          class="px-4 py-3 text-center text-sm font-semibold leading-snug text-white md:text-[15px]"
          style="background: linear-gradient(90deg, #ff5b00 0%, #ee2183 50%, #4d98c5 100%)"
        >
          Bienvenidos al Portal de Rematrícula para estudiantes antiguos
        </div>

        <div class="space-y-6 p-6 md:p-8">
          <div class="space-y-3 text-center">
            <p class="flex items-center justify-center gap-2 text-2xl font-semibold text-zinc-900">
              <Hand class="saludo-mano h-8 w-8 text-uniacc-orange" aria-hidden="true" />
              Hola
            </p>
            <p v-if="mensaje" class="text-base leading-relaxed text-zinc-700">
              {{ mensaje }}
            </p>
          </div>

          <form class="space-y-5" @submit.prevent="onSubmit">
            <p class="text-sm text-zinc-700">Acceso para administrativos</p>
            <div class="space-y-2">
              <Label for="proximamente-username" class="text-zinc-900">Usuario</Label>
              <div class="relative">
                <Input
                  id="proximamente-username"
                  :model-value="username"
                  type="text"
                  autocomplete="username"
                  placeholder="nombre.apellido"
                  :disabled="loading"
                  class="h-11 rounded-lg border-zinc-300 pr-10 placeholder:text-zinc-400 focus-visible:ring-uniacc-orange"
                  @update:model-value="onUsernameModelUpdate"
                />
                <User
                  class="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-zinc-400"
                  aria-hidden="true"
                />
              </div>
            </div>

            <div class="space-y-2">
              <Label for="proximamente-password" class="text-zinc-900">Contraseña</Label>
              <div class="relative">
                <Input
                  id="proximamente-password"
                  v-model="password"
                  type="password"
                  autocomplete="current-password"
                  placeholder="••••••••"
                  :disabled="loading"
                  class="h-11 rounded-lg border-zinc-300 pr-10 placeholder:text-zinc-400 focus-visible:ring-uniacc-orange"
                />
                <Lock
                  class="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-zinc-400"
                  aria-hidden="true"
                />
              </div>
            </div>

            <Button
              type="submit"
              :disabled="loading"
              class="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-uniacc-orange text-base font-semibold text-white shadow-md hover:bg-uniacc-orange/90 disabled:opacity-70"
            >
              <Loader2 v-if="loading" class="h-5 w-5 shrink-0 animate-spin" />
              {{ loading ? 'Verificando…' : 'Ingresar' }}
            </Button>
          </form>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.saludo-mano {
  transform-origin: 70% 70%;
  animation: saludo-mano 2.4s ease-in-out infinite;
}

@keyframes saludo-mano {
  0%,
  55%,
  100% {
    transform: rotate(0deg);
  }
  10%,
  30% {
    transform: rotate(16deg);
  }
  20% {
    transform: rotate(-8deg);
  }
  40% {
    transform: rotate(0deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .saludo-mano {
    animation: none;
  }
}
</style>
