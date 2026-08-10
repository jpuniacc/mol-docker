<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Plus, Pencil, Trash2 } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DASHBOARD_MENU_ROUTE_NAMES } from '@/constants/dashboardRouteNames'
import { supabase } from '@/services/supabaseClient'
import { useDashboardMenuStore } from '@/stores/dashboardMenu'
import type { BoMenuItemRow } from '@/types/supabase'

const menuStore = useDashboardMenuStore()

const dialogOpen = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)

const form = ref({
  label: '',
  tipo: 'link' as 'link' | 'group',
  route_name: '' as string,
  parent_id: '' as string,
  icon_key: '',
  orden: 0,
  activo: true,
  grupo1: false,
  grupo2: false,
})

const flatRows = computed(() => {
  const rows = [...menuStore.items].sort((a, b) => a.orden - b.orden || a.label.localeCompare(b.label))
  return rows
})

function parentLabel(parentId: string | null): string {
  if (!parentId) return '—'
  const p = menuStore.items.find((r) => r.id === parentId)
  return p?.label ?? parentId
}

function gruposLabel(row: BoMenuItemRow): string {
  const g = menuStore.grupoRows.filter((x) => x.menu_item_id === row.id)
  if (g.length === 0) return 'Solo TI'
  return g.map((x) => (x.codigo_grupo === 1 ? 'DVU' : 'Adm.')).join(', ')
}

function resetForm() {
  form.value = {
    label: '',
    tipo: 'link',
    route_name: '',
    parent_id: '',
    icon_key: '',
    orden: 0,
    activo: true,
    grupo1: false,
    grupo2: false,
  }
  editingId.value = null
}

function openCreate() {
  resetForm()
  dialogOpen.value = true
}

function openEdit(row: BoMenuItemRow) {
  editingId.value = row.id
  form.value = {
    label: row.label,
    tipo: row.tipo,
    route_name: row.route_name ?? '',
    parent_id: row.parent_id ?? '',
    icon_key: row.icon_key ?? '',
    orden: row.orden,
    activo: row.activo,
    grupo1: menuStore.grupoRows.some((g) => g.menu_item_id === row.id && g.codigo_grupo === 1),
    grupo2: menuStore.grupoRows.some((g) => g.menu_item_id === row.id && g.codigo_grupo === 2),
  }
  dialogOpen.value = true
}

watch(dialogOpen, (open) => {
  if (!open) resetForm()
})

const parentOptions = computed(() =>
  menuStore.items.filter((r) => r.tipo === 'group' && r.id !== editingId.value),
)

async function persistGrupos(menuItemId: string, g1: boolean, g2: boolean) {
  const { error: delErr } = await supabase.from('bo_menu_item_grupo').delete().eq('menu_item_id', menuItemId)
  if (delErr) throw delErr
  const inserts: { menu_item_id: string; codigo_grupo: number }[] = []
  if (g1) inserts.push({ menu_item_id: menuItemId, codigo_grupo: 1 })
  if (g2) inserts.push({ menu_item_id: menuItemId, codigo_grupo: 2 })
  if (inserts.length === 0) return
  const { error: insErr } = await supabase.from('bo_menu_item_grupo').insert(inserts)
  if (insErr) throw insErr
}

async function onSubmit() {
  const f = form.value
  if (!f.label.trim()) {
    toast.error('Indica una etiqueta.')
    return
  }
  if (f.tipo === 'link') {
    if (!f.route_name.trim() || !DASHBOARD_MENU_ROUTE_NAMES.includes(f.route_name as (typeof DASHBOARD_MENU_ROUTE_NAMES)[number])) {
      toast.error('Elige un nombre de ruta válido para el enlace.')
      return
    }
  }

  saving.value = true
  try {
    const parentId = f.parent_id.trim() === '' ? null : f.parent_id.trim()
    const payload = {
      label: f.label.trim(),
      tipo: f.tipo,
      route_name: f.tipo === 'group' ? null : f.route_name.trim() || null,
      parent_id: parentId,
      icon_key: f.icon_key.trim() === '' ? null : f.icon_key.trim(),
      orden: Number(f.orden) || 0,
      activo: f.activo,
    }

    if (editingId.value) {
      const { error } = await supabase.from('bo_menu_item').update(payload).eq('id', editingId.value)
      if (error) throw error
      await persistGrupos(editingId.value, f.grupo1, f.grupo2)
      toast.success('Ítem actualizado.')
    } else {
      const { data, error } = await supabase.from('bo_menu_item').insert(payload).select('id').single()
      if (error) throw error
      if (!data?.id) throw new Error('Sin id tras insertar')
      await persistGrupos(data.id, f.grupo1, f.grupo2)
      toast.success('Ítem creado.')
    }
    dialogOpen.value = false
    await menuStore.refetch()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error al guardar'
    toast.error(msg)
  } finally {
    saving.value = false
  }
}

