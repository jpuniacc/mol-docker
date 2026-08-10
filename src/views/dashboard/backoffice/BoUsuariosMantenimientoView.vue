<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Pencil, RefreshCw, UserPlus } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { supabase } from '@/services/supabaseClient'
import type { MvUsuarioRow } from '@/types/supabase'

const rows = ref<MvUsuarioRow[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)

const dialogOpen = ref(false)
const saving = ref(false)
const editing = ref<MvUsuarioRow | null>(null)
/** Alta en `mv_usuario` (sin flujo LDAP en esta pantalla). */
const isCreateMode = ref(false)

const form = ref({
  email: '',
  nombre_usuario: '',
  apellido_usuario: '',
  telefono: '',
  codigo_perfil_usuario: 1,
  codigo_grupo: 1,
  codigo_estado_usuario: 1,
})

function resetForm() {
  isCreateMode.value = false
  form.value = {
    email: '',
    nombre_usuario: '',
    apellido_usuario: '',
    telefono: '',
    codigo_perfil_usuario: 1,
    codigo_grupo: 1,
    codigo_estado_usuario: 1,
  }
  editing.value = null
}

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const { data, error } = await supabase.from('mv_usuario').select('*').order('email')
    if (error) {
      loadError.value = error.message
      rows.value = []
      return
    }
    rows.value = (data ?? []) as MvUsuarioRow[]
  } finally {
    loading.value = false
  }
}

function openEdit(row: MvUsuarioRow) {
  isCreateMode.value = false
  editing.value = row
  form.value = {
    email: row.email,
    nombre_usuario: row.nombre_usuario ?? '',
    apellido_usuario: row.apellido_usuario ?? '',
    telefono: row.telefono ?? '',
    codigo_perfil_usuario: row.codigo_perfil_usuario,
    codigo_grupo: row.codigo_grupo,
    codigo_estado_usuario: row.codigo_estado_usuario,
  }
  dialogOpen.value = true
}

function openCreate() {
  resetForm()
  isCreateMode.value = true
  dialogOpen.value = true
}

function emailValido(raw: string): boolean {
  const s = raw.trim().toLowerCase()
  if (s.length < 3 || !s.includes('@')) return false
  const [local, domain] = s.split('@')
  return Boolean(local?.length && domain?.includes('.'))
}

watch(dialogOpen, (open) => {
  if (!open) resetForm()
})

function perfilLabel(c: number): string {
  if (c === 1) return 'Superadmin'
  if (c === 2) return 'Administrador'
  if (c === 3) return 'Ejecutivo'
  return String(c)
}

function grupoLabel(c: number): string {
  if (c === 1) return 'DVU'
  if (c === 2) return 'Admisión'
  if (c === 3) return 'TI'
  return String(c)
}

