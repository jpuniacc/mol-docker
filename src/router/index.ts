import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'

import {
  MSG_ACCESO_MNP_NO_VIGENTE,
  MSG_ACCESO_MNP_VERIFICACION_FALLIDA,
  TITULO_ACCESO_NO_VIGENTE,
} from '@/constants/accesoMnp'
import { CORREO_BECA_SUBDERE } from '@/constants/carteraOficial'
import { mostrarBloqueoIngreso, mostrarFalloIngreso } from '@/stores/errorRematricula'
import {
  allowedRouteNamesFromMenu,
  routeNameAllowedByMenu,
} from '@/views/dashboard/layout/buildDashboardMenu'
import { useAuthStore } from '@/stores/auth'
import { useDashboardMenuStore } from '@/stores/dashboardMenu'
import { useDatosAlumnoMnpStore } from '@/stores/datosAlumnoMnp'
import { useMatriculaAlumnoContextStore } from '@/stores/matriculaAlumnoContext'
import { useMockMatriculaContextStore } from '@/stores/mockMatriculaContext'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import { useProximamenteStore } from '@/stores/proximamente'
import { useContactoOtpConfigStore } from '@/stores/contactoOtpConfig'
import {
  indicePasoAlumno,
  PASOS_ALUMNO_REMATRICULA,
  pasoMaximoAlumno,
  rutaSiEnvioFirmaBloquea,
} from '@/utils/pasoAlumnoRematricula'
import {
  leerDesbloqueoProximamente,
  redireccionProximamente,
} from '@/utils/proximamenteGate'

const MOCK_SELECCION_ROUTE = 'matricula-mock-seleccion-alumno'
const MOCK_DATOS_ROUTE = 'matricula-mock-datos'
const MOCK_FORMA_PAGO_ROUTE = 'matricula-mock-forma-pago'
const ALUMNO_DATOS_ROUTE = 'matricula-alumno-datos'
const ALUMNO_FORMA_PAGO_ROUTE = 'matricula-alumno-forma-pago'

function isMockFlowRoute(name: string | symbol | null | undefined): boolean {
  if (typeof name !== 'string') return false
  return name.startsWith('matricula-mock-') && name !== MOCK_SELECCION_ROUTE
}

function isAlumnoFlowRoute(name: string | symbol | null | undefined): boolean {
  return typeof name === 'string' && name.startsWith('matricula-alumno-')
}

/** Enlaces cortos /matricula-alumno y /matricula-mock apuntan al flujo bajo /dashboard. */
function rutaBajoDashboard(path: string): string | null {
  const limpio = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
  if (limpio === '/matricula-alumno' || limpio.startsWith('/matricula-alumno/')) {
    return `/dashboard${limpio}`
  }
  if (limpio === '/matricula-mock' || limpio.startsWith('/matricula-mock/')) {
    return `/dashboard${limpio}`
  }
  return null
}

