import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'
import { toast } from 'vue-sonner'

import {
  MSG_ACCESO_MNP_NO_VIGENTE,
  MSG_ACCESO_MNP_VERIFICACION_FALLIDA,
} from '@/constants/accesoMnp'
import {
  allowedRouteNamesFromMenu,
  routeNameAllowedByMenu,
} from '@/views/dashboard/layout/buildDashboardMenu'
import { useAuthStore } from '@/stores/auth'
import { useDashboardMenuStore } from '@/stores/dashboardMenu'
import { useDatosAlumnoMnpStore } from '@/stores/datosAlumnoMnp'
import { useMockMatriculaContextStore } from '@/stores/mockMatriculaContext'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import { useContactoOtpConfigStore } from '@/stores/contactoOtpConfig'

const MOCK_SELECCION_ROUTE = 'matricula-mock-seleccion-alumno'
const MOCK_DATOS_ROUTE = 'matricula-mock-datos'

function isMockFlowRoute(name: string | symbol | null | undefined): boolean {
  if (typeof name !== 'string') return false
  return name.startsWith('matricula-mock-') && name !== MOCK_SELECCION_ROUTE
}

function routeRequiresAdminAdmision(to: RouteLocationNormalized): boolean {
  return to.matched.some((r) => r.meta?.requiresAdminAdmision === true)
}

function routeRequiresGrupoTI(to: RouteLocationNormalized): boolean {
  return to.matched.some((r) => r.meta?.requiresGrupoTI === true)
}

function routeRequiresSoloGrupoDvU(to: RouteLocationNormalized): boolean {
  return to.matched.some((r) => r.meta?.requiresSoloGrupoDvU === true)
}

function routeRequiresPerfilUsuarioIn(to: RouteLocationNormalized): number[] | null {
  for (let i = to.matched.length - 1; i >= 0; i--) {
    const raw = to.matched[i]?.meta?.requiresPerfilUsuarioIn
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
    }
  }
  return null
}

