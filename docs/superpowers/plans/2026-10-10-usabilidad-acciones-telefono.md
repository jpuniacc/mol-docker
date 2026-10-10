# Acciones del flujo y celular de 9 dígitos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En el flujo del alumno, la acción principal queda a la derecha en escritorio y arriba en celular, y el celular se ingresa como `+56` más 9 dígitos.

**Architecture:** `telefonoChile.ts` normaliza el número. `DatosPersonalesAlumnoView.vue` muestra el prefijo y escribe lo que esa función devuelve. `AccionesFlujo.vue` solo ordena dos slots. Cada pantalla pone el naranja y el outline.

**Tech Stack:** Vue 3, TypeScript, Vitest, Tailwind.

## Global Constraints

- Solo el flujo del alumno. No editar archivos de `src/views/matricula-mock/`.
- `TELEFONO_CHILE_PREFIJO` es `+56`. `TELEFONO_CHILE_DIGITOS_TRAS_PREFIJO` es `9`. El tope del input es `20`.
- 11 dígitos que parten con `56` pierden ese `56`. 9 dígitos se quedan igual, partan con 9, 8, 7 o 56. Otro largo no se convierte en un número de 9.
- Válido solo `+56` y exactamente 9 dígitos. Sin aviso cuando se quita el `56` de un pegado.
- Ayuda: `Ingresa los 9 dígitos del celular.` Error: `El celular debe tener 9 dígitos después de +56.`
- Máscara: `+56*****` más los últimos 4. Inválido: `***`.
- `fonoactParaSp` no se reescribe.
- Los tiempos del SMS no se cambian.
- `AccionesFlujo` no elige texto, clic ni color. Fila: `flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-end`. Cada botón: `w-full sm:w-auto`. Primaria: `bg-uniacc-orange hover:bg-uniacc-orange/90`. Secundaria: `variant="outline"`.
- No reescribir el pie que solo tiene Anterior, Enviar a firmar, ni el pie del diálogo de pago.
- No montar `AccionesFlujo` en un test.

## File structure

- `src/utils/telefonoChile.ts` — prefijo, extracción, validez y máscara.
- `src/utils/telefonoChile.test.ts` — casos de esa función.
- `src/views/matricula-alumno/DatosPersonalesAlumnoView.vue` — input del celular y cuatro parejas de botones.
- `src/components/rematricula/AccionesFlujo.vue` — orden de la pareja. Lo crean la tarea 3 y lo consumen las tareas 4 a 8.
- `src/views/matricula-alumno/MatriculaAlumnoApoderadoStep.vue` — sostenedor.
- `src/views/matricula-alumno/MatriculaAlumnoTyCStep.vue` — términos.
- `src/views/matricula-alumno/MatriculaAlumnoVerificacionEstatalStep.vue` — verificación estatal.
- `src/views/matricula-alumno/MatriculaAlumnoVerificacionCaeStep.vue` — verificación CAE.
- `src/views/matricula-alumno/FormaPagoAlumnoView.vue` — Generar cuotas.

El mock importa `TELEFONO_CHILE_PREFIJO` y `TELEFONO_CHILE_DIGITOS_TRAS_PREFIJO`. Al cambiar esas constantes hereda `+56` y 9 dígitos. No se corrigen sus textos que dicen «8 dígitos».

---

### Task 1: Normalizar el celular

**Files:**
- Create: `src/utils/telefonoChile.test.ts`
- Modify: `src/utils/telefonoChile.ts`
- Test: `src/utils/telefonoChile.test.ts`

**Interfaces:**
- Consumes: `fonoactParaSp(telefonoUi: string): string` en `src/services/actualizarDatosMolApi.ts`.
- Produces:
  - `TELEFONO_CHILE_PREFIJO = '+56'`
  - `TELEFONO_CHILE_DIGITOS_TRAS_PREFIJO = 9`
  - `TELEFONO_CHILE_INPUT_MAX = 20`
  - `extraerDigitosTelefonoChile(raw: string): string`
  - `normalizarTelefonoChile(raw: string): string`
  - `telefonoChileEsValido(s: string): boolean`
  - `enmascararTelefonoChile(s: string): string`

