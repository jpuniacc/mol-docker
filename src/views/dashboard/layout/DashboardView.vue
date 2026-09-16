<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { useSessionCloseBeacon } from '@/composables/useSessionCloseBeacon'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import { LogOut } from 'lucide-vue-next'
import DashboardSidebarNav from './DashboardSidebarNav.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const appStore = useAppStore()
const periodoActivo = usePeriodoActivoStore()

useSessionCloseBeacon()

const isMatriculaMock = computed(() => route.path.includes('/matricula-mock'))

const tituloRematriculaCabecera = computed(() => periodoActivo.tituloRematricula)

function logout() {
  auth.logout()
  void router.replace({ name: 'login' })
  toast.message('Sesión cerrada')
}
</script>

<template>
  <RouterView v-if="isMatriculaMock" />

  <SidebarProvider v-else class="min-h-svh">
    <DashboardSidebarNav />
    <SidebarInset class="bg-zinc-50/80">
      <header class="shrink-0 border-b border-zinc-200 bg-white shadow-sm">
        <div
          class="contenedor flex flex-wrap items-center gap-3 py-3 pr-4 pl-4 md:gap-4 md:py-4 md:pr-6 md:pl-6"
        >
          <div class="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
            <SidebarTrigger class="text-zinc-700" />
            <div class="min-w-0 sm:hidden">
              <p class="truncate text-xs font-medium text-zinc-600">{{ tituloRematriculaCabecera }}</p>
            </div>
            <div class="hidden min-w-0 sm:block">
              <p class="truncate text-sm font-semibold text-zinc-900">
                {{ appStore.appName }}
              </p>
              <p class="truncate text-xs text-zinc-500">{{ tituloRematriculaCabecera }}</p>
            </div>
          </div>
          <div class="hidden flex-shrink-0 text-right md:block">
            <p class="text-lg font-bold tracking-tight text-zinc-900 md:text-xl">
              {{ tituloRematriculaCabecera }}
            </p>
            <div class="mt-1 ml-auto h-1 w-20 rounded-full bg-uniacc-orange md:w-28" />
          </div>
          <div class="flex w-full flex-shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto md:gap-3">
            <p
              class="hidden max-w-[200px] truncate text-xs text-zinc-600 md:max-w-[240px] md:text-sm"
              :title="auth.displayNombreCompleto || auth.username || undefined"
            >
              {{ auth.displayNombreCompleto }}
            </p>
            <p class="hidden text-xs text-zinc-500 lg:block lg:text-sm">
              {{
                new Date().toLocaleDateString('es-ES', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              }}
            </p>
            <Button variant="outline" size="sm" class="gap-1.5 border-zinc-300" @click="logout">
              <LogOut class="h-4 w-4" />
              <span class="hidden sm:inline">Salir</span>
            </Button>
          </div>
        </div>
      </header>

      <div class="flex min-h-0 flex-1 flex-col">
        <div class="contenedor flex-1 px-4 py-6 md:px-6">
          <RouterView v-slot="{ Component, route }">
            <Transition name="fade" mode="out-in">
              <div :key="route.fullPath" class="min-h-0 flex-1">
                <component :is="Component" />
              </div>
            </Transition>
          </RouterView>
        </div>
        <footer class="shrink-0 border-t border-zinc-200 bg-white py-4">
          <div class="contenedor px-4 text-center text-sm text-zinc-500 md:px-6">
            {{ appStore.appName }} &copy; {{ new Date().getFullYear() }} · UNIACC
          </div>
        </footer>
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