function isSesionAlumnoRematricula(
  auth: ReturnType<typeof useAuthStore>,
  datosMnp: ReturnType<typeof useDatosAlumnoMnpStore>,
): boolean {
  return (
    auth.authSource === 'pixarron' &&
    datosMnp.cantidadRegistros > 0 &&
    !datosMnp.fueraCarteraOficial
  )
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
    path: '/proximamente',
    name: 'proximamente',
    component: () => import('../views/auth/ProximamenteView.vue'),
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
        path: 'matricula-alumno',
        component: () => import('../views/matricula-alumno/MatriculaAlumnoLayout.vue'),
        redirect: { name: ALUMNO_DATOS_ROUTE },
        children: [
          {
            path: 'datos-personales',
            name: ALUMNO_DATOS_ROUTE,
            component: () => import('../views/matricula-alumno/DatosPersonalesAlumnoView.vue'),
          },
          {
            path: 'forma-pago',
            name: 'matricula-alumno-forma-pago',
            component: () => import('../views/matricula-alumno/FormaPagoAlumnoView.vue'),
          },
          {
            path: 'firma',
            name: 'matricula-alumno-firma',
            component: () => import('../views/matricula-alumno/FirmaAlumnoView.vue'),
          },
          {
            path: 'resumen',
            name: 'matricula-alumno-resumen',
            component: () => import('../views/matricula-alumno/ResumenAlumnoView.vue'),
          },
          {
            path: 'webpay/retorno',
            name: 'matricula-alumno-webpay-retorno',
            component: () => import('../views/matricula-alumno/WebpayRetornoAlumnoView.vue'),
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
        path: '/dashboard/mantenedor-desbloqueo-toma-ramos',
        name: 'dashboard-mantenedor-desbloqueo-toma-ramos',
        meta: {
          requiresAdminAdmision: true,
          requiresSoloGrupoDvU: true,
          requiresPerfilUsuarioIn: [1, 2, 3],
        },
        component: () =>
          import('../views/dashboard/rematricula/MantenedorDesbloqueoTomaRamosView.vue'),
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
        path: '/dashboard/mantenedor-convenios-excel',
        name: 'dashboard-mantenedor-convenios-excel',
        meta: {
          requiresAdminAdmision: true,
          requiresSoloGrupoDvU: true,
          requiresPerfilUsuarioIn: [1, 2, 3],
        },
        component: () =>
          import('../views/dashboard/rematricula/MantenedorConveniosExcelView.vue'),
      },
      {
        path: '/dashboard/casos-rematricula',
        name: 'dashboard-casos-rematricula',
        meta: {
          requiresAdminAdmision: true,
          requiresSoloGrupoDvU: true,
          requiresPerfilUsuarioIn: [1, 2, 3],
        },
        component: () =>
          import('../views/dashboard/rematricula/CasosRematriculaView.vue'),
      },
      {
        path: '/dashboard/rematricula-kpi',
        name: 'dashboard-rematricula-kpi',
        meta: {
          requiresAdminAdmision: true,
          requiresSoloGrupoDvU: true,
          requiresPerfilUsuarioIn: [1, 2, 3],
        },
        component: () =>
          import('../views/dashboard/rematricula/RematriculaKpiView.vue'),
      },
      {
        path: '/dashboard/rematricula-seguimiento',
        name: 'dashboard-rematricula-seguimiento',
        meta: {
          requiresAdminAdmision: true,
          requiresSoloGrupoDvU: true,
          requiresPerfilUsuarioIn: [1, 2, 3],
        },
        component: () =>
          import('../views/dashboard/rematricula/RematriculaSeguimientoView.vue'),
      },
      {
        path: '/dashboard/encuesta-discapacidad',
        name: 'dashboard-encuesta-discapacidad',
        meta: {
          requiresAdminAdmision: true,
          requiresSoloGrupoDvU: true,
          requiresPerfilUsuarioIn: [1, 2, 3],
        },
        component: () =>
          import('../views/dashboard/rematricula/EncuestaDiscapacidadView.vue'),
      },
      {
        path: '/dashboard/gestion-firmas',
        name: 'dashboard-gestion-firmas',
        meta: {
          requiresAdminAdmision: true,
          requiresSoloGrupoDvU: true,
          requiresPerfilUsuarioIn: [1, 2, 3],
        },
        component: () =>
          import('../views/dashboard/rematricula/GestionFirmasView.vue'),
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
        path: '/dashboard/mantenedor-proximamente',
        name: 'dashboard-mantenedor-proximamente',
        meta: {
          requiresAdminAdmision: true,
          requiresSoloGrupoDvU: true,
          requiresPerfilUsuarioIn: [1, 2, 3],
        },
        component: () =>
          import('../views/dashboard/rematricula/MantenedorProximamenteView.vue'),
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
  const canonica = rutaBajoDashboard(to.path)
  if (canonica) {
    return { path: canonica, query: to.query, hash: to.hash, replace: true }
  }

  const needsAuth = to.path.startsWith('/dashboard')

  if (!auth.isAuthenticated && to.name === 'NotFound') {
    return { name: 'login', replace: true }
  }

  if (needsAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (needsAuth && auth.isAuthenticated) {
    await Promise.all([
      useDashboardMenuStore().ensureLoaded(),
      usePeriodoActivoStore().ensureLoaded(),
      useContactoOtpConfigStore().ensureLoaded(
        isMockFlowRoute(to.name) || isAlumnoFlowRoute(to.name),
      ),
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
    if (datosMnp.error) {
      mostrarFalloIngreso(MSG_ACCESO_MNP_VERIFICACION_FALLIDA)
    } else {
      mostrarBloqueoIngreso({
        titulo: TITULO_ACCESO_NO_VIGENTE,
        cuerpo: MSG_ACCESO_MNP_NO_VIGENTE,
        correo: CORREO_BECA_SUBDERE,
      })
    }
    auth.logout()
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (
    needsAuth &&
    auth.isAuthenticated &&
    auth.authSource === 'pixarron' &&
    datosMnp.fueraCarteraOficial &&
    (isMockFlowRoute(to.name) ||
      to.name === MOCK_SELECCION_ROUTE ||
      isAlumnoFlowRoute(to.name))
  ) {
    return { name: 'dashboard-home', replace: true }
  }

  if (to.name === 'login' || to.name === 'home' || to.name === 'proximamente') {
    if (auth.isAuthenticated) {
      return { name: 'dashboard-home', replace: true }
    }
    const proximamente = useProximamenteStore()
    await proximamente.ensureLoaded()
    const destino = redireccionProximamente({
      routeName: typeof to.name === 'string' ? to.name : null,
      activo: proximamente.activoEfectivo,
      desbloqueado: leerDesbloqueoProximamente(),
    })
    if (destino) {
      return { name: destino, query: to.query, replace: true }
    }
  }

  // Pixarron → flujo alumno; bloquear mock. Staff → flujo mock; bloquear alumno.
  if (needsAuth && auth.isAuthenticated) {
    const alumnoOk = isSesionAlumnoRematricula(auth, datosMnp)
    if (alumnoOk && (isMockFlowRoute(to.name) || to.name === MOCK_SELECCION_ROUTE)) {
      return { name: ALUMNO_DATOS_ROUTE, replace: true }
    }
    if (!alumnoOk && isAlumnoFlowRoute(to.name)) {
      return {
        name: auth.authSource === 'pixarron' ? 'dashboard-home' : MOCK_SELECCION_ROUTE,
        replace: true,
      }
    }
  }

  if (needsAuth && auth.isAuthenticated && isMockFlowRoute(to.name)) {
    const mockCtx = useMockMatriculaContextStore()
    if (!mockCtx.tieneAlumnoSeleccionado) {
      return { name: MOCK_SELECCION_ROUTE, replace: true }
    }
    if (mockCtx.apoderadoBloqueo && to.name !== MOCK_DATOS_ROUTE) {
      return { name: MOCK_DATOS_ROUTE, replace: true }
    }
    if (
      (mockCtx.convenioCertificadoBloqueo ||
        mockCtx.estatalBloqueo ||
        mockCtx.promedioBloqueo) &&
      to.name !== MOCK_DATOS_ROUTE &&
      to.name !== MOCK_FORMA_PAGO_ROUTE
    ) {
      return { name: MOCK_FORMA_PAGO_ROUTE, replace: true }
    }
    if (to.name === 'matricula-mock-resumen' && !mockCtx.firmaCompletada) {
      return { name: 'matricula-mock-firma', replace: true }
    }
  }

  if (needsAuth && auth.isAuthenticated && isAlumnoFlowRoute(to.name)) {
    const alumnoCtx = useMatriculaAlumnoContextStore()
    if (
      alumnoCtx.firmaCompletada &&
      to.name !== 'matricula-alumno-resumen' &&
      to.name !== 'matricula-alumno-webpay-retorno'
    ) {
      return { name: 'matricula-alumno-resumen', replace: true }
    }
    const firmaBloqueada = rutaSiEnvioFirmaBloquea(alumnoCtx.envioFirmaIniciado, to.name)
    if (firmaBloqueada) {
      return { name: firmaBloqueada, replace: true }
    }
    if (
      alumnoCtx.apoderadoBloqueo &&
      to.name !== ALUMNO_DATOS_ROUTE &&
      to.name !== 'matricula-alumno-webpay-retorno'
    ) {
      return { name: ALUMNO_DATOS_ROUTE, replace: true }
    }
    if (
      (alumnoCtx.convenioCertificadoBloqueo ||
        alumnoCtx.estatalBloqueo ||
        alumnoCtx.promedioBloqueo) &&
      to.name !== ALUMNO_DATOS_ROUTE &&
      to.name !== ALUMNO_FORMA_PAGO_ROUTE &&
      to.name !== 'matricula-alumno-webpay-retorno'
    ) {
      return { name: ALUMNO_FORMA_PAGO_ROUTE, replace: true }
    }
    const destino = indicePasoAlumno(to.name)
    if (destino > 0) {
      const maximo = pasoMaximoAlumno(alumnoCtx)
      if (destino > maximo) {
        return { name: PASOS_ALUMNO_REMATRICULA[maximo - 1], replace: true }
      }
    }
  }

  return true
})

export default router