- [ ] **Step 1: Write the failing test**

Crear `src/utils/telefonoChile.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { fonoactParaSp } from '@/services/actualizarDatosMolApi'
import {
  enmascararTelefonoChile,
  extraerDigitosTelefonoChile,
  normalizarTelefonoChile,
  TELEFONO_CHILE_PREFIJO,
  telefonoChileEsValido,
} from '@/utils/telefonoChile'

describe('extraerDigitosTelefonoChile', () => {
  it('deja los 9 dígitos aunque partan con 9, 8, 7 o 56', () => {
    expect(extraerDigitosTelefonoChile('987654321')).toBe('987654321')
    expect(extraerDigitosTelefonoChile('812345678')).toBe('812345678')
    expect(extraerDigitosTelefonoChile('712345678')).toBe('712345678')
    expect(extraerDigitosTelefonoChile('561234567')).toBe('561234567')
  })

  it('quita el 56 de país solo cuando el pegado trae 11 dígitos', () => {
    expect(extraerDigitosTelefonoChile('+56987654321')).toBe('987654321')
    expect(extraerDigitosTelefonoChile('56987654321')).toBe('987654321')
    expect(extraerDigitosTelefonoChile('+56 9 8765 4321')).toBe('987654321')
  })

  it('no convierte un pegado de otro largo en un número de 9', () => {
    expect(extraerDigitosTelefonoChile('1234567890')).toBe('1234567890')
    expect(extraerDigitosTelefonoChile('569876543210')).toBe('56987654321')
    expect(extraerDigitosTelefonoChile('12345678')).toBe('12345678')
  })
})

describe('normalizarTelefonoChile', () => {
  it('guarda +56 más los 9 dígitos nacionales', () => {
    expect(TELEFONO_CHILE_PREFIJO).toBe('+56')
    expect(normalizarTelefonoChile('987654321')).toBe('+56987654321')
    expect(normalizarTelefonoChile('+56987654321')).toBe('+56987654321')
    expect(normalizarTelefonoChile('561234567')).toBe('+56561234567')
    expect(normalizarTelefonoChile('812345678')).toBe('+56812345678')
    expect(normalizarTelefonoChile('12345678')).toBe('+5612345678')
  })

  it('acepta solo +56 y exactamente 9 dígitos', () => {
    expect(telefonoChileEsValido('+56987654321')).toBe(true)
    expect(telefonoChileEsValido('+56812345678')).toBe(true)
    expect(telefonoChileEsValido('+56561234567')).toBe(true)
    expect(telefonoChileEsValido(normalizarTelefonoChile('12345678'))).toBe(false)
    expect(telefonoChileEsValido(normalizarTelefonoChile('1234567890'))).toBe(false)
    expect(telefonoChileEsValido(normalizarTelefonoChile('569876543210'))).toBe(false)
  })

  it('manda al ERP los dígitos sin el signo más', () => {
    expect(fonoactParaSp(normalizarTelefonoChile('987654321'))).toBe('56987654321')
    expect(fonoactParaSp(normalizarTelefonoChile('812345678'))).toBe('56812345678')
  })
})

describe('enmascararTelefonoChile', () => {
  it('enmascara un número válido con +56, cinco asteriscos y los últimos 4', () => {
    expect(enmascararTelefonoChile('+56987654321')).toBe('+56*****4321')
    expect(enmascararTelefonoChile('812345678')).toBe('+56*****5678')
  })

  it('devuelve *** si el número no es válido', () => {
    expect(enmascararTelefonoChile('12345678')).toBe('***')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/telefonoChile.test.ts`

Expected: FAIL. El prefijo sigue siendo `+569` y `561234567` se recorta a 8 dígitos.

- [ ] **Step 3: Write minimal implementation**

Reemplazar el contenido de `src/utils/telefonoChile.ts` por:

```ts
export const TELEFONO_CHILE_PREFIJO = '+56'
export const TELEFONO_CHILE_DIGITOS_TRAS_PREFIJO = 9
export const TELEFONO_CHILE_INPUT_MAX = 20

const DIGITOS_CON_PAIS = 11

/** Dígitos nacionales. Quita 56 solo si el pegado trae 11 dígitos. */
export function extraerDigitosTelefonoChile(raw: string): string {
  const digitos = raw.replace(/\D/g, '')
  if (digitos.length === DIGITOS_CON_PAIS && digitos.startsWith('56')) {
    return digitos.slice(2)
  }
  if (digitos.length === TELEFONO_CHILE_DIGITOS_TRAS_PREFIJO) {
    return digitos
  }
  return digitos.slice(0, DIGITOS_CON_PAIS)
}

/** +56 más los dígitos extraídos. Vacío si no hay dígitos. */
export function normalizarTelefonoChile(raw: string): string {
  const digitos = extraerDigitosTelefonoChile(raw)
  if (!digitos) return ''
  return `${TELEFONO_CHILE_PREFIJO}${digitos}`
}

export function telefonoChileEsValido(s: string): boolean {
  return new RegExp(`^\\+56\\d{${TELEFONO_CHILE_DIGITOS_TRAS_PREFIJO}}$`).test(s.trim())
}

/** Máscara de auditoría: +56*****4321. Inválido: ***. */
export function enmascararTelefonoChile(s: string): string {
  const norm = normalizarTelefonoChile(s)
  if (!telefonoChileEsValido(norm)) return '***'
  return `${TELEFONO_CHILE_PREFIJO}*****${norm.slice(-4)}`
}
```

El `if` de 11 dígitos va antes del recorte. Si se recorta primero, `569876543210` se vuelve un número válido.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/telefonoChile.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/telefonoChile.ts src/utils/telefonoChile.test.ts
git commit -m "$(cat <<'EOF'
feat(rematricula): aceptar el celular como +56 y 9 dígitos

EOF
)"
```

---

### Task 2: Mostrar +56 y 9 dígitos en datos del alumno

**Files:**
- Modify: `src/views/matricula-alumno/DatosPersonalesAlumnoView.vue`

**Interfaces:**
- Consumes: `extraerDigitosTelefonoChile`, `TELEFONO_CHILE_PREFIJO`, `TELEFONO_CHILE_INPUT_MAX` de la tarea 1.
- Produces: el campo del alumno escribe el resultado de `extraerDigitosTelefonoChile` y no corta el pegado en 9 caracteres.

- [ ] **Step 1: Cambiar el handler y el comentario del ref**

En el import de `@/utils/telefonoChile`, agregar `TELEFONO_CHILE_INPUT_MAX`. Se puede quitar `TELEFONO_CHILE_DIGITOS_TRAS_PREFIJO` de ese import si el template ya no lo usa.

Reemplazar el comentario y el handler:

```ts
/** 9 dígitos nacionales, sin el +56. */
const telefonoDigitosLocal = ref('')
```

```ts
function onTelefonoDigitosDomInput(e: Event) {
  const el = e.target as HTMLInputElement
  const next = extraerDigitosTelefonoChile(el.value)
  telefonoDigitosLocal.value = next
  if (el.value !== next) el.value = next
}
```

Reemplazar el mensaje de envío:

```ts
  if (!telefonoChileEsValido(tel)) {
    errorTelefono.value = `El celular debe tener 9 dígitos después de ${TELEFONO_CHILE_PREFIJO}.`
    return
  }