const routes = [
  {
    path: '/',
    name: 'home',
    redirect: '/login',
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/auth/LoginView.vue'),
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../views/dashboard/layout/DashboardView.vue'),
    redirect: '/dashboard/home',
    children: [
      {
        path: '/dashboard/home',
        name: 'dashboard-home',
        component: () => import('../views/dashboard/home/HomeView.vue'),
      },
      {
        path: 'matricula-mock',
        component: () => import('../views/matricula-mock/MatriculaMockLayout.vue'),
        redirect: { name: MOCK_SELECCION_ROUTE },
        children: [
          {
            path: 'seleccion-alumno',
            name: MOCK_SELECCION_ROUTE,
            component: () =>
              import('../views/matricula-mock/MatriculaMockSeleccionAlumnoView.vue'),
          },
          {
            path: 'datos-personales',
            name: 'matricula-mock-datos',
            component: () => import('../views/matricula-mock/DatosPersonalesMockView.vue'),
          },
          {
            path: 'forma-pago',
            name: 'matricula-mock-forma-pago',
            component: () => import('../views/matricula-mock/FormaPagoMockView.vue'),
          },
          {
            path: 'firma',
            name: 'matricula-mock-firma',
            component: () => import('../views/matricula-mock/FirmaMockView.vue'),
          },
          {
            path: 'resumen',
            name: 'matricula-mock-resumen',
            component: () => import('../views/matricula-mock/ResumenMockView.vue'),
          },
        ],
      },
      {
        path: '/dashboard/postulantes',
        name: 'dashboard-postulantes',
        meta: { requiresAdminAdmision: true },
        component: () => import('../views/dashboard/matricula/PostulantesView.vue'),
      },
      {
        path: '/dashboard/simulador-uso',
        name: 'dashboard-simulador-uso',
        meta: { requiresAdminAdmision: true },
        component: () => import('../views/dashboard/matricula/SimuladorUso.vue'),
      },
      {
        path: '/dashboard/mantenedor-carreras',
        name: 'dashboard-mantenedor-carreras',
        meta: {
          requiresAdminAdmision: true,
          requiresPerfilUsuarioIn: [1, 2],
        },
        component: () => import('../views/dashboard/matricula/MantenedorCarrerasView.vue'),
      },
      {
        path: '/dashboard/estado-firma-contrato',
        name: 'dashboard-estado-firma-contrato',
        meta: { requiresAdminAdmision: true },
        component: () => import('../views/dashboard/rematricula/EstadoFirmaContratoView.vue'),
      },
      {
        path: '/dashboard/matriculados',
        name: 'dashboard-matriculados',
        meta: { requiresAdminAdmision: true },
        component: () => import('../views/dashboard/rematricula/MatriculadosView.vue'),
      },
      {
        path: '/dashboard/mantenedor-periodo-activo',
        name: 'dashboard-mantenedor-periodo-activo',
        meta: {
          requiresAdminAdmision: true,
          requiresSoloGrupoDvU: true,
          requiresPerfilUsuarioIn: [1, 2, 3],
        },
        component: () =>
          import('../views/dashboard/rematricula/MantenedorPeriodoActivoView.vue'),
      },
      {
        path: '/dashboard/mantenedor-erp-sp-ambiente',
        name: 'dashboard-mantenedor-erp-sp-ambiente',
        meta: {
          requiresAdminAdmision: true,
          requiresSoloGrupoDvU: true,
          requiresPerfilUsuarioIn: [1, 2, 3],
        },
        component: () =>
          import('../views/dashboard/rematricula/MantenedorErpSpAmbienteView.vue'),
      },
      {
        path: '/dashboard/mantenedor-alumnos-matricular',
        name: 'dashboard-mantenedor-alumnos-matricular',
        meta: {
          requiresAdminAdmision: true,
          requiresSoloGrupoDvU: true,
          requiresPerfilUsuarioIn: [1, 2, 3],
        },
        component: () =>
          import('../views/dashboard/rematricula/MantenedorAlumnosMatricularView.vue'),
      },
      {
        path: '/dashboard/vista-aranceles-erp',
        name: 'dashboard-vista-aranceles-erp',
        meta: {
          requiresAdminAdmision: true,
          requiresSoloGrupoDvU: true,
          requiresPerfilUsuarioIn: [1, 2, 3],
        },
        component: () => import('../views/dashboard/rematricula/ArancelesErpView.vue'),
      },
      {
        path: '/dashboard/vista-beneficios-erp',
        name: 'dashboard-vista-beneficios-erp',
        meta: {
          requiresAdminAdmision: true,
          requiresSoloGrupoDvU: true,
          requiresPerfilUsuarioIn: [1, 2, 3],
        },
        component: () => import('../views/dashboard/rematricula/BeneficiosErpView.vue'),
      },
      {
        path: '/dashboard/vista-estado-cae-alumnos',
        name: 'dashboard-vista-estado-cae-alumnos',
        meta: {
          requiresAdminAdmision: true,
          requiresSoloGrupoDvU: true,
          requiresPerfilUsuarioIn: [1, 2, 3],
        },
        component: () => import('../views/dashboard/rematricula/EstadoCaeAlumnosErpView.vue'),
      },
      {
        path: '/dashboard/vista-cae-arancel-referencia',
        name: 'dashboard-vista-cae-arancel-referencia',
        meta: {
          requiresAdminAdmision: true,
          requiresSoloGrupoDvU: true,
          requiresPerfilUsuarioIn: [1, 2, 3],
        },
        component: () =>
          import('../views/dashboard/rematricula/CaeArancelReferenciaErpView.vue'),
      },
      {
        path: '/dashboard/mantenedor-convenios',
        name: 'dashboard-mantenedor-convenios',
        meta: {
          requiresAdminAdmision: true,
          requiresSoloGrupoDvU: true,
          requiresPerfilUsuarioIn: [1, 2, 3],
        },
        component: () =>
          import('../views/dashboard/rematricula/MantenedorConveniosView.vue'),
      },
      {
        path: '/dashboard/mantenedor-descuento-matricula-anticipada',
        name: 'dashboard-mantenedor-descuento-matricula-anticipada',
        meta: {
          requiresAdminAdmision: true,
          requiresSoloGrupoDvU: true,
          requiresPerfilUsuarioIn: [1, 2, 3],
        },
        component: () =>
          import('../views/dashboard/rematricula/MantenedorDescuentoMatriculaAnticipadaView.vue'),
      },
      {
        path: '/dashboard/mantenedor-terminos-condiciones',
        name: 'dashboard-mantenedor-terminos-condiciones',
        meta: {
          requiresAdminAdmision: true,
          requiresSoloGrupoDvU: true,
          requiresPerfilUsuarioIn: [1, 2, 3],
        },
        component: () =>
          import('../views/dashboard/rematricula/MantenedorTerminosCondicionesView.vue'),
      },
      {
        path: '/dashboard/mantenedor-contacto-otp',
        name: 'dashboard-mantenedor-contacto-otp',
        meta: {
          requiresAdminAdmision: true,
          requiresSoloGrupoDvU: true,
          requiresPerfilUsuarioIn: [1, 2, 3],
        },
        component: () =>
          import('../views/dashboard/rematricula/MantenedorContactoOtpView.vue'),
      },
      {
        path: '/dashboard/admin/menu',
        redirect: '/dashboard/backoffice/menu',
      },
      {
        path: 'backoffice',
        meta: { requiresGrupoTI: true },
        component: () => import('../views/dashboard/backoffice/BackofficeLayout.vue'),
        redirect: { name: 'dashboard-backoffice-menu' },
        children: [
          {
            path: 'menu',
            name: 'dashboard-backoffice-menu',
            component: () => import('../views/dashboard/backoffice/BoMenuMantenimientoView.vue'),
          },
          {
            path: 'usuarios',
            name: 'dashboard-backoffice-usuarios',
            component: () => import('../views/dashboard/backoffice/BoUsuariosMantenimientoView.vue'),
          },
        ],
      },
    ],
  },
  // Error 404
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/errors/NotFound.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  const datosMnp = useDatosAlumnoMnpStore()
  const needsAuth = to.path.startsWith('/dashboard')

  if (needsAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (needsAuth && auth.isAuthenticated) {
    await Promise.all([
      useDashboardMenuStore().ensureLoaded(),
      usePeriodoActivoStore().ensureLoaded(),
      useContactoOtpConfigStore().ensureLoaded(isMockFlowRoute(to.name)),
    ])
  }

  if (needsAuth && auth.isAuthenticated && routeRequiresGrupoTI(to) && !auth.esGrupoTI) {
    return { name: 'dashboard-home', replace: true }
  }

  if (needsAuth && auth.isAuthenticated && routeRequiresAdminAdmision(to)) {
    const menu = useDashboardMenuStore()
    const allowed = allowedRouteNamesFromMenu(
      menu.items,
      menu.grupoRows,
      auth.perfil?.codigo_grupo ?? null,
      auth.authSource,
    )
    if (!routeNameAllowedByMenu(to.name, allowed)) {
      return { name: 'dashboard-home', replace: true }
    }
  }

  if (needsAuth && auth.isAuthenticated && routeRequiresSoloGrupoDvU(to)) {
    const g = auth.perfil?.codigo_grupo
    // DVU (1) uso operativo; TI (3) puede entrar para soporte/pruebas (ya ve el ítem en el menú).
    if (g !== 1 && !auth.esGrupoTI) {
      return { name: 'dashboard-home', replace: true }
    }
  }

  const perfilesRequeridos = routeRequiresPerfilUsuarioIn(to)
  if (needsAuth && auth.isAuthenticated && perfilesRequeridos && perfilesRequeridos.length > 0) {
    const p = auth.perfil?.codigo_perfil_usuario
    if (p == null || !perfilesRequeridos.includes(p)) {
      return { name: 'dashboard-home', replace: true }
    }
  }

  if (
    needsAuth &&
    auth.isAuthenticated &&
    auth.authSource === 'pixarron' &&
    !datosMnp.loading &&
    datosMnp.cantidadRegistros === 0
  ) {
    toast.error(datosMnp.error ? MSG_ACCESO_MNP_VERIFICACION_FALLIDA : MSG_ACCESO_MNP_NO_VIGENTE)
    auth.logout()
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'dashboard-home', replace: true }
  }

  if (needsAuth && auth.isAuthenticated && isMockFlowRoute(to.name)) {
    const mockCtx = useMockMatriculaContextStore()
    if (!mockCtx.tieneAlumnoSeleccionado) {
      return { name: MOCK_SELECCION_ROUTE, replace: true }
    }
    if (mockCtx.apoderadoBloqueo && to.name !== MOCK_DATOS_ROUTE) {
      return { name: MOCK_DATOS_ROUTE, replace: true }
    }
  }

  return true
})

export default router