async function onDelete(row: BoMenuItemRow) {
  if (!window.confirm(`¿Eliminar «${row.label}» y sus hijos/asignaciones de grupo?`)) return
  saving.value = true
  try {
    const { error } = await supabase.from('bo_menu_item').delete().eq('id', row.id)
    if (error) throw error
    toast.success('Eliminado.')
    await menuStore.refetch()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error al eliminar'
    toast.error(msg)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <Card class="border-zinc-200 shadow-sm">
      <CardHeader class="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle class="text-xl text-zinc-900">Mantenedor de menú</CardTitle>
          <CardDescription class="text-zinc-600">
            Ítems del lateral del dashboard. Grupos DVU (1) y Admisión (2) se asignan con las casillas;
            TI (3) ve todos los ítems activos sin filas en «grupo».
          </CardDescription>
        </div>
        <Button type="button" class="gap-1.5 bg-uniacc-orange hover:bg-uniacc-orange/90" @click="openCreate">
          <Plus class="h-4 w-4" />
          Nuevo ítem
        </Button>
      </CardHeader>
      <CardContent>
        <p v-if="menuStore.loadError" class="mb-4 text-sm text-red-600">
          {{ menuStore.loadError }}
        </p>
        <div class="rounded-md border border-zinc-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Etiqueta</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Ruta</TableHead>
                <TableHead>Padre</TableHead>
                <TableHead class="text-right">Orden</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead>Grupos</TableHead>
                <TableHead class="w-[120px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in flatRows" :key="row.id">
                <TableCell class="font-medium text-zinc-900">{{ row.label }}</TableCell>
                <TableCell class="text-zinc-600">{{ row.tipo }}</TableCell>
                <TableCell class="max-w-[200px] truncate text-zinc-600">{{ row.route_name ?? '—' }}</TableCell>
                <TableCell class="text-zinc-600">{{ parentLabel(row.parent_id) }}</TableCell>
                <TableCell class="text-right text-zinc-600">{{ row.orden }}</TableCell>
                <TableCell>{{ row.activo ? 'Sí' : 'No' }}</TableCell>
                <TableCell class="text-sm text-zinc-600">{{ gruposLabel(row) }}</TableCell>
                <TableCell class="text-right">
                  <Button variant="ghost" size="icon" class="h-8 w-8" title="Editar" @click="openEdit(row)">
                    <Pencil class="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" class="h-8 w-8 text-red-600" title="Eliminar" @click="onDelete(row)">
                    <Trash2 class="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
              <TableRow v-if="flatRows.length === 0">
                <TableCell colspan="8" class="py-8 text-center text-sm text-zinc-500">
                  No hay filas (¿migración aplicada en Supabase?).
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ editingId ? 'Editar ítem' : 'Nuevo ítem' }}</DialogTitle>
          <DialogDescription>
            Los enlaces deben usar un nombre de ruta registrado en el router de la aplicación.
          </DialogDescription>
        </DialogHeader>

        <div class="grid gap-4 py-2">
          <div class="grid gap-2">
            <Label for="bo-label">Etiqueta</Label>
            <Input id="bo-label" v-model="form.label" autocomplete="off" />
          </div>

          <div class="grid gap-2">
            <Label for="bo-tipo">Tipo</Label>
            <select
              id="bo-tipo"
              v-model="form.tipo"
              class="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uniacc-orange focus-visible:ring-offset-2"
            >
              <option value="link">Enlace</option>
              <option value="group">Grupo (submenú)</option>
            </select>
          </div>

          <div v-if="form.tipo === 'link'" class="grid gap-2">
            <Label for="bo-route">Nombre de ruta</Label>
            <select
              id="bo-route"
              v-model="form.route_name"
              class="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uniacc-orange focus-visible:ring-offset-2"
            >
              <option value="">—</option>
              <option v-for="n in DASHBOARD_MENU_ROUTE_NAMES" :key="n" :value="n">{{ n }}</option>
            </select>
          </div>

          <div class="grid gap-2">
            <Label for="bo-parent">Contenedor (padre)</Label>
            <select
              id="bo-parent"
              v-model="form.parent_id"
              class="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uniacc-orange focus-visible:ring-offset-2"
            >
              <option value="">(primer nivel)</option>
              <option v-for="p in parentOptions" :key="p.id" :value="p.id">{{ p.label }}</option>
            </select>
          </div>

          <div class="grid gap-2">
            <Label for="bo-icon">Icono (Lucide)</Label>
            <Input id="bo-icon" v-model="form.icon_key" placeholder="p. ej. Home, Users" autocomplete="off" />
          </div>

          <div class="grid gap-2">
            <Label for="bo-orden">Orden</Label>
            <Input id="bo-orden" v-model.number="form.orden" type="number" />
          </div>

          <div class="flex items-center gap-2">
            <Checkbox
              id="bo-activo"
              :checked="form.activo"
              @update:checked="(v) => (form.activo = v === true)"
            />
            <Label for="bo-activo" class="cursor-pointer font-normal">Activo</Label>
          </div>

          <div class="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/80 p-3">
            <p class="text-sm font-medium text-zinc-800">Visible para grupos (1=DVU, 2=Admisión)</p>
            <p class="text-xs text-zinc-500">Sin marcas: solo usuarios TI ven el ítem (vía regla «grupo 3 = todo»).</p>
            <div class="flex flex-wrap gap-4">
              <div class="flex items-center gap-2">
                <Checkbox
                  id="bo-g1"
                  :checked="form.grupo1"
                  @update:checked="(v) => (form.grupo1 = v === true)"
                />
                <Label for="bo-g1" class="cursor-pointer font-normal">DVU (1)</Label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox
                  id="bo-g2"
                  :checked="form.grupo2"
                  @update:checked="(v) => (form.grupo2 = v === true)"
                />
                <Label for="bo-g2" class="cursor-pointer font-normal">Admisión (2)</Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0">
          <Button type="button" variant="outline" @click="dialogOpen = false">Cancelar</Button>
          <Button
            type="button"
            class="bg-uniacc-orange hover:bg-uniacc-orange/90"
            :disabled="saving"
            @click="onSubmit"
          >
            {{ saving ? 'Guardando…' : 'Guardar' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