```

- [ ] **Step 2: Cambiar el campo**

El bloque del input del celular queda así:

```vue
            <div class="flex gap-2">
              <span
                class="flex h-10 shrink-0 items-center rounded-md border border-input bg-muted px-3 text-sm font-mono text-muted-foreground"
              >
                {{ TELEFONO_CHILE_PREFIJO }}
              </span>
              <input
                id="telefono-mock-modal"
                :value="telefonoDigitosLocal"
                type="text"
                inputmode="numeric"
                autocomplete="tel-national"
                autocorrect="off"
                autocapitalize="off"
                spellcheck="false"
                :maxlength="TELEFONO_CHILE_INPUT_MAX"
                pattern="[0-9]*"
                placeholder="987654321"
                :disabled="datosCargando || telefonoValidadoOk"
                :class="
                  cn(
                    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                    'font-mono tabular-nums tracking-wide',
                    telefonoFormatoInvalido ? 'border-destructive' : '',
                  )
                "
                @input="onTelefonoDigitosDomInput"
                @keydown="onTelefonoDigitosKeydown"
                @compositionend="onTelefonoDigitosDomInput"
                @blur="telefonoTocado = true"
              />
            </div>
            <p class="text-xs text-muted-foreground">
              Ingresa los 9 dígitos del celular.
            </p>
            <p v-if="telefonoFormatoInvalido" class="text-sm text-destructive">
              El celular debe tener 9 dígitos después de {{ TELEFONO_CHILE_PREFIJO }}.
            </p>
```

No cambiar los textos de vigencia ni de reenvío del SMS.

- [ ] **Step 3: Run the phone tests**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/telefonoChile.test.ts`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/views/matricula-alumno/DatosPersonalesAlumnoView.vue
git commit -m "$(cat <<'EOF'
feat(rematricula): pedir 9 dígitos de celular junto a +56

EOF
)"
```

---

### Task 3: Componente AccionesFlujo

**Files:**
- Create: `src/components/rematricula/AccionesFlujo.vue`

**Interfaces:**
- Consumes: nada de las tareas 1 y 2.
- Produces: componente con slot opcional `secundaria` y slot `primaria`. El orden del DOM es secundaria y después primaria, para que `flex-col-reverse` deje la primaria arriba en celular y `sm:flex-row` la deje a la derecha.

- [ ] **Step 1: Crear el componente**

```vue
<script setup lang="ts"></script>

<template>
  <div class="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-end">
    <slot name="secundaria" />
    <slot name="primaria" />
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/rematricula/AccionesFlujo.vue
git commit -m "$(cat <<'EOF'
feat(rematricula): agregar el orden común de la acción principal

EOF
)"
```

---

### Task 4: Sostenedor

**Files:**
- Modify: `src/views/matricula-alumno/MatriculaAlumnoApoderadoStep.vue`

**Interfaces:**
- Consumes: `AccionesFlujo` de la tarea 3.
- Produces: «No, necesito actualizarlos» a la izquierda o abajo, «Sí, estos datos son correctos» a la derecha o arriba.

- [ ] **Step 1: Importar y reemplazar la pareja**

Agregar el import junto a los otros componentes:

```ts
import AccionesFlujo from '@/components/rematricula/AccionesFlujo.vue'
```

Reemplazar el `div` de los dos botones por:

```vue
          <AccionesFlujo>
            <template #secundaria>
              <Button
                type="button"
                variant="outline"
                class="w-full sm:w-auto"
                :disabled="procesando"
                @click="marcarDesactualizado"
              >
                No, necesito actualizarlos
              </Button>
            </template>
            <template #primaria>
              <Button
                type="button"
                class="w-full bg-uniacc-orange hover:bg-uniacc-orange/90 sm:w-auto"
                :disabled="procesando"
                @click="confirmarOk"
              >
                {{ procesando ? 'Procesando…' : 'Sí, estos datos son correctos' }}
              </Button>
            </template>
          </AccionesFlujo>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/matricula-alumno/MatriculaAlumnoApoderadoStep.vue
git commit -m "$(cat <<'EOF'
feat(rematricula): poner a la derecha la confirmación del sostenedor