async function onSubmit() {
  const p = form.value.codigo_perfil_usuario
  const g = form.value.codigo_grupo
  if (p < 1 || p > 3 || g < 1 || g > 3) {
    toast.error('Perfil y grupo deben estar entre 1 y 3.')
    return
  }

  if (isCreateMode.value) {
    const email = form.value.email.trim().toLowerCase()
    if (!emailValido(email)) {
      toast.error('Ingresa un correo institucional válido.')
      return
    }
    const nom = form.value.nombre_usuario.trim()
    const ape = form.value.apellido_usuario.trim()
    if (!nom || !ape) {
      toast.error('Nombre y apellido son obligatorios.')
      return
    }

    saving.value = true
    try {
      const { error } = await supabase.from('mv_usuario').insert({
        id: crypto.randomUUID(),
        email,
        nombre_usuario: nom,
        apellido_usuario: ape,
        telefono: form.value.telefono.trim(),
        codigo_perfil_usuario: p,
        codigo_grupo: g,
        codigo_estado_usuario: Number(form.value.codigo_estado_usuario) || 0,
        updated_at: null,
        rut_modifica_usuario: null,
      })

      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('Usuario creado.')
      dialogOpen.value = false
      await load()
    } finally {
      saving.value = false
    }
    return
  }

  if (!editing.value) return

  saving.value = true
  try {
    const { error } = await supabase
      .from('mv_usuario')
      .update({
        nombre_usuario: form.value.nombre_usuario.trim(),
        apellido_usuario: form.value.apellido_usuario.trim(),
        telefono: form.value.telefono.trim(),
        codigo_perfil_usuario: p,
        codigo_grupo: g,
        codigo_estado_usuario: Number(form.value.codigo_estado_usuario) || 0,
      })
      .eq('id', editing.value.id)

    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Usuario actualizado.')
    dialogOpen.value = false
    await load()
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <Card class="border-zinc-200 shadow-sm">
      <CardHeader class="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle class="text-xl text-zinc-900">Mantenedor de usuarios</CardTitle>
          <CardDescription class="text-zinc-600">
            Registros en <code class="rounded bg-zinc-100 px-1 py-0.5 text-zinc-800">mv_usuario</code>. Puedes dar de
            alta filas nuevas o editar datos operativos; al editar, el correo queda solo lectura (vínculo con login LDAP).
            Perfil 1–3, grupo 1–3. Esta pantalla no crea cuenta en LDAP ni cambia contraseña.
          </CardDescription>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            class="gap-1.5 bg-uniacc-orange hover:bg-uniacc-orange/90"
            @click="openCreate()"
          >
            <UserPlus class="h-4 w-4" />
            Nuevo usuario
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            class="gap-1.5"
            :disabled="loading"
            @click="load()"
          >
            <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p v-if="loadError" class="mb-4 text-sm text-red-600">{{ loadError }}</p>
        <p v-else-if="loading && rows.length === 0" class="text-sm text-zinc-500">Cargando…</p>
        <div v-else class="rounded-md border border-zinc-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Apellido</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead class="w-[72px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="r in rows" :key="r.id">
                <TableCell class="max-w-[220px] truncate font-mono text-sm text-zinc-900">{{ r.email }}</TableCell>
                <TableCell class="text-zinc-700">{{ r.nombre_usuario }}</TableCell>
                <TableCell class="text-zinc-700">{{ r.apellido_usuario }}</TableCell>
                <TableCell class="text-zinc-600">{{ r.telefono || '—' }}</TableCell>
                <TableCell class="text-zinc-600">{{ perfilLabel(r.codigo_perfil_usuario) }}</TableCell>
                <TableCell class="text-zinc-600">{{ grupoLabel(r.codigo_grupo) }}</TableCell>
                <TableCell class="text-zinc-600">{{ r.codigo_estado_usuario }}</TableCell>
                <TableCell class="text-right">
                  <Button variant="ghost" size="icon" class="h-8 w-8" title="Editar" @click="openEdit(r)">
                    <Pencil class="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
              <TableRow v-if="!loading && rows.length === 0">
                <TableCell colspan="8" class="py-8 text-center text-sm text-zinc-500">Sin filas.</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ isCreateMode ? 'Nuevo usuario' : 'Editar usuario' }}</DialogTitle>
          <DialogDescription>
            <template v-if="isCreateMode">
              Alta solo en base de datos. Coordinar con TI/LDAP si el usuario debe existir también en el directorio.
            </template>
            <template v-else> Correo solo lectura. Los demás campos se guardan al confirmar. </template>
          </DialogDescription>
        </DialogHeader>

        <div v-if="isCreateMode || editing" class="grid gap-4 py-2">
          <div class="grid gap-2">
            <Label for="mu-email">Email</Label>
            <Input
              v-if="isCreateMode"
              id="mu-email"
              v-model="form.email"
              type="email"
              autocomplete="off"
              placeholder="usuario@uniacc.cl"
            />
            <Input v-else :model-value="editing!.email" readonly class="bg-zinc-50 text-zinc-700" />
          </div>

          <div class="grid gap-2">
            <Label for="mu-nombre">Nombre</Label>
            <Input id="mu-nombre" v-model="form.nombre_usuario" autocomplete="off" />
          </div>

          <div class="grid gap-2">
            <Label for="mu-apellido">Apellido</Label>
            <Input id="mu-apellido" v-model="form.apellido_usuario" autocomplete="off" />
          </div>

          <div class="grid gap-2">
            <Label for="mu-tel">Teléfono</Label>
            <Input id="mu-tel" v-model="form.telefono" autocomplete="off" />
          </div>

          <div class="grid gap-2">
            <Label for="mu-perfil">Perfil (1 superadmin, 2 admin, 3 ejecutivo)</Label>
            <Input id="mu-perfil" v-model.number="form.codigo_perfil_usuario" type="number" min="1" max="3" />
          </div>

          <div class="grid gap-2">
            <Label for="mu-grupo">Grupo (1 DVU, 2 Admisión, 3 TI)</Label>
            <Input id="mu-grupo" v-model.number="form.codigo_grupo" type="number" min="1" max="3" />
          </div>

          <div class="grid gap-2">
            <Label for="mu-estado">Código estado usuario</Label>
            <Input id="mu-estado" v-model.number="form.codigo_estado_usuario" type="number" min="0" step="1" />
            <p class="text-xs text-zinc-500">Convención según ERP / tabla maestra (no validado aquí).</p>
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
            {{ saving ? 'Guardando…' : isCreateMode ? 'Crear' : 'Guardar' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
