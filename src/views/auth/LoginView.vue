<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import ModalErrorRematricula from '@/components/rematricula/ModalErrorRematricula.vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sanitizeUsernameInput } from '@/composables/utils'
import { campoLoginVacio } from '@/utils/errorRematriculaCatalogo'
import { mostrarBloqueoIngreso, mostrarFalloIngreso } from '@/stores/errorRematricula'
import {
  MSG_ACCESO_MNP_NO_VIGENTE,
  MSG_ACCESO_MNP_VERIFICACION_FALLIDA,
  MSG_SITUACION_ACADEMICA,
  TITULO_ACCESO_NO_VIGENTE,
} from '@/constants/accesoMnp'
import {
  TITULO_ARANCEL_DIFERENCIADO,
  tomarAvisoArancelDiferenciado,
} from '@/constants/arancelDiferenciado'
import {
  MSG_BECA_SUBDERE,
  TITULO_BECA_SUBDERE,
  tomarAvisoSubdere,
} from '@/constants/carteraOficial'
import {
  registrarIntentoArancelDiferenciado,
  registrarIntentoNoVigente,
  registrarIntentoSubdere,
  tomarAvisoNoVigente,
} from '@/services/accesoNoVigenteApi'
import {
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
const campoVacio = ref<'login-username' | 'login-password' | null>(null)

function cerrarModalTyCRechazado() {
  if (route.query.tycRechazado === '1') {
    void router.replace({ name: 'login' })
  }
}

function abrirTyCRechazado() {
  mostrarBloqueoIngreso({
    titulo: TYC_RECHAZO_MODAL_TITULO,
    cuerpo: TYC_RECHAZO_MODAL_MENSAJE,
    alCerrar: cerrarModalTyCRechazado,
  })
}

function abrirAvisosDeBloqueo() {
  if (route.query.tycRechazado === '1') {
    abrirTyCRechazado()
    return
  }
  if (tomarAvisoNoVigente()) {
    mostrarBloqueoIngreso({
      titulo: TITULO_ACCESO_NO_VIGENTE,
      cuerpo: MSG_SITUACION_ACADEMICA,
    })
    return
  }
  if (tomarAvisoSubdere()) {
    mostrarBloqueoIngreso({
      titulo: TITULO_BECA_SUBDERE,
      cuerpo: MSG_BECA_SUBDERE,
    })
    return
  }
  if (tomarAvisoArancelDiferenciado()) {
    mostrarBloqueoIngreso({
      titulo: TITULO_ARANCEL_DIFERENCIADO,
      cuerpo: MSG_SITUACION_ACADEMICA,
    })
  }
}

onMounted(() => {
  abrirAvisosDeBloqueo()
  void periodoActivo.ensureLoaded()
})

watch(
  () => route.query.tycRechazado,
  () => {
    if (route.query.tycRechazado === '1') abrirTyCRechazado()
  },
)

function onUsernameModelUpdate(value: string | number | undefined) {
  username.value = sanitizeUsernameInput(String(value ?? ''))
  if (username.value.trim()) campoVacio.value = null
}

async function onSubmit() {
  const vacio = campoLoginVacio(username.value, password.value)
  campoVacio.value = vacio
  if (vacio) {
    document.getElementById(vacio)?.focus()
    return
  }
  const u = username.value.trim()

  loading.value = true
  try {
    const result = await runLoginFlow(
      u,
      btoa(password.value),           // password en Base64
      typeof window !== 'undefined' ? window.location.href : null
    )
    if (!result.ok) {
      mostrarFalloIngreso(result.message)
      return
    }
    await auth.loginFromFlow(result, typeof window !== 'undefined' ? window.location.href : null)
    const alumnoMnp = useDatosAlumnoMnpStore()
    await alumnoMnp.fetchSiSinMvUsuario(result.localPart, Boolean(result.mvUsuario))

    if (!result.mvUsuario) {
      if (alumnoMnp.error) {
        mostrarFalloIngreso(MSG_ACCESO_MNP_VERIFICACION_FALLIDA)
        auth.logout()
        return
      }
      if (alumnoMnp.excluidoMol) {
        await registrarIntentoSubdere([...alumnoMnp.filas])
        auth.logout()
        mostrarBloqueoIngreso({
          titulo: TITULO_BECA_SUBDERE,
          cuerpo: MSG_BECA_SUBDERE,
        })
        return
      }
      if (alumnoMnp.accesoBloqueadoNoVigente) {
        const filas = [...alumnoMnp.filas]
        await registrarIntentoNoVigente(filas)
        tomarAvisoNoVigente()
        auth.logout()
        mostrarBloqueoIngreso({
          titulo: TITULO_ACCESO_NO_VIGENTE,
          cuerpo: MSG_SITUACION_ACADEMICA,
        })
        return
      }
      if (alumnoMnp.accesoBloqueadoArancelDiferenciado) {
        await registrarIntentoArancelDiferenciado([...alumnoMnp.filas])
        auth.logout()
        mostrarBloqueoIngreso({
          titulo: TITULO_ARANCEL_DIFERENCIADO,
          cuerpo: MSG_SITUACION_ACADEMICA,
        })
        return
      }
      if (alumnoMnp.filas.length === 0) {
        mostrarBloqueoIngreso({
          titulo: TITULO_ACCESO_NO_VIGENTE,
          cuerpo: MSG_ACCESO_MNP_NO_VIGENTE,
        })
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
              as-child
              variant="outline"
              size="sm"
              class="shrink-0 cursor-pointer gap-1.5 rounded-full border-uniacc-orange text-uniacc-orange hover:bg-uniacc-orange/10 hover:text-uniacc-orange"
            >
              <a
                href="https://www.uniacc.cl/wp-content/uploads/2026/10/Instructivo-MOL-1.pdf"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileText class="h-4 w-4" />
                Guía
              </a>
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
                  :aria-invalid="campoVacio === 'login-username'"
                  :class="[
                    'h-11 rounded-lg pr-10 placeholder:text-zinc-400 focus-visible:ring-uniacc-orange',
                    campoVacio === 'login-username' ? 'border-red-600' : 'border-zinc-300',
                  ]"
                  @update:model-value="onUsernameModelUpdate"
                />
                <User
                  class="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-zinc-400"
                  aria-hidden="true"
                />
              </div>
              <p v-if="campoVacio === 'login-username'" class="text-sm text-red-700">Ingresa tu usuario.</p>
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
                  :aria-invalid="campoVacio === 'login-password'"
                  :class="[
                    'h-11 rounded-lg pr-10 placeholder:text-zinc-400 focus-visible:ring-uniacc-orange',
                    campoVacio === 'login-password' ? 'border-red-600' : 'border-zinc-300',
                  ]"
                  @update:model-value="(v: string | number | undefined) => {
                    if (String(v ?? '') && campoVacio === 'login-password') campoVacio = null
                  }"
                />
                <Lock
                  class="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-zinc-400"
                  aria-hidden="true"
                />
              </div>
              <p v-if="campoVacio === 'login-password'" class="text-sm text-red-700">Ingresa tu contraseña.</p>
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

    <ModalErrorRematricula />
  </div>
</template>
