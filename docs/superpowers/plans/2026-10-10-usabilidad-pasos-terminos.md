# Pasos, términos, resumen y cabecera Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En el flujo del alumno, un paso cerrado avisa sin navegar, los términos dejan «Acepto» a la vista, Resumen abre arriba y la cabecera deja de achicarse.

**Architecture:** `pasoAlumnoRematricula.ts` decide si el clic navega, avisa o no hace nada, y arma el texto del aviso. El layout del alumno dibuja el paso sin círculo, abre el `AlertDialog` y deja la cabecera en un solo alto. Términos usa el acordeón ya existente. Resumen hace `scrollTo` al montarse.

**Tech Stack:** Vue 3, TypeScript, Vitest, Tailwind, radix-vue (`Stepper`, `Accordion`, `AlertDialog`).

## Global Constraints

- Solo el flujo del alumno. No editar `src/views/matricula-mock/` ni `src/components/ui/stepper/StepperIndicator.vue`.
- Nombres de paso, en este orden: `Datos personales`, `Forma de pago`, `Firma de contrato`, `Resumen final`.
- Paso actual: `text-uniacc-orange` y `font-semibold` en el número y en el nombre. Paso cerrado: clase `opacity-40` puesta por el layout. Sin `disabled` y sin `data-[disabled]`.
- Texto del aviso: `Estás en {paso actual}. {Paso pulsado} no está abierto.` Título: `Paso no disponible`. Botón: `Entendido`. No usar la palabra «todavía».
- `pasoBloqueadoTrasEnvio` no se reescribe. Un paso cerrado no navega.
- Acordeón cerrado al entrar. Disparador: `Leer términos y condiciones`. `puedeAceptar` no cambia.
- Resumen: `window.scrollTo({ top: 0, left: 0, behavior: 'auto' })` solo al mostrar esa vista.
- Cabecera fija en el tamaño de arriba: `md:py-4`, logo `h-9 md:h-10`, título `text-lg`, línea `mt-1 h-1 w-24`. Sin listener de scroll.
- No hay test de montaje de Vue. El comportamiento del clic se prueba en `pasoAlumnoRematricula.test.ts`.
- Cada commit agrega solo los archivos de esa tarea. Prohibido `git add -A`, `--amend` y push.
- `src/views/matricula-alumno/MatriculaAlumnoTyCStep.vue` tiene cambios ajenos sin commit (párrafo «Vista 02» quitado y la descripción de la tarjeta). La tarea 4 los aparta antes de editar y los devuelve después del commit, sin incluirlos.

## File structure

- `src/utils/pasoAlumnoRematricula.ts` — nombres, acción del clic y texto del aviso.
- `src/utils/pasoAlumnoRematricula.test.ts` — esos tres contratos.
- `src/views/matricula-alumno/MatriculaAlumnoLayout.vue` — dibujo del stepper, aviso y cabecera fija.
- `src/views/matricula-alumno/MatriculaAlumnoTyCStep.vue` — acordeón.
- `src/views/matricula-alumno/ResumenAlumnoView.vue` — scroll arriba.
- `docs/superpowers/specs/2026-10-10-usabilidad-pasos-terminos-design.md` — pasa a `aprobado` al cerrar.

---

### Task 1: Decidir el clic del paso

**Files:**
- Modify: `src/utils/pasoAlumnoRematricula.ts`
- Test: `src/utils/pasoAlumnoRematricula.test.ts`

**Interfaces:**
- Consumes: nada de tareas posteriores.
- Produces:
  - `NOMBRES_PASO_ALUMNO` tuple de 4 strings, en el orden de arriba.
  - `AccionPulsoPaso = 'nada' | 'aviso' | 'navegar'`
  - `accionAlPulsarPaso(input: { step: number | undefined; pasoActual: number; cerrado: boolean }): AccionPulsoPaso`
  - `textoAvisoPasoCerrado(pasoActual: string, pasoPulsado: string): string`

- [ ] **Step 1: Write the failing test**

Al final de `src/utils/pasoAlumnoRematricula.test.ts`, agregar el import de `accionAlPulsarPaso`, `NOMBRES_PASO_ALUMNO` y `textoAvisoPasoCerrado`, y estos dos `describe`:

```ts
describe('accionAlPulsarPaso', () => {
  it('no hace nada si el paso no viene o si ya es el actual', () => {
    expect(accionAlPulsarPaso({ step: undefined, pasoActual: 2, cerrado: false })).toBe('nada')
    expect(accionAlPulsarPaso({ step: 2, pasoActual: 2, cerrado: false })).toBe('nada')
  })

  it('avisa si el paso está cerrado, aunque coincida con el actual', () => {
    expect(accionAlPulsarPaso({ step: 4, pasoActual: 2, cerrado: true })).toBe('aviso')
    expect(accionAlPulsarPaso({ step: 2, pasoActual: 2, cerrado: true })).toBe('aviso')
  })

  it('navega si el paso está abierto y es otro', () => {
    expect(accionAlPulsarPaso({ step: 1, pasoActual: 2, cerrado: false })).toBe('navegar')
  })
})

describe('textoAvisoPasoCerrado', () => {
  it('nombra el paso actual y el pulsado, sin decir todavía', () => {
    expect(NOMBRES_PASO_ALUMNO).toEqual([
      'Datos personales',
      'Forma de pago',
      'Firma de contrato',
      'Resumen final',
    ])
    expect(textoAvisoPasoCerrado('Forma de pago', 'Resumen final')).toBe(
      'Estás en Forma de pago. Resumen final no está abierto.',
    )
    expect(textoAvisoPasoCerrado('Forma de pago', 'Resumen final')).not.toContain('todavía')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/pasoAlumnoRematricula.test.ts`

Expected: FAIL porque `accionAlPulsarPaso` no está exportado.

- [ ] **Step 3: Write minimal implementation**

Al final de `src/utils/pasoAlumnoRematricula.ts`:

```ts
export const NOMBRES_PASO_ALUMNO = [
  'Datos personales',
  'Forma de pago',
  'Firma de contrato',
  'Resumen final',
] as const

export type AccionPulsoPaso = 'nada' | 'aviso' | 'navegar'

export function accionAlPulsarPaso(input: {
  step: number | undefined
  pasoActual: number
  cerrado: boolean
}): AccionPulsoPaso {
  if (input.step === undefined) return 'nada'
  if (input.cerrado) return 'aviso'
  if (input.step === input.pasoActual) return 'nada'
  return 'navegar'
}

export function textoAvisoPasoCerrado(pasoActual: string, pasoPulsado: string): string {
  return `Estás en ${pasoActual}. ${pasoPulsado} no está abierto.`
}
```

No modificar `pasoBloqueadoTrasEnvio`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/pasoAlumnoRematricula.test.ts`

Expected: PASS, incluidos los describe que ya existían.

- [ ] **Step 5: Commit**

```bash
git add src/utils/pasoAlumnoRematricula.ts src/utils/pasoAlumnoRematricula.test.ts
git commit -m "$(cat <<'EOF'
test(rematricula): decidir si un paso navega o avisa

EOF
)"
```

---

### Task 2: Dibujar el paso y avisar si está cerrado

**Files:**
- Modify: `src/views/matricula-alumno/MatriculaAlumnoLayout.vue`
- Test: `src/utils/pasoAlumnoRematricula.test.ts` (ya pasa; no se edita)

**Interfaces:**
- Consumes: `accionAlPulsarPaso`, `NOMBRES_PASO_ALUMNO`, `textoAvisoPasoCerrado` de la tarea 1. `pasoBloqueado` local, que ya llama a `pasoBloqueadoTrasEnvio`.
- Produces: el layout abre el aviso cuando la acción es `aviso` y hace `router.push` cuando es `navegar`.

- [ ] **Step 1: Wire the setter and the dialog state**

En el script, quitar `StepperIndicator` del import del stepper. Agregar:

```ts
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  accionAlPulsarPaso,
  NOMBRES_PASO_ALUMNO,
  textoAvisoPasoCerrado,
} from '@/utils/pasoAlumnoRematricula'
```

`PASOS_ALUMNO_REMATRICULA`, `pasoBloqueadoTrasEnvio` y `pasoMaximoAlumno` se siguen importando del mismo módulo.

Debajo de `pasoBloqueado`, agregar:

```ts
const avisoPasoAbierto = ref(false)
const avisoPasoTexto = ref('')

