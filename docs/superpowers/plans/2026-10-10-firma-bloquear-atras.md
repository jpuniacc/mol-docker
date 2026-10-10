# Bloquear el regreso después de enviar el contrato Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Después de pulsar Enviar a firmar, datos personales y forma de pago no se pueden abrir, y el contrato ya enviado a TuFirma no se vuelve a crear.

**Architecture:** Una función pura decide qué ruta y qué paso de la barra se bloquean. El store del alumno persiste `envioFirmaIniciado` en la sesión. El router y la barra la consultan. El regreso no llama a `ensure` ni a grabar el plan.

**Tech Stack:** Vue 3, TypeScript, Pinia, Vue Router, Vitest.

## Global Constraints

- Solo el flujo alumno. El flujo mock no cambia.
- El clic en Enviar a firmar guarda la bandera antes de que responda TuFirma.
- El regreso no llama a `ensure` ni a grabar el plan, y no borra el Webpay ni el número de operación.
- Si `firmaCompletada` es verdadero, el destino sigue siendo el resumen.
- El retorno de Webpay sigue permitido.
- Antes del clic, el atrás abre forma de pago.
- Un segundo Enviar a firmar sobre una operación que ya tiene documento reutiliza ese contrato. Ese comportamiento ya existe en `ensure` y no se reemplaza.
- No cambiar `HomeView`. Si el alumno sale y vuelve a entrar, el acceso que ya existe lo lleva a la firma porque el pago ya está elegido.
- No instalar una trampa de `popstate`. El `replace` del guard basta: cada atrás que caiga en un paso anterior se reemplaza por la firma.

---

### Task 1: Reglas puras de ruta y de barra

**Files:**
- Create: `src/utils/pasoAlumnoRematricula.test.ts`
- Modify: `src/utils/pasoAlumnoRematricula.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces:
  - `rutaSiEnvioFirmaBloquea(envioFirmaIniciado: boolean, nombreRuta: string | symbol | null | undefined): 'matricula-alumno-firma' | null`
  - `pasoBloqueadoTrasEnvio(input: { envioFirmaIniciado: boolean; firmaCompletada: boolean; step: number; pasoMaximo: number }): boolean`

- [ ] **Step 1: Write the failing test**

Crear `src/utils/pasoAlumnoRematricula.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  pasoBloqueadoTrasEnvio,
  rutaSiEnvioFirmaBloquea,
} from '@/utils/pasoAlumnoRematricula'

describe('rutaSiEnvioFirmaBloquea', () => {
  it('no redirige antes de enviar', () => {
    expect(rutaSiEnvioFirmaBloquea(false, 'matricula-alumno-forma-pago')).toBeNull()
    expect(rutaSiEnvioFirmaBloquea(false, 'matricula-alumno-datos')).toBeNull()
  })

  it('manda a la firma si el destino es un paso anterior', () => {
    expect(rutaSiEnvioFirmaBloquea(true, 'matricula-alumno-datos')).toBe(
      'matricula-alumno-firma',
    )
    expect(rutaSiEnvioFirmaBloquea(true, 'matricula-alumno-forma-pago')).toBe(
      'matricula-alumno-firma',
    )
  })

  it('deja pasar la firma, el resumen y el retorno de Webpay', () => {
    expect(rutaSiEnvioFirmaBloquea(true, 'matricula-alumno-firma')).toBeNull()
    expect(rutaSiEnvioFirmaBloquea(true, 'matricula-alumno-resumen')).toBeNull()
    expect(rutaSiEnvioFirmaBloquea(true, 'matricula-alumno-webpay-retorno')).toBeNull()
  })
})

describe('pasoBloqueadoTrasEnvio', () => {
  it('antes de enviar solo bloquea pasos todavía no alcanzados', () => {
    const base = { envioFirmaIniciado: false, firmaCompletada: false, pasoMaximo: 3 }
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 1 })).toBe(false)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 2 })).toBe(false)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 3 })).toBe(false)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 4 })).toBe(true)
  })

  it('después de enviar bloquea datos y forma de pago, y deja la firma', () => {
    const base = { envioFirmaIniciado: true, firmaCompletada: false, pasoMaximo: 3 }
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 1 })).toBe(true)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 2 })).toBe(true)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 3 })).toBe(false)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 4 })).toBe(true)
  })

  it('con la firma completa solo deja el resumen', () => {
    const base = { envioFirmaIniciado: true, firmaCompletada: true, pasoMaximo: 4 }
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 1 })).toBe(true)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 2 })).toBe(true)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 3 })).toBe(true)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 4 })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/pasoAlumnoRematricula.test.ts`

Expected: FAIL. `rutaSiEnvioFirmaBloquea` y `pasoBloqueadoTrasEnvio` no están exportadas.

- [ ] **Step 3: Write minimal implementation**

Agregar al final de `src/utils/pasoAlumnoRematricula.ts`:

```ts
const RUTA_FIRMA_ALUMNO = 'matricula-alumno-firma'