EOF
)"
```

---

### Task 5: Términos

**Files:**
- Modify: `src/views/matricula-alumno/MatriculaAlumnoTyCStep.vue`

**Interfaces:**
- Consumes: `AccionesFlujo` de la tarea 3.
- Produces: «No acepto» a la izquierda o abajo, «Acepto términos y condiciones» a la derecha o arriba.

- [ ] **Step 1: Importar y reemplazar la pareja**

```ts
import AccionesFlujo from '@/components/rematricula/AccionesFlujo.vue'
```

Reemplazar el `div.flex.flex-wrap.gap-3` de los dos botones por:

```vue
        <AccionesFlujo>
          <template #secundaria>
            <Button
              type="button"
              variant="outline"
              class="w-full sm:w-auto"
              :disabled="registrando"
              @click="solicitarRechazo"
            >
              No acepto
            </Button>
          </template>
          <template #primaria>
            <Button
              type="button"
              class="w-full bg-uniacc-orange hover:bg-uniacc-orange/90 sm:w-auto"
              :disabled="!puedeAceptar"
              @click="aceptar"
            >
              {{ registrando ? 'Registrando…' : 'Acepto términos y condiciones' }}
            </Button>
          </template>
        </AccionesFlujo>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/matricula-alumno/MatriculaAlumnoTyCStep.vue
git commit -m "$(cat <<'EOF'
feat(rematricula): poner a la derecha la aceptación de términos

EOF
)"
```

---

### Task 6: Verificación estatal

**Files:**
- Modify: `src/views/matricula-alumno/MatriculaAlumnoVerificacionEstatalStep.vue`

**Interfaces:**
- Consumes: `AccionesFlujo` de la tarea 3. Textos `ui.volver` y `ui.reintentar` de `@/constants/verificacionEstatal`.
- Produces: volver a la izquierda o abajo, reintentar a la derecha o arriba.

- [ ] **Step 1: Importar y reemplazar la pareja**

```ts
import AccionesFlujo from '@/components/rematricula/AccionesFlujo.vue'
```

Reemplazar el `div` de `reintentar` y `volver` por:

```vue
      <AccionesFlujo class="border-t border-zinc-200 pt-4">
        <template #secundaria>
          <Button
            type="button"
            variant="outline"
            class="w-full sm:w-auto"
            :disabled="reintentando"
            @click="emit('volver')"
          >
            {{ ui.volver }}
          </Button>
        </template>
        <template #primaria>
          <Button
            type="button"
            class="w-full bg-uniacc-orange hover:bg-uniacc-orange/90 sm:w-auto"
            :disabled="reintentando"
            @click="emit('reintentar')"
          >
            {{ reintentando ? ui.reintentando : ui.reintentar }}
          </Button>
        </template>
      </AccionesFlujo>
```

`AccionesFlujo` no declara props. La clase del borde pasa al raíz porque Vue la hereda en un componente de un solo nodo.

- [ ] **Step 2: Commit**

```bash
git add src/views/matricula-alumno/MatriculaAlumnoVerificacionEstatalStep.vue
git commit -m "$(cat <<'EOF'
feat(rematricula): poner a la derecha el reintento de verificación estatal

EOF
)"
```

---

### Task 7: Verificación CAE

**Files:**
- Modify: `src/views/matricula-alumno/MatriculaAlumnoVerificacionCaeStep.vue`

**Interfaces:**
- Consumes: `AccionesFlujo` de la tarea 3. Textos `ui.volver` y `ui.reintentar` de `@/constants/verificacionCae`.
- Produces: volver a la izquierda o abajo, reintentar a la derecha o arriba.

- [ ] **Step 1: Importar y reemplazar la pareja**

```ts
import AccionesFlujo from '@/components/rematricula/AccionesFlujo.vue'
```

Reemplazar el `div.flex.flex-col` que envuelve reintentar y volver por:

```vue
            <AccionesFlujo>
              <template #secundaria>
                <Button
                  type="button"
                  variant="outline"
                  class="w-full sm:w-auto"
                  :disabled="reintentando"
                  @click="emit('volver')"
                >
                  {{ ui.volver }}
                </Button>
              </template>
              <template #primaria>
                <Button
                  type="button"
                  class="w-full bg-uniacc-orange hover:bg-uniacc-orange/90 sm:w-auto"
                  :disabled="reintentando"
                  @click="emit('reintentar')"
                >
                  {{ reintentando ? ui.reintentando : ui.reintentar }}
                </Button>
              </template>
            </AccionesFlujo>