function nombrePaso(step: number): string {
  return NOMBRES_PASO_ALUMNO[step - 1] ?? ''
}
```

Reemplazar el `stepModel` actual por:

```ts
const stepModel = computed({
  get: () => routeNameToStep(route.name),
  set: (v: number | undefined) => {
    const actual = routeNameToStep(route.name)
    const accion = accionAlPulsarPaso({
      step: v,
      pasoActual: actual,
      cerrado: v !== undefined && pasoBloqueado(v),
    })
    if (accion === 'nada' || v === undefined) return
    if (accion === 'aviso') {
      avisoPasoTexto.value = textoAvisoPasoCerrado(nombrePaso(actual), nombrePaso(v))
      avisoPasoAbierto.value = true
      return
    }
    const n = STEP_NAMES[v - 1]
    if (n) void router.push({ name: n })
  },
})
```

No tocar `yScroll`, `isCompactHeader` ni el listener. Eso es la tarea 3.

- [ ] **Step 2: Replace the stepper markup**

Quitar los cuatro `StepperIndicator`. Cada ítem queda sin `:disabled`. La opacidad va en una clase propia. Número y nombre en una fila. El separador se centra con la fila, sin `mt-3`.

Reemplazar el bloque `<Stepper ...>` … `</Stepper>` por:

```vue
        <Stepper
          v-model="stepModel"
          :linear="false"
          class="flex w-full min-w-[28rem] items-center gap-0 md:min-w-0"
        >
          <StepperItem
            :step="1"
            class="flex min-w-0 flex-1 flex-row items-center"
            :class="pasoBloqueado(1) ? 'opacity-40' : ''"
          >
            <StepperTrigger class="flex min-w-0 flex-1 flex-row items-center justify-center gap-1.5 p-1">
              <span
                class="text-[11px] leading-tight"
                :class="stepModel === 1 ? 'font-semibold text-uniacc-orange' : 'font-medium'"
              >1</span>
              <StepperTitle
                class="text-[11px] leading-tight"
                :class="stepModel === 1 ? 'font-semibold text-uniacc-orange' : 'font-medium'"
              >
                {{ NOMBRES_PASO_ALUMNO[0] }}
              </StepperTitle>
            </StepperTrigger>
            <StepperSeparator class="mx-1 h-px min-w-[0.75rem] flex-1 bg-border" />
          </StepperItem>
          <StepperItem
            :step="2"
            class="flex min-w-0 flex-1 flex-row items-center"
            :class="pasoBloqueado(2) ? 'opacity-40' : ''"
          >
            <StepperTrigger class="flex min-w-0 flex-1 flex-row items-center justify-center gap-1.5 p-1">
              <span
                class="text-[11px] leading-tight"
                :class="stepModel === 2 ? 'font-semibold text-uniacc-orange' : 'font-medium'"
              >2</span>
              <StepperTitle
                class="text-[11px] leading-tight"
                :class="stepModel === 2 ? 'font-semibold text-uniacc-orange' : 'font-medium'"
              >
                {{ NOMBRES_PASO_ALUMNO[1] }}
              </StepperTitle>
            </StepperTrigger>
            <StepperSeparator class="mx-1 h-px min-w-[0.75rem] flex-1 bg-border" />
          </StepperItem>
          <StepperItem
            :step="3"
            class="flex min-w-0 flex-1 flex-row items-center"
            :class="pasoBloqueado(3) ? 'opacity-40' : ''"
          >
            <StepperTrigger class="flex min-w-0 flex-1 flex-row items-center justify-center gap-1.5 p-1">
              <span
                class="text-[11px] leading-tight"
                :class="stepModel === 3 ? 'font-semibold text-uniacc-orange' : 'font-medium'"
              >3</span>
              <StepperTitle
                class="text-[11px] leading-tight"
                :class="stepModel === 3 ? 'font-semibold text-uniacc-orange' : 'font-medium'"
              >
                {{ NOMBRES_PASO_ALUMNO[2] }}
              </StepperTitle>
            </StepperTrigger>
            <StepperSeparator class="mx-1 h-px min-w-[0.75rem] flex-1 bg-border" />
          </StepperItem>
          <StepperItem
            :step="4"
            class="flex min-w-0 flex-1 flex-row items-center"
            :class="pasoBloqueado(4) ? 'opacity-40' : ''"
          >
            <StepperTrigger class="flex min-w-0 flex-1 flex-row items-center justify-center gap-1.5 p-1">
              <span
                class="text-[11px] leading-tight"
                :class="stepModel === 4 ? 'font-semibold text-uniacc-orange' : 'font-medium'"
              >4</span>
              <StepperTitle
                class="text-[11px] leading-tight"
                :class="stepModel === 4 ? 'font-semibold text-uniacc-orange' : 'font-medium'"
              >
                {{ NOMBRES_PASO_ALUMNO[3] }}
              </StepperTitle>
            </StepperTrigger>
          </StepperItem>
        </Stepper>
