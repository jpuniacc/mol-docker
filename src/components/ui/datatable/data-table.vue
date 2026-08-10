<!--
Tip:
If you find yourself using <DataTable /> in multiple places,
this is the component you could make reusable by extracting it to components/ui/data-table.vue.
-->

<script setup lang="ts" generic="TData, TValue">
import { ref, watch, computed, withDefaults } from 'vue'

import {
  FlexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useVueTable,
} from '@tanstack/vue-table'
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from '@tanstack/vue-table'

import { valueUpdater } from '@/composables/utils'
import { Card, CardContent } from '@/components/ui/card'

const props = withDefaults(defineProps<{
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  pageSize?: number
  showCardsOnly?: boolean
}>(), {
  pageSize: 10,
  showCardsOnly: false
})

const sorting = ref<SortingState>([])
const columnFilters = ref<ColumnFiltersState>([])
const columnVisibility = ref<VisibilityState>({})
const pagination = ref({
  pageIndex: 0,
  pageSize: props.pageSize,
})

const table = useVueTable({
  get data() {
    return props.data
  },
  get columns() {
    return props.columns
  },
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  onSortingChange: (updaterOrValue) => valueUpdater(updaterOrValue, sorting),
  onColumnFiltersChange: (updaterOrValue) => valueUpdater(updaterOrValue, columnFilters),
  onColumnVisibilityChange: (updaterOrValue) => valueUpdater(updaterOrValue, columnVisibility),
  onPaginationChange: (updaterOrValue) => valueUpdater(updaterOrValue, pagination),
  state: {
    get sorting() {
      return sorting.value
    },
    get columnFilters() {
      return columnFilters.value
    },
    get columnVisibility() {
      return columnVisibility.value
    },
    get pagination() {
      return pagination.value
    },
  },
})

// custom sorting
const selectedSortColumn = ref<string | null>(null) // columna seleccionada en el Select
watch(selectedSortColumn, (newValue) => {
  if (newValue) {
    const column = table.getColumn(newValue)
    if (column) {
      column.toggleSorting(column.getIsSorted() === 'asc')
    }
  }
})

// custom filtering
const selectedSortOption = ref<string>('numero_matricula_alumno:desc') // opción seleccionada en el Select
watch(selectedSortOption, (newValue) => {
  if (newValue) {
    const [columnId, direction] = newValue.split(':')
    const column = table.getColumn(columnId)
    if (column) {
      column.toggleSorting(direction === 'asc')
    }
  }
})