export function rutaSiEnvioFirmaBloquea(
  envioFirmaIniciado: boolean,
  nombreRuta: string | symbol | null | undefined,
): typeof RUTA_FIRMA_ALUMNO | null {
  if (!envioFirmaIniciado || typeof nombreRuta !== 'string') return null
  if (
    nombreRuta === 'matricula-alumno-datos' ||
    nombreRuta === 'matricula-alumno-forma-pago'
  ) {
    return RUTA_FIRMA_ALUMNO
  }
  return null
}

export function pasoBloqueadoTrasEnvio(input: {
  envioFirmaIniciado: boolean
  firmaCompletada: boolean
  step: number
  pasoMaximo: number
}): boolean {
  if (input.firmaCompletada) return input.step !== 4
  if (input.envioFirmaIniciado && (input.step === 1 || input.step === 2)) return true
  return input.step > input.pasoMaximo
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/pasoAlumnoRematricula.test.ts`

Expected: PASS. 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/pasoAlumnoRematricula.ts src/utils/pasoAlumnoRematricula.test.ts
git commit -m "$(cat <<'EOF'
feat(rematricula): decidir qué pasos se cierran al enviar el contrato

EOF
)"
```

---

### Task 2: Persistir la bandera en la sesión del alumno

**Files:**
- Create: `src/stores/matriculaAlumnoContext.test.ts`
- Modify: `src/stores/matriculaAlumnoContext.ts`

**Interfaces:**
- Consumes: nada de la Task 1.
- Produces: `useMatriculaAlumnoContextStore().envioFirmaIniciado: boolean` y `marcarEnvioFirmaIniciado(): void`. La acción pone la bandera en `true` y llama `persistToSessionStorage`. `hydrateFromSessionStorage` la recupera. `resetFlujo` la vuelve a `false`.

- [ ] **Step 1: Write the failing test**

Crear `src/stores/matriculaAlumnoContext.test.ts`. Vitest corre en Node, así que la prueba instala un `sessionStorage` en memoria.

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMatriculaAlumnoContextStore } from '@/stores/matriculaAlumnoContext'

const memoria = new Map<string, string>()

beforeEach(() => {
  memoria.clear()
  setActivePinia(createPinia())
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (clave: string) => memoria.get(clave) ?? null,
      setItem: (clave: string, valor: string) => {
        memoria.set(clave, valor)
      },
      removeItem: (clave: string) => {
        memoria.delete(clave)
      },
    },
  })
})

