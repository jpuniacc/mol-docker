<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'radix-vue'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { useAuthStore } from '@/stores/auth'
import { useDashboardMenuStore } from '@/stores/dashboardMenu'
import { AlertCircle, ChevronRight, Loader2 } from 'lucide-vue-next'
import { boMenuDebugEnabled, boMenuLog } from '@/utils/boMenuDebug'
import { buildDashboardMenuPlan, esLinkActivoDashboard } from './buildDashboardMenu'

const route = useRoute()
const auth = useAuthStore()
const menuStore = useDashboardMenuStore()
const { isMobile, setOpenMobile, state } = useSidebar()
const retryingMenu = ref(false)

const navPlan = computed(() =>
  buildDashboardMenuPlan(
    menuStore.items,
    menuStore.grupoRows,
    auth.perfil?.codigo_grupo ?? null,
    auth.authSource,
  ),
)

const isIconCollapsedDesktop = computed(() => state.value === 'collapsed' && !isMobile.value)

const menuVacio = computed(
  () =>
    menuStore.fetched &&
    !menuStore.loadError &&
    navPlan.value.topLinks.length === 0 &&
    navPlan.value.groups.length === 0,
)

const menuFallo = computed(() => Boolean(menuStore.loadError) || menuVacio.value)

const menuFalloMensaje = computed(() => {
  if (menuStore.loadError) return menuStore.loadError
  if (menuVacio.value) {
    return 'No hay ítems de menú configurados o visibles para tu perfil.'
  }
  return ''
})

async function reintentarMenu() {
  retryingMenu.value = true
  try {
    await menuStore.refetch()
  } finally {
    retryingMenu.value = false
  }
}

watchEffect(() => {
  if (!boMenuDebugEnabled) return
  const plan = navPlan.value
  boMenuLog('[sidebar] sesión + plan resuelto', {
    routeName: route.name,
    username: auth.username,
    email: auth.email,
    authSource: auth.authSource,
    perfil: auth.perfil,
    esGrupoTI: auth.esGrupoTI,
    menuFetched: menuStore.fetched,
    menuLoadError: menuStore.loadError,
    itemsCount: menuStore.items.length,
    grupoRowsCount: menuStore.grupoRows.length,
    navTopLinks: plan.topLinks.length,
    navGroups: plan.groups.length,
  })
})

function onNavClick() {
  if (isMobile.value) setOpenMobile(false)
}
</script>

<template>
  <Sidebar collapsible="icon" variant="inset" class="border-r border-sidebar-border">
    <SidebarHeader class="border-b border-sidebar-border px-2 py-3">
      <RouterLink
        :to="{ name: 'dashboard-home' }"
        class="flex items-center justify-center overflow-hidden rounded-md px-1 py-1 outline-none ring-sidebar-ring transition-colors hover:bg-sidebar-accent focus-visible:ring-2"
        title="Inicio"
        @click="onNavClick"
      >
        <img
          src="/Logo/logoUniaccNew.svg"
          alt="Universidad UNIACC"
          class="h-9 w-auto max-w-full shrink-0 object-contain md:h-10"
          width="148"
          height="98"
        />
      </RouterLink>
    </SidebarHeader>
    <SidebarContent>
      <div v-if="menuFallo" class="px-2 py-2">
        <Alert variant="destructive" class="text-xs">
          <AlertCircle class="size-4" />
          <AlertTitle class="text-xs">Menú no disponible</AlertTitle>
          <AlertDescription class="space-y-2 text-xs">
            <p>{{ menuFalloMensaje }}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="h-7 w-full border-destructive/40 text-xs"
              :disabled="retryingMenu"
              @click="reintentarMenu"
            >
              <Loader2 v-if="retryingMenu" class="mr-1 size-3 animate-spin" />
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      </div>
      <SidebarGroup>
        <SidebarGroupLabel class="group-data-[collapsible=icon]:sr-only">Menú</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in navPlan.topLinks" :key="item.routeName">
              <SidebarMenuButton
                as-child
                :is-active="esLinkActivoDashboard(item.routeName, route.name)"
                :tooltip="item.label"
              >
                <RouterLink :to="{ name: item.routeName }" @click="onNavClick">
                  <component :is="item.icon" class="size-4 shrink-0" />
                  <span>{{ item.label }}</span>
                </RouterLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup v-for="section in navPlan.groups" :key="section.id">
        <SidebarGroupLabel class="group-data-[collapsible=icon]:sr-only">
          {{ section.label }}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <template v-for="item in section.children" :key="item.kind === 'link' ? item.routeName : item.id">
              <SidebarMenuItem v-if="item.kind === 'link'">
                <SidebarMenuButton
                  as-child
                  :is-active="esLinkActivoDashboard(item.routeName, route.name)"
                  :tooltip="item.label"
                >
                  <RouterLink :to="{ name: item.routeName }" @click="onNavClick">
                    <component :is="item.icon" class="size-4 shrink-0" />
                    <span>{{ item.label }}</span>
                  </RouterLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem v-else-if="isIconCollapsedDesktop">
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <SidebarMenuButton :tooltip="item.label">
                      <component :is="item.icon" class="size-4 shrink-0" />
                      <span>{{ item.label }}</span>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" class="min-w-56">
                    <DropdownMenuItem
                      v-for="sub in item.children"
                      :key="sub.routeName"
                      as-child
                    >
                      <RouterLink
                        :to="{ name: sub.routeName }"
                        class="flex w-full items-center gap-2"
                        @click="onNavClick"
                      >
                        <component :is="sub.icon" class="size-4 shrink-0" />
                        <span>{{ sub.label }}</span>
                      </RouterLink>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
              <CollapsibleRoot v-else as-child default-open class="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger as-child>
                    <SidebarMenuButton :tooltip="item.label">
                      <component :is="item.icon" class="size-4 shrink-0" />
                      <span>{{ item.label }}</span>
                      <ChevronRight
                        class="ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent
                    class="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"
                  >
                    <SidebarMenuSub>
                      <SidebarMenuSubItem v-for="sub in item.children" :key="sub.routeName">
                        <SidebarMenuSubButton as-child :is-active="esLinkActivoDashboard(sub.routeName, route.name)">
                          <RouterLink :to="{ name: sub.routeName }" @click="onNavClick">
                            <component :is="sub.icon" class="size-4 shrink-0" />
                            <span>{{ sub.label }}</span>
                          </RouterLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </CollapsibleRoot>
            </template>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
    <SidebarRail />
  </Sidebar>
</template>
