# Validación de contacto del alumno

Fecha: 2026-10-11  
Proyecto: `mol-docker`  
Estado: aprobado

## Problema

En el paso de contacto, las instrucciones se leen como dos párrafos del mismo peso. No se distingue el correo del celular ni la instrucción del aviso.

## Decisión

Solo el paso de contacto del alumno, en `src/views/matricula-alumno/DatosPersonalesAlumnoView.vue`. El computador y el celular usan el mismo bloque. El mock no se edita.

## Bloque

El título sigue siendo **Validación de contacto**.

Debajo, una lista ordenada de dos filas. Cada fila tiene un círculo naranja (`#E8621A`) con el número en blanco y el texto al lado. El círculo no es un botón.

1. **Correo personal.** Línea secundaria: «Te enviamos un código de 6 dígitos.»
2. **Celular.** La misma línea secundaria.

Debajo de la lista, en gris y más chico: «Si cambias un dato ya validado, hay que validarlo de nuevo.»

La lista es un `ol` sin viñeta (`list-style: none`). Solo el círculo muestra el número. El círculo es decorativo (`aria-hidden`) porque el orden ya lo anuncia la lista.

## Lo que no cambia

- Las tarjetas de correo y celular: dato, estado Pendiente / Código enviado / Validado, y el botón **Validar / actualizar**.
- La etiqueta de la tarjeta del teléfono sigue siendo «Teléfono móvil (celular)».
- El aviso de abajo que pide validar ambos para continuar.
- Los modales, los códigos y el paso siguiente.

## Fuera de alcance

- El mock (`DatosPersonalesMockView.vue`).
- La cabecera, la barra de pasos y el inicio.
- Los tiempos del código y el texto de los modales.