```

Dejar el `p` de `ui.ayudaBotones` donde está, debajo de la pareja.

- [ ] **Step 2: Commit**

```bash
git add src/views/matricula-alumno/MatriculaAlumnoVerificacionCaeStep.vue
git commit -m "$(cat <<'EOF'
feat(rematricula): poner a la derecha el reintento de verificación CAE

EOF
)"
```

---

### Task 8: Parejas de datos personales

**Files:**
- Modify: `src/views/matricula-alumno/DatosPersonalesAlumnoView.vue`

**Interfaces:**
- Consumes: `AccionesFlujo` de la tarea 3.
- Produces: en correo y celular, Cancelar a la izquierda y Aceptar a la derecha. Reenviar a la izquierda y Confirmar a la derecha. En celular, la primaria arriba.

- [ ] **Step 1: Importar el componente**

```ts
import AccionesFlujo from '@/components/rematricula/AccionesFlujo.vue'
```

- [ ] **Step 2: Seguir sin validar correo**

Reemplazar el `div.flex.flex-wrap.gap-2` de Cancelar y Aceptar del correo por:

```vue
            <AccionesFlujo>
              <template #secundaria>
                <Button
                  type="button"
                  variant="outline"
                  class="w-full sm:w-auto"
                  @click="cancelarContinuarSinOtpCorreo"
                >
                  {{ CONTACTO_OTP_SIN_VALIDAR_CANCELAR }}
                </Button>
              </template>
              <template #primaria>
                <Button
                  type="button"
                  class="w-full bg-uniacc-orange hover:bg-uniacc-orange/90 sm:w-auto"
                  @click="aceptarContinuarSinOtpCorreo"
                >
                  {{ CONTACTO_OTP_SIN_VALIDAR_ACEPTAR }}
                </Button>
              </template>
            </AccionesFlujo>
```

- [ ] **Step 3: Confirmar y reenviar el código de correo**

Reemplazar el `div` de Confirmar código y Reenviar código por:

```vue
                <AccionesFlujo>
                  <template #secundaria>
                    <Button
                      type="button"
                      variant="outline"
                      class="w-full sm:w-auto"
                      :disabled="
                        correoOtpEnviando ||
                        correoOtpVerificando ||
                        correoOtpReintentoBloqueado ||
                        !puedeEnviarCorreoOtp
                      "
                      @click="enviarCodigoCorreoOtp"
                    >
                      {{ correoOtpEnviando ? 'Enviando…' : 'Reenviar código' }}
                    </Button>
                  </template>
                  <template #primaria>
                    <Button
                      type="button"
                      class="w-full bg-uniacc-orange hover:bg-uniacc-orange/90 sm:w-auto"
                      :disabled="
                        correoOtpVerificando ||
                        correoOtpEnviando ||
                        correoOtpCountdownAgotado
                      "
                      @click="confirmarCodigoCorreoOtp"
                    >
                      {{ correoOtpVerificando ? 'Verificando…' : 'Confirmar código' }}
                    </Button>
                  </template>
                </AccionesFlujo>
```

- [ ] **Step 4: Seguir sin validar celular**

Reemplazar el `div` de Cancelar y Aceptar del celular por:

```vue
            <AccionesFlujo>
              <template #secundaria>
                <Button
                  type="button"
                  variant="outline"
                  class="w-full sm:w-auto"
                  @click="cancelarContinuarSinOtpTelefono"
                >
                  {{ CONTACTO_OTP_SIN_VALIDAR_CANCELAR }}
                </Button>
              </template>
              <template #primaria>
                <Button
                  type="button"
                  class="w-full bg-uniacc-orange hover:bg-uniacc-orange/90 sm:w-auto"
                  @click="aceptarContinuarSinOtpTelefono"
                >
                  {{ CONTACTO_OTP_SIN_VALIDAR_ACEPTAR }}
                </Button>
              </template>
            </AccionesFlujo>
