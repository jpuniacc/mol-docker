/** Valor del Select de filtro «Todos» (Radix no permite value=""). */
export const DESCUENTO_MATRICULA_APLICABLE_FILTRO_TODOS = '__all__'

/** Conceptos a los que aplica el descuento matrícula anticipada. */
export const DESCUENTO_MATRICULA_APLICABLE = ['MATRICULA', 'ARANCEL'] as const

export type DescuentoMatriculaAplicable =
  (typeof DESCUENTO_MATRICULA_APLICABLE)[number]

export const DESCUENTO_MATRICULA_APLICABLE_LABEL: Record<
  DescuentoMatriculaAplicable,
  string
> = {
  MATRICULA: 'Matrícula',
  ARANCEL: 'Arancel',
}
