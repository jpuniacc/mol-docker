import { computed, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { TABLA_PAGE_SIZE, useTablaPaginada } from './useTablaPaginada'

describe('useTablaPaginada', () => {
  it('pinta de a 20 aunque el set filtrado sea mayor', () => {
    const items = ref(Array.from({ length: 45 }, (_, i) => i + 1))
    const { pageItems, total, totalPages, rangoDesde, rangoHasta, irAPaginaSiguiente } =
      useTablaPaginada(items)

    expect(total.value).toBe(45)
    expect(pageItems.value).toHaveLength(TABLA_PAGE_SIZE)
    expect(pageItems.value[0]).toBe(1)
    expect(rangoDesde.value).toBe(1)
    expect(rangoHasta.value).toBe(20)
    expect(totalPages.value).toBe(3)

    irAPaginaSiguiente()
    expect(pageItems.value[0]).toBe(21)
    expect(rangoHasta.value).toBe(40)
  })

  it('el total sigue siendo el del set filtrado completo', () => {
    const all = ref(Array.from({ length: 50 }, (_, i) => i + 1))
    const filtrados = computed(() => all.value.filter((n) => n % 2 === 0))
    const { pageItems, total } = useTablaPaginada(filtrados)

    expect(total.value).toBe(25)
    expect(pageItems.value).toHaveLength(TABLA_PAGE_SIZE)
    expect(pageItems.value[0]).toBe(2)
  })
})
