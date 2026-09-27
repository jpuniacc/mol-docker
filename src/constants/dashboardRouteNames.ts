/**
 * Nombres de ruta válidos para enlaces del menú del dashboard (deben existir en el router).
 */
export const DASHBOARD_MENU_ROUTE_NAMES = [
  'dashboard-home',
  'matricula-mock-seleccion-alumno',
  'matricula-mock-datos',
  'matricula-mock-forma-pago',
  'matricula-mock-firma',
  'matricula-mock-resumen',
  'matricula-alumno-datos',
  'matricula-alumno-forma-pago',
  'matricula-alumno-firma',
  'matricula-alumno-resumen',
  'dashboard-postulantes',
  'dashboard-simulador-uso',
  'dashboard-estado-firma-contrato',
  'dashboard-matriculados',
  'dashboard-mantenedor-carreras',
  'dashboard-mantenedor-periodo-activo',
  'dashboard-mantenedor-erp-sp-ambiente',
  'dashboard-mantenedor-alumnos-matricular',
  'dashboard-vista-aranceles-erp',
  'dashboard-vista-beneficios-erp',
  'dashboard-vista-estado-cae-alumnos',
  'dashboard-vista-cae-arancel-referencia',
  'dashboard-mantenedor-convenios',
  'dashboard-mantenedor-convenios-excel',
  'dashboard-casos-rematricula',
  'dashboard-rematricula-kpi',
  'dashboard-rematricula-seguimiento',
  'dashboard-gestion-firmas',
  'dashboard-mantenedor-descuento-matricula-anticipada',
  'dashboard-mantenedor-terminos-condiciones',
  'dashboard-backoffice-menu',
  'dashboard-backoffice-usuarios',
] as const

export type DashboardMenuRouteName = (typeof DASHBOARD_MENU_ROUTE_NAMES)[number]

export function isValidDashboardMenuRouteName(
  name: string | null | undefined,
): name is DashboardMenuRouteName {
  if (!name) return false
  return (DASHBOARD_MENU_ROUTE_NAMES as readonly string[]).includes(name)
}
