### Task 4: Tarjeta en resumen del alumno

**Files:**
- Create: `src/components/rematricula/NpsRematriculaCard.vue`
- Modify: `src/views/matricula-alumno/ResumenAlumnoView.vue`

**Interfaces:**
- Consumes: `estadoNpsRematricula`, `guardarNpsRematricula`, `useDatosAlumnoMnpStore().primeraFila`, `usePeriodoActivoStore()`, `useMatriculaAlumnoContextStore().sesionId`
- Produces: UI no bloqueante; descarga del contrato intacta

- [ ] **Step 1: Crear `NpsRematriculaCard.vue`**

Comportamiento:
1. Al montar, si hay `codcli` + periodo, llama `estadoNpsRematricula`.
2. Si `respondio`, muestra «Gracias, ya registramos tu evaluación.» y no el formulario.
3. Si no, muestra título «Evalúa tu experiencia», la pregunta del spec, botones 1–5 (`cursor-pointer`), botón secundario «Ahora no» que solo oculta la tarjeta en la sesión (`omitidoLocal = true` sin POST).
4. Si elige 1–3, muestra `Textarea` opcional (maxlength 500).
5. Botón «Enviar evaluación» llama `guardarNpsRematricula` con `rut_alumno`, `codcli`, `codigo_carrera`, `jornada_carrera` (como `jornada`) desde `primeraFila`, y periodo activo.
6. Si faltan campos obligatorios, no enviar; mostrar mensaje «No pudimos preparar la evaluación. Reintenta más tarde.»
7. Error de guardado: toast/mensaje + permitir reintento manteniendo selección.
8. Éxito: pasar a estado confirmado.

Copy de escala bajo los botones: «1 = muy difícil · 5 = muy fácil».

Usar componentes `Card`, `Button`, `Textarea` de `src/components/ui/`. No usar Options API.

- [ ] **Step 2: Montar en `ResumenAlumnoView.vue`**

Insertar la tarjeta **después** del bloque de datos (RUT/carrera/codcli) y **antes** de la sección de pagos Webpay / plan / botón descargar, para que la descarga siga visible y usable:

```vue
<NpsRematriculaCard />
```

Importar el componente en el `<script setup>`.

- [ ] **Step 3: Verificar manualmente**

1. Resumen sin respuesta → ve tarjeta; «Ahora no» la oculta; refresh la vuelve a mostrar.
2. Respuesta 5 → confirma; refresh → solo gracias.
3. Respuesta 2 con comentario → guarda; admin (Task 6) lo verá.
4. Descargar contrato sigue funcionando con o sin respuesta.

- [ ] **Step 4: Commit** (solo si el usuario lo pide)

---

