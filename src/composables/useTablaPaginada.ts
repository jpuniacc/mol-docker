import { computed, ref, watch, type MaybeRefOrGetter, toValue } from 'vue'

export const TABLA_PAGE_SIZE = 20

/**
 * Paginación solo de UI: el caller filtra sobre todos los registros
 * y aquí se recorta lo que se pinta en la tabla.
 */
export function useTablaPaginada<T>(
  items: MaybeRefOrGetter<readonly T[]>,
  pageSize: number = TABLA_PAGE_SIZE,
) {
  const page = ref(1)

  const total = computed(() => toValue(items).length)
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

  const pageItems = computed(() => {
    const start = (page.value - 1) * pageSize
    return toValue(items).slice(start, start + pageSize)
  })

  const rangoDesde = computed(() => (total.value === 0 ? 0 : (page.value - 1) * pageSize + 1))
  const rangoHasta = computed(() => Math.min(page.value * pageSize, total.value))

  watch(totalPages, (pages) => {
    if (page.value > pages) page.value = pages
  })

  function resetPage(): void {
    page.value = 1
  }

  function irAPaginaAnterior(): void {
    if (page.value > 1) page.value -= 1
  }

  function irAPaginaSiguiente(): void {
    if (page.value < totalPages.value) page.value += 1
  }

  return {
    page,
    pageSize,
    total,
    totalPages,
    pageItems,
    rangoDesde,
    rangoHasta,
    resetPage,
    irAPaginaAnterior,
    irAPaginaSiguiente,
  }
}