```

- [ ] **Step 5: Confirmar y reenviar el SMS**

Reemplazar el `div` de Confirmar código SMS y Reenviar SMS por:

```vue
                <AccionesFlujo>
                  <template #secundaria>
                    <Button
                      type="button"
                      variant="outline"
                      class="w-full sm:w-auto"
                      :disabled="
                        telefonoOtpEnviando ||
                        telefonoOtpVerificando ||
                        telefonoOtpReintentoBloqueado ||
                        !puedeEnviarTelefonoOtp
                      "
                      @click="enviarCodigoTelefonoOtp"
                    >
                      Reenviar SMS
                    </Button>
                  </template>
                  <template #primaria>
                    <Button
                      type="button"
                      class="w-full bg-uniacc-orange hover:bg-uniacc-orange/90 sm:w-auto"
                      :disabled="
                        telefonoOtpVerificando ||
                        telefonoOtpCountdownAgotado
                      "
                      @click="confirmarCodigoTelefonoOtp"
                    >
                      {{ telefonoOtpVerificando ? 'Verificando…' : 'Confirmar código SMS' }}
                    </Button>
                  </template>
                </AccionesFlujo>
```

No mover el botón deshabilitado «Celular validado» ni el `DialogFooter` de Cerrar.

- [ ] **Step 6: Commit**

```bash
git add src/views/matricula-alumno/DatosPersonalesAlumnoView.vue
git commit -m "$(cat <<'EOF'
feat(rematricula): ordenar aceptar y confirmar en los datos del alumno

EOF
)"
```

---

### Task 9: Generar cuotas

**Files:**
- Modify: `src/views/matricula-alumno/FormaPagoAlumnoView.vue`

**Interfaces:**
- Consumes: `AccionesFlujo` de la tarea 3.
- Produces: «Generar cuotas» en naranja, alineado a la derecha. En celular, arriba y a ancho completo. Sin secundaria.

- [ ] **Step 1: Importar y reemplazar el botón**

```ts
import AccionesFlujo from '@/components/rematricula/AccionesFlujo.vue'
```

Reemplazar el `Button` de `generarCuotasPagare` por:

```vue
            <AccionesFlujo>
              <template #primaria>
                <Button
                  type="button"
                  class="w-full cursor-pointer bg-uniacc-orange hover:bg-uniacc-orange/90 sm:w-auto"
                  :disabled="!pagareFechaInicio || !pagareDiaVencimiento || cargandoPreflight"
                  @click="generarCuotasPagare"
                >
                  {{ cargandoPreflight ? 'Consultando…' : 'Generar cuotas' }}
                </Button>
              </template>
            </AccionesFlujo>
```

No cambiar Volver, Cancelar, Continuar ni Confirmar plan del `DialogFooter`.

- [ ] **Step 2: Commit**

```bash
git add src/views/matricula-alumno/FormaPagoAlumnoView.vue
git commit -m "$(cat <<'EOF'
feat(rematricula): marcar Generar cuotas como acción principal

EOF
)"
```

---

### Task 10: Cerrar el spec

**Files:**
- Modify: `docs/superpowers/specs/2026-10-10-usabilidad-acciones-telefono-design.md`

**Interfaces:**
- Consumes: nada.
- Produces: el spec queda en estado aprobado.

- [ ] **Step 1: Marcar el spec**

Cambiar la línea `Estado: en revisión` por `Estado: aprobado`.

- [ ] **Step 2: Correr los tests del celular otra vez**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/telefonoChile.test.ts`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-10-10-usabilidad-acciones-telefono-design.md
git commit -m "$(cat <<'EOF'
docs(rematricula): marcar aprobado el diseño de botones y celular

EOF
)"
```