describe('envioFirmaIniciado', () => {
  it('guarda la bandera y la recupera en otra carga de la sesión', () => {
    const store = useMatriculaAlumnoContextStore()
    expect(store.envioFirmaIniciado).toBe(false)

    store.marcarEnvioFirmaIniciado()
    expect(store.envioFirmaIniciado).toBe(true)

    setActivePinia(createPinia())
    const restaurado = useMatriculaAlumnoContextStore()
    restaurado.hydrateFromSessionStorage()
    expect(restaurado.envioFirmaIniciado).toBe(true)
  })

  it('resetFlujo apaga la bandera', () => {
    const store = useMatriculaAlumnoContextStore()
    store.marcarEnvioFirmaIniciado()
    store.resetFlujo()
    expect(store.envioFirmaIniciado).toBe(false)
    expect(memoria.size).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config vitest.unit.config.ts src/stores/matriculaAlumnoContext.test.ts`

Expected: FAIL. `envioFirmaIniciado` no existe en el store.

- [ ] **Step 3: Write minimal implementation**

En `src/stores/matriculaAlumnoContext.ts`:

1. En `StoredAlumnoMatriculaContext`, después de `pasoAlcanzado: number`, agregar `envioFirmaIniciado: boolean`.
2. En `hasAnyProgressPayload`, agregar `parsed.envioFirmaIniciado === true` al `return`.
3. En `state`, después de `pasoAlcanzado: 1`, agregar `envioFirmaIniciado: false`.
4. En el objeto de `persistToSessionStorage`, agregar `envioFirmaIniciado: this.envioFirmaIniciado`.
5. En `hydrateFromSessionStorage`, después de asignar `pasoAlcanzado`, agregar `this.envioFirmaIniciado = parsed.envioFirmaIniciado === true`.
6. En `resetFlujo`, después de `this.pasoAlcanzado = 1`, agregar `this.envioFirmaIniciado = false`.
7. Nueva acción, junto a `marcarPasoAlcanzado`:

```ts
marcarEnvioFirmaIniciado() {
  if (this.envioFirmaIniciado) return
  this.envioFirmaIniciado = true
  this.persistToSessionStorage()
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config vitest.unit.config.ts src/stores/matriculaAlumnoContext.test.ts`

Expected: PASS. 2 tests.

Si `resetFlujo` falla al resetear stores ERP en Node, el fallo es de esos stores y no de la bandera. En ese caso deja la segunda prueba solo en `envioFirmaIniciado === false` después de asignar el reset de la bandera, y no llames `resetStoresErp` desde la prueba: llama `store.resetFlujo()` igual. Si el error es de un store ERP al importar, muévelo a un `try` no: corrige el import roto. No debilitar la prueba borrando la expectativa de la bandera.

- [ ] **Step 5: Commit**

```bash
git add src/stores/matriculaAlumnoContext.ts src/stores/matriculaAlumnoContext.test.ts
git commit -m "$(cat <<'EOF'
feat(rematricula): recordar en la sesión que el contrato ya se envió a firmar

EOF
)"
```

---

### Task 3: Conectar el router, la barra y el botón Enviar a firmar

**Files:**
- Modify: `src/router/index.ts` (el bloque `isAlumnoFlowRoute`, después del `if` de `firmaCompletada`)
- Modify: `src/views/matricula-alumno/MatriculaAlumnoLayout.vue` (`pasoBloqueado` y el setter de `stepModel`)
- Modify: `src/views/matricula-alumno/FirmaAlumnoView.vue` (`enviarAFirmar` y `anteriorDeshabilitado`)

**Interfaces:**
- Consumes: `rutaSiEnvioFirmaBloquea` y `pasoBloqueadoTrasEnvio` de la Task 1. `marcarEnvioFirmaIniciado` y `envioFirmaIniciado` de la Task 2.
- Produces: el clic en Enviar a firmar deja la bandera puesta. El router reemplaza datos y forma de pago por la firma. La barra deshabilita los pasos 1 y 2. Ninguno de esos caminos llama a `ensureContratoFirma` ni a `postGrabarPlanPagos`.

- [ ] **Step 1: Marcar el envío y leer la bandera en Anterior**

En `src/views/matricula-alumno/FirmaAlumnoView.vue`:

Quitar `const envioIniciado = ref(false)`.

Reemplazar el computed:

```ts
const anteriorDeshabilitado = computed(
  () => alumnoCtx.envioFirmaIniciado || enviando.value || firmantes.value.length > 0,
)
```

Dentro de `enviarAFirmar`, donde hoy está `envioIniciado.value = true`, dejar:

```ts
alumnoCtx.marcarEnvioFirmaIniciado()
enviando.value = true
```

No agregar llamadas a `ensureContratoFirma` ni a `postGrabarPlanPagos` en este cambio. El `ensure` que ya está más abajo en `enviarAFirmar` se mantiene.

- [ ] **Step 2: Redirigir en el router**

En `src/router/index.ts`, importar `rutaSiEnvioFirmaBloquea` desde `@/utils/pasoAlumnoRematricula`.

Dentro del `if (needsAuth && auth.isAuthenticated && isAlumnoFlowRoute(to.name))`, inmediatamente después del bloque que redirige a `matricula-alumno-resumen` cuando `firmaCompletada`, y antes del bloque de `apoderadoBloqueo`:

```ts
const firmaBloqueada = rutaSiEnvioFirmaBloquea(alumnoCtx.envioFirmaIniciado, to.name)
if (firmaBloqueada) {
  return { name: firmaBloqueada, replace: true }
}
```

Ese `return` no llama servicios. El bloque de `firmaCompletada` queda primero, así el resumen sigue ganando.

- [ ] **Step 3: Deshabilitar los pasos 1 y 2 en la barra**

En `src/views/matricula-alumno/MatriculaAlumnoLayout.vue`, importar `pasoBloqueadoTrasEnvio` junto a `pasoMaximoAlumno`.

Reemplazar `pasoBloqueado`:

```ts
function pasoBloqueado(step: number): boolean {
  return pasoBloqueadoTrasEnvio({
    envioFirmaIniciado: alumnoCtx.envioFirmaIniciado,
    firmaCompletada: alumnoCtx.firmaCompletada,
    step,
    pasoMaximo: pasoMaximo.value,
  })
}
```

Reemplazar el setter de `stepModel` para que use esa misma función. Así un clic en un paso deshabilitado no navega, y con la firma completa el paso 4 sí abre el resumen:

```ts
set: (v: number | undefined) => {
  if (v === undefined || pasoBloqueado(v)) return
  const n = STEP_NAMES[v - 1]
  if (n) void router.push({ name: n })
},
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/pasoAlumnoRematricula.test.ts src/stores/matriculaAlumnoContext.test.ts`

Expected: PASS. 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/router/index.ts src/views/matricula-alumno/MatriculaAlumnoLayout.vue src/views/matricula-alumno/FirmaAlumnoView.vue
git commit -m "$(cat <<'EOF'
fix(rematricula): no dejar volver atrás después de enviar el contrato a firmar

EOF
)"
```

## Verificación manual

Con un alumno que todavía no pulsó Enviar a firmar: Anterior y el paso Forma de pago abren esa pantalla.

Después de pulsar Enviar a firmar: Anterior está deshabilitado, los pasos 1 y 2 de la barra no navegan, y el atrás del navegador o la URL `/dashboard/matricula-alumno/forma-pago` terminan en la firma. En la red de esa navegación no aparece `POST .../contrato/firma/ensure` ni el grabado del plan.

Si se pulsa Enviar a firmar otra vez y la operación ya tiene documento, la respuesta trae el mismo número y no un documento nuevo.

Cuando todos firmaron, la pantalla que se abre es el resumen.
