/**
 * @deprecated El menú lateral se arma desde BD (`bo_menu_item`) vía
 * `buildDashboardMenuPlan` en `./buildDashboardMenu.ts` y el store `dashboardMenu`.
 * Se conserva este archivo como reexport para imports antiguos.
 */
export {
  buildDashboardMenuPlan,
  esLinkActivoDashboard,
  allowedRouteNamesFromMenu,
  routeNameAllowedByMenu,
} from './buildDashboardMenu'

export type {
  DashboardNavLinkResolved,
  DashboardNavGroupResolved,
  DashboardNavPlanResolved,
} from './buildDashboardMenu'
