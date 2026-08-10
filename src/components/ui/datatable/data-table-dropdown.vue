<script setup lang="ts">
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RouterLink } from 'vue-router'

import { EllipsisVertical, Trash2, UserX, UserPen, Eye } from 'lucide-vue-next'

const authStore = useAuthStore()
const matriculasStore = useMatriculasStore()
const errorStore = useErrorStore()

defineProps<{
  alumno: Tables<'mv_libro_matricula'>
  soloVerDetalle?: boolean // Si es true, solo muestra "Ver Detalle" (para dashboard)
}>()

// usado para los permisos de los botones (promocionar y retirar alumnos)
// Perfiles permitidos: 1 (SUPER ADMINISTRADOR), 2 (ADMINISTRADOR ESCUELA), 4 (JEFE DE UTP), 9 (ADMIN + ENCARGADO CONVIVENCIA)
const tienePermisos = computed(() => {
  const codigoPerfil = authStore.perfil?.codigo_perfil_usuario
  return codigoPerfil === 1 || codigoPerfil === 2 || codigoPerfil === 4 || codigoPerfil === 9
})

// logica para retirar un alumno
const formularioRetirarAlumno = ref({
  fecha: new Date().toISOString().slice(0, 10),
  motivo: '',
})

const retirarAlumno = async (alumno: Tables<'mv_libro_matricula'>) => {
  const { error, status } = await queryRetirarAlumno({
    rut: alumno.rut_alumno,
    numeroMatricula: alumno.numero_matricula_alumno,
  })
  if (error) {
    errorStore.setError({ error: error, customCode: status })
    toast.error('Error al retirar alumno', {
      description: error.message || 'No se pudo retirar al alumno',
    })
  } else {
    toast.success('Alumno retirado exitosamente', {
      description: `${alumno.nombre_completo_alumno} ha sido retirado correctamente`,
    })
    formularioRetirarAlumno.value = {
      fecha: new Date().toISOString().slice(0, 10),
      motivo: '',
    }
    matriculasStore.fetchAlumnos()
  }
}

import type { Tables } from '@/types/supabase'
import { useErrorStore } from '@/stores/error' // types de supabase
const queryRetirarAlumno = ({ rut, numeroMatricula }: { rut: string; numeroMatricula: number }) =>
  supabase.rpc('actualizar_estado_alumno', {
    p_rut: rut,
    p_numero_matricula: numeroMatricula,
    p_codigo_estado: 0,
    p_fecha_retiro: formularioRetirarAlumno.value.fecha,
    p_causa_retiro: formularioRetirarAlumno.value.motivo,
    p_rut_modificador: authStore.perfil!.rut_usuario,
  })

// logica para eliminar un alumno
const eliminarAlumno = async (id: number) => {
  const { error, status } = await queryEliminarAlumno(id)
  if (error) errorStore.setError({ error: error, customCode: status })
  else {
    // emit('alumnoEliminado')
    matriculasStore.fetchAlumnos()
  }
}
const queryEliminarAlumno = (id: number) =>
  supabase
    .from('mv_libro_matricula')
    .update({
      codigo_estado_alumno: 2,
      estado_alumno: 'ELIMINADO',
      rut_usuario_modifica: authStore.perfil?.rut_usuario,
      fecha_modificacion: new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }) }) // TODO (modelo) dejar solo 1 de los 2 FK
    .eq('id', id)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ReincorporarAlumno = async (id: number) => {
  const { error, status } = await queryReincorporarAlumno(id)
  if (error) errorStore.setError({error: error, customCode: status})
  else
  {
    matriculasStore.fetchAlumnos()
  }
}

const queryReincorporarAlumno = (id: number) =>
  supabase
    .from('mv_libro_matricula')
    .update({ codigo_estado_alumno: 1,
      estado_alumno: 'ACTIVO',
      fecha_retiro_escuela: null,
      causa_retiro_alumno: null,
      rut_usuario_modifica: authStore.perfil?.rut_usuario,
      fecha_modificacion: new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' })
    })
    .eq('id', id)

</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline">
        <EllipsisVertical class="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-56">
      <DropdownMenuLabel>Acciones</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <!-- Ver Detalle -->
        <!-- Si soloVerDetalle es true, mostrar siempre (mobile y desktop) -->
        <!-- Si soloVerDetalle es false, mostrar solo en mobile -->
        <DropdownMenuItem
          :class="soloVerDetalle ? '' : 'md:hidden'"
          @click="$emit('ver-detalle', alumno)"
        >
          <Eye class="h-4 w-4 mr-2" />
          <span>Ver Detalle</span>
        </DropdownMenuItem>

        <!-- Resto de acciones solo si NO es soloVerDetalle -->
        <template v-if="!soloVerDetalle">
          <DropdownMenuItem v-if="alumno.codigo_estado_alumno == 1" :disabled="!tienePermisos">
            <RouterLink
              :to="{ name: 'editar-matricula', params: { matriculaId: alumno.id } }"
              class="flex space-x-2"
              :class="{ 'cursor-not-allowed opacity-50': !tienePermisos }"
            >
              <UserPen class="h-4 w-4" />
              <span>Editar</span>
            </RouterLink>
          </DropdownMenuItem>

          <DropdownMenuItem
            @click.stop
            v-if="alumno.codigo_estado_alumno == 1"
            :disabled="!tienePermisos"
          >
            <AlertDialog>
              <AlertDialogTrigger @click.stop :disabled="!tienePermisos">
                <div
                  class="flex space-x-2"
                  :class="{ 'cursor-not-allowed opacity-50': !tienePermisos }"
                >
                  <UserX class="h-4 w-4" />
                  <span>Retirar</span>
                </div>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle> Indique la fecha y motivo de retiro: </AlertDialogTitle>
                  <AlertDialogDescription>
                    <div class="flex flex-col space-y-2">
                      <Label for="matriculas-fecha-retiro"> Fecha </Label>
                      <Input
                        id="matriculas-fecha-retiro"
                        v-model="formularioRetirarAlumno.fecha"
                        type="date"
                        label="Fecha de retiro"
                        class="mt-2"
                      />
                      <Label for="matriculas-motivo-retiro"> Motivo </Label>
                      <Textarea
                        id="matriculas-motivo-retiro"
                        v-model="formularioRetirarAlumno.motivo"
                        label="Motivo"
                        class="mt-2"
                        placeholder="Escribe acá el motivo"
                      />
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    @click.stop="retirarAlumno(alumno)"
                    :disabled="!formularioRetirarAlumno.fecha || !formularioRetirarAlumno.motivo"
                  >
                    Confirmar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuItem>

          <!-- boton eliminar -->
          <DropdownMenuItem :disabled="!tienePermisos">
            <AlertDialog>
              <AlertDialogTrigger @click.stop :disabled="!tienePermisos">
                <div
                  class="flex space-x-2"
                  :class="{ 'cursor-not-allowed opacity-50': !tienePermisos }"
                >
                  <Trash2 class="h-4 w-4" />
                  <span>Eliminar</span>
                </div>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle> ¿Seguro que desea eliminar al alumno? </AlertDialogTitle>
                  <AlertDialogDescription> Esta acción no se puede deshacer. </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    @click.stop="eliminarAlumno(alumno.id)"
                    :disabled="!tienePermisos"
                  >
                    Confirmar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuItem>
        </template>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