// Función para obtener el label de la columna desde su definición
const getColumnLabel = (column: any): string => {
  // Buscar la definición de la columna
  const colDef = props.columns.find(c => {
    if ('accessorKey' in c && c.accessorKey === column.accessorKey) return true
    if ('id' in c && c.id === column.id) return true
    return false
  })
  
  if (colDef && colDef.header) {
    // Si el header es una función (como h() de Vue), intentar extraer el texto
    if (typeof colDef.header === 'function') {
      try {
        const result = colDef.header({} as any)
        // Si retorna un VNode con children, extraer el texto
        if (result && typeof result === 'object') {
          if ('children' in result) {
            const children = result.children
            if (typeof children === 'string') return children
            if (Array.isArray(children) && children.length > 0) {
              const firstChild = children[0]
              if (typeof firstChild === 'string') return firstChild
            }
          }
        }
      } catch (e) {
        // Si falla, usar fallback
      }
    }
    // Si el header es un string directo
    if (typeof colDef.header === 'string') {
      return colDef.header
    }
  }
  
  // Fallback: convertir accessorKey o id a label legible
  const key = column.accessorKey || column.id || 'Campo'
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
</script>

<template>
  <div>
    <!-- filtro y ordenamiento-->
    <div class="grid grid-cols-1 md:grid-cols-6 gap-4 pb-2 pt-4">
      <!-- filtro -->
      <Label for="matriculas-filtro-alumnos" class="md:col-span-2 md:col-start-1 flex flex-col space-y-1">
        <span class="telbook-label">Filtrar</span>
        <Input
          class="w-full max-w-sm"
          placeholder="Filtrar apellidos..."
          :model-value="table.getColumn('nombre_completo_alumno')?.getFilterValue() as string"
          @update:model-value="table.getColumn('nombre_completo_alumno')?.setFilterValue($event)"
        />
      </Label>

      <!-- ordenamiento -->
      <Label for="matriculas-ordenar" class="md:col-span-2 md:col-start-5 flex flex-col space-y-1">
        <span class="telbook-label">Ordenar por</span>
        <div class="flex items-center space-x-2">
          <Select v-model="selectedSortOption" class="w-full">
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un criterio" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="numero_matricula_alumno:desc">
                  Nº Matricula Ascendente
                </SelectItem>
                <SelectItem value="numero_matricula_alumno:asc">
                  Nº Matricula Descendente
                </SelectItem>
                <SelectItem value="rut_alumno:desc"> Rut Ascendente </SelectItem>
                <SelectItem value="rut_alumno:asc"> Rut Descendente </SelectItem>
                <SelectItem value="nombre_completo_alumno:desc"> Nombres Ascendente </SelectItem>
                <SelectItem value="nombre_completo_alumno:asc"> Nombres Descendente </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </Label>
    </div>

    <!-- Desktop: Tabla (solo si no se muestran solo cards) -->
    <div v-if="!showCardsOnly" class="hidden md:block overflow-x-auto">
      <Table class="border border-gray-200 bg-white rounded-lg overflow-hidden">
        <TableHeader class="bg-gray-50 border-b border-gray-200">
          <TableRow v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id" class="hover:bg-gray-50">
            <TableHead 
              v-for="header in headerGroup.headers" 
              :key="header.id" 
              class="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap"
            >
              <FlexRender
                v-if="!header.isPlaceholder"
                :render="header.column.columnDef.header"
                :props="header.getContext()"
              />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="table.getRowModel().rows?.length">
            <TableRow
              v-for="row in table.getRowModel().rows"
              :key="row.id"
              :data-state="row.getIsSelected() ? 'selected' : undefined"
              class="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <TableCell 
                v-for="cell in row.getVisibleCells()" 
                :key="cell.id" 
                class="px-4 py-3 text-sm"
              >
                <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
              </TableCell>
            </TableRow>
          </template>
          <template v-else>
            <TableRow>
              <TableCell :colspan="columns.length" class="h-24 text-center text-gray-500">
                No hay resultados.
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
    </div>

    <!-- Cards genéricas (Mobile y Desktop si showCardsOnly) -->
    <div :class="showCardsOnly ? 'space-y-4' : 'md:hidden space-y-4'">
      <template v-if="table.getRowModel().rows?.length">
        <Card
          v-for="row in table.getRowModel().rows"
          :key="row.id"
          class="border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
        >
          <CardContent class="p-6">
            <div class="space-y-4">
              <div
                v-for="cell in row.getVisibleCells()"
                :key="cell.id"
                class="flex items-start justify-between gap-4 py-1 border-b border-gray-100 last:border-0"
              >
                <span class="text-sm font-medium text-gray-600 min-w-[140px]">
                  {{ getColumnLabel(cell.column) }}:
                </span>
                <div class="text-sm text-gray-900 font-semibold flex-1 text-right">
                  <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </template>
      <template v-else>
        <Card>
          <CardContent class="p-8 text-center text-gray-500">
            No hay resultados.
          </CardContent>
        </Card>
      </template>
    </div>
    
    <!-- Slot para cards personalizadas (solo en mobile o si showCardsOnly) -->
    <div :class="showCardsOnly ? 'space-y-4' : 'md:hidden space-y-4'">
      <slot name="custom-cards" :rows="table.getRowModel().rows" />
    </div>
  </div>

  <!-- paginacion -->
  <div class="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0 py-4 border-t border-gray-200 mt-4">
    <div class="text-sm text-muted-foreground order-2 sm:order-1">
      Mostrando {{ table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1 }} - 
      {{ Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length) }} 
      de {{ table.getFilteredRowModel().rows.length }} registros
    </div>
    <div class="flex items-center space-x-2 order-1 sm:order-2">
      <Button size="sm" :disabled="!table.getCanPreviousPage()" @click="table.previousPage()" variant="outline" class="w-full sm:w-auto">
        Anterior
      </Button>
      <span class="text-sm text-gray-600 px-2">
        Página {{ table.getState().pagination.pageIndex + 1 }} de {{ table.getPageCount() }}
      </span>
      <Button size="sm" :disabled="!table.getCanNextPage()" @click="table.nextPage()" variant="outline" class="w-full sm:w-auto">
        Siguiente
      </Button>
    </div>
  </div>
</template>
