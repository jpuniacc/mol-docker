<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sanitizeUsernameInput } from '@/composables/utils'
import {
  MSG_ACCESO_MNP_NO_VIGENTE,
  MSG_ACCESO_MNP_VERIFICACION_FALLIDA,
  TITULO_ACCESO_NO_VIGENTE,
} from '@/constants/accesoMnp'
import { registrarIntentoNoVigente, tomarAvisoNoVigente } from '@/services/accesoNoVigenteApi'
import {
  TYC_RECHAZO_MODAL_ENTENDIDO,
  TYC_RECHAZO_MODAL_MENSAJE,
  TYC_RECHAZO_MODAL_TITULO,
} from '@/constants/terminosCondicionesMol'
import { runLoginFlow } from '@/services/auth'
import { useAuthStore } from '@/stores/auth'
import { useDatosAlumnoMnpStore } from '@/stores/datosAlumnoMnp'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import { FileText, Loader2, Lock, User } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const periodoActivo = usePeriodoActivoStore()
const tituloRematricula = computed(() => periodoActivo.tituloRematricula)

const username = ref('')
const password = ref('')
const loading = ref(false)
const modalTyCRechazadoOpen = ref(false)
const modalNoVigenteOpen = ref(false)
const mensajeNoVigente = ref('')

function syncModalTyCRechazado() {
  modalTyCRechazadoOpen.value = route.query.tycRechazado === '1'
}

onMounted(() => {
  syncModalTyCRechazado()
  const aviso = tomarAvisoNoVigente()
  if (aviso) {
    mensajeNoVigente.value = aviso
    modalNoVigenteOpen.value = true
  }
  void periodoActivo.ensureLoaded()
})

watch(
  () => route.query.tycRechazado,
  () => syncModalTyCRechazado(),
)

function cerrarModalTyCRechazado() {
  modalTyCRechazadoOpen.value = false
  if (route.query.tycRechazado === '1') {
    void router.replace({ name: 'login' })
  }
}

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
      btoa(password.value),           // password en Base64
      typeof window !== 'undefined' ? window.location.href : null
    )
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    await auth.loginFromFlow(result, typeof window !== 'undefined' ? window.location.href : null)
    const alumnoMnp = useDatosAlumnoMnpStore()
    await alumnoMnp.fetchSiSinMvUsuario(result.localPart, Boolean(result.mvUsuario))

    if (!result.mvUsuario) {
      if (alumnoMnp.error) {
        toast.error(MSG_ACCESO_MNP_VERIFICACION_FALLIDA)
        auth.logout()
        return
      }
      if (alumnoMnp.accesoBloqueadoNoVigente) {
        const filas = [...alumnoMnp.filas]
        mensajeNoVigente.value = await registrarIntentoNoVigente(filas)
        tomarAvisoNoVigente()
        modalNoVigenteOpen.value = true
        auth.logout()
        return
      }
      if (alumnoMnp.filas.length === 0) {
        toast.error(MSG_ACCESO_MNP_NO_VIGENTE)
        auth.logout()
        return
      }
    }

    password.value = ''
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard/home'
    await router.replace(redirect || '/dashboard/home')
    toast.success('Sesión iniciada')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="relative flex min-h-svh flex-col">
    <!-- Fondo: imagen difuminada + velo oscuro -->
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

    <!-- Barra superior -->
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

    <!-- Tarjeta de login -->
    <main class="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
      <div class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div
          class="px-4 py-3 text-center text-sm font-semibold leading-snug text-white md:text-[15px]"
          style="background: linear-gradient(90deg, #ff5b00 0%, #ee2183 50%, #4d98c5 100%)"
        >
          Bienvenidos al Portal de Rematrícula para estudiantes antiguos
        </div>

        <div class="space-y-6 p-6 md:p-8">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-xs text-zinc-700 md:text-sm">
              Ingresa tu usuario institucional y contraseña (*)
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="shrink-0 gap-1.5 rounded-full border-uniacc-orange text-uniacc-orange hover:bg-uniacc-orange/10 hover:text-uniacc-orange"
            >
              <FileText class="h-4 w-4" />
              Guía
            </Button>
          </div>

          <form class="space-y-5" @submit.prevent="onSubmit">
            <div class="space-y-2">
              <Label for="login-username" class="text-zinc-900">Usuario</Label>
              <div class="relative">
                <Input
                  id="login-username"
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
              <Label for="login-password" class="text-zinc-900">Contraseña (*)</Label>
              <div class="relative">
                <Input
                  id="login-password"
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
              class="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-uniacc-orange text-base font-semibold text-white shadow-md hover:bg-uniacc-orange/90 disabled:opacity-70"
            >
              <Loader2 v-if="loading" class="h-5 w-5 shrink-0 animate-spin" />
              {{ loading ? 'Verificando…' : 'Ingresar' }}
            </Button>
          </form>

<!--           <p class="text-center text-sm text-zinc-700">
            ¿Deseas retomar tus estudios?
            <a
              href="#"
              class="font-medium text-uniacc-orange underline-offset-2 hover:text-uniacc-magenta hover:underline"
            >
              Crea tu contraseña aquí
            </a>
          </p> -->
        </div>
      </div>
    </main>

    <Dialog :open="modalNoVigenteOpen" @update:open="(v: boolean) => (modalNoVigenteOpen = v)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ TITULO_ACCESO_NO_VIGENTE }}</DialogTitle>
          <DialogDescription>
            {{ mensajeNoVigente }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            class="cursor-pointer bg-uniacc-orange hover:bg-uniacc-orange/90"
            @click="modalNoVigenteOpen = false"
          >
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="modalTyCRechazadoOpen" @update:open="(v: boolean) => (v ? (modalTyCRechazadoOpen = true) : cerrarModalTyCRechazado())">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ TYC_RECHAZO_MODAL_TITULO }}</DialogTitle>
          <DialogDescription>
            {{ TYC_RECHAZO_MODAL_MENSAJE }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            class="bg-uniacc-orange hover:bg-uniacc-orange/90"
            @click="cerrarModalTyCRechazado"
          >
            {{ TYC_RECHAZO_MODAL_ENTENDIDO }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