```

Justo antes del `</div>` raíz del template, después del enlace de WhatsApp, agregar:

```vue
    <AlertDialog v-model:open="avisoPasoAbierto">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Paso no disponible</AlertDialogTitle>
          <AlertDialogDescription class="text-left">
            {{ avisoPasoTexto }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction class="bg-uniacc-orange hover:bg-uniacc-orange/90">
            Entendido
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
```

`AlertDialogAction` cierra el diálogo al pulsarlo. No agregar otro botón.

- [ ] **Step 3: Confirm the unit tests still pass**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/pasoAlumnoRematricula.test.ts`

Expected: PASS. No hay test de montaje.

- [ ] **Step 4: Commit**

```bash
git add src/views/matricula-alumno/MatriculaAlumnoLayout.vue
git commit -m "$(cat <<'EOF'
feat(rematricula): avisar al pulsar un paso que no está abierto

EOF
)"
```

---

### Task 3: Dejar la cabecera en un solo tamaño

**Files:**
- Modify: `src/views/matricula-alumno/MatriculaAlumnoLayout.vue` (el archivo ya tiene el aviso de la tarea 2)

**Interfaces:**
- Consumes: nada.
- Produces: el layout ya no escucha `scroll` ni cambia el alto de la cabecera.

- [ ] **Step 1: Remove the compact-header state**

Borrar `yScroll`, `isCompactHeader`, `actualizarScrollHeader`, el `onMounted` y el `onUnmounted` que registran el listener.

En el import de `vue`, dejar solo lo que siga en uso (`computed` y `ref`). Quitar `onMounted` y `onUnmounted` si no quedan otras llamadas.

- [ ] **Step 2: Freeze the header classes**

Reemplazar desde `<header` hasta el cierre de la fila del logo, el título y la línea naranja. El resultado de esa zona es:

```vue
      <header class="border-b border-zinc-200 bg-white shadow-sm">
        <div
          class="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6 md:py-4"
        >
          <div class="flex items-center gap-4">
            <RouterLink :to="{ name: 'dashboard-home' }">
              <img
                src="/Logo/logoUniaccNew.svg"
                alt="Universidad UNIACC"
                class="h-9 w-auto md:h-10"
              />
            </RouterLink>
          </div>
          <div class="hidden text-right md:block">
            <p class="text-lg font-bold tracking-tight text-zinc-900">
              {{ tituloRematricula }}
            </p>
            <div class="ml-auto mt-1 h-1 w-24 rounded-full bg-uniacc-orange" />
          </div>
```

El `div` de Salir que sigue no se reescribe. No quitar `transition-colors` del botón Salir ni del teléfono de ayuda. No tocar la barra `#1E3A5F`, el stepper ni el enlace de WhatsApp.

- [ ] **Step 3: Commit**

```bash
git add src/views/matricula-alumno/MatriculaAlumnoLayout.vue
git commit -m "$(cat <<'EOF'
fix(rematricula): dejar la cabecera del alumno en un solo tamaño

EOF
)"
```

---

### Task 4: Términos en un acordeón cerrado

**Files:**
- Modify: `src/views/matricula-alumno/MatriculaAlumnoTyCStep.vue`

**Interfaces:**
- Consumes: `Accordion`, `AccordionContent`, `AccordionItem`, `AccordionTrigger` de `@/components/ui/accordion`. `puedeAceptar` y `AccionesFlujo` ya existen en el archivo.
- Produces: el texto largo deja de reservar `max-h-[min(28rem,60vh)]`. «Acepto» queda debajo del disparador.

- [ ] **Step 1: Stash the unrelated working tree**

El archivo ya tiene un diff ajeno: se quitó el párrafo «Vista 02…» y la descripción pasó de «DVU – Dirección Vida Universitaria» a «Sistema de Rematrícula en Línea». Apartarlo antes de editar:

```bash
git stash push -m "wip tyc ajeno" -- src/views/matricula-alumno/MatriculaAlumnoTyCStep.vue
```

Expected: el archivo vuelve al commit y `git diff -- src/views/matricula-alumno/MatriculaAlumnoTyCStep.vue` queda vacío.

- [ ] **Step 2: Replace the scroll box with a closed accordion**

Importar:

```ts
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
```

Reemplazar el `div` `v-else` que tiene `max-h-[min(28rem,60vh)] overflow-y-auto` y `RichTextContent` por:

```vue
        <Accordion
          v-else
          type="single"
          collapsible
          class="rounded-md border border-zinc-200 bg-zinc-50"
        >
          <AccordionItem value="tyc" class="border-b-0">
            <AccordionTrigger class="px-4 py-3 text-left text-sm hover:no-underline">
              Leer términos y condiciones
            </AccordionTrigger>
            <AccordionContent class="px-4 pb-4">
              <RichTextContent :html="contenido" />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
```

No dar `default-value`. Arranca cerrado. No tocar `puedeAceptar`, `AccionesFlujo`, el estado de carga ni el aviso de documento no disponible.

- [ ] **Step 3: Commit only the accordion**

```bash
git add src/views/matricula-alumno/MatriculaAlumnoTyCStep.vue
git commit -m "$(cat <<'EOF'
feat(rematricula): dejar los términos en un acordeón cerrado

EOF
)"
```

- [ ] **Step 4: Restore the unrelated working tree**

```bash
git stash pop
```

Expected: el párrafo «Vista 02» sigue ausente y la descripción sigue en «Sistema de Rematrícula en Línea», encima del acordeón. Ese diff queda sin stage. Si el pop marca conflicto, conservar el acordeón y también esos dos cambios ajenos, y no hacer commit de ellos.

---

### Task 5: Abrir Resumen arriba

**Files:**
- Modify: `src/views/matricula-alumno/ResumenAlumnoView.vue`

**Interfaces:**
- Consumes: nada de las tareas anteriores.
- Produces: al montar la vista, la ventana queda en `scrollY === 0`.

- [ ] **Step 1: Scroll to the top when the view is shown**

En el import de `vue`, agregar `onMounted` junto a `computed`, `ref` y `watch`.

Debajo de `const descargando = ref(false)`, agregar:

```ts
onMounted(() => {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
})
```

No mover el botón «Descargar el contrato». No agregar `scrollTo` en otras vistas.

- [ ] **Step 2: Commit**

```bash
git add src/views/matricula-alumno/ResumenAlumnoView.vue
git commit -m "$(cat <<'EOF'
fix(rematricula): abrir el resumen en la felicitación

EOF
)"
```

---

### Task 6: Cerrar el spec

**Files:**
- Modify: `docs/superpowers/specs/2026-10-10-usabilidad-pasos-terminos-design.md`

**Interfaces:**
- Consumes: las tareas 1 a 5 ya están en el árbol.
- Produces: el spec dice `Estado: aprobado`.

- [ ] **Step 1: Mark the spec approved**

Cambiar la línea `Estado: en revisión` por `Estado: aprobado`. No cambiar otra frase.

- [ ] **Step 2: Commit the spec**

El archivo puede estar sin seguimiento. Agregar solo ese archivo.

```bash
git add docs/superpowers/specs/2026-10-10-usabilidad-pasos-terminos-design.md
git commit -m "$(cat <<'EOF'
docs(rematricula): aprobar el spec de pasos, términos y cabecera

EOF
)"
```

No incluir el plan ni otros archivos sucios.
