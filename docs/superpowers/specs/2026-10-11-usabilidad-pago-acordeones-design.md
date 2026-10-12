# Acordeones del pago en el celular

Fecha: 2026-10-11  
Proyecto: `mol-docker`  
Estado: aprobado

## Problema

En el celular, la pantalla de pago abre con la ficha de carrera, el promedio y los beneficios. El arancel y la matrícula quedan abajo.

## Decisión

Solo el alumno, solo el paso de becas y plan en `src/views/matricula-alumno/FormaPagoAlumnoView.vue`, y solo bajo 768 px. Desde 768 px esas tres fichas siguen desplegadas y el título no es un botón. El mock no se edita.

## Cerradas al entrar

Tres filas blancas, independientes. Cada una parte cerrada y se abre sola. Se pueden tener varias abiertas a la vez.

Cada fila es un botón de al menos 44 px de alto. Muestra solo el título y un chevron (`ChevronDown` de Lucide). Cerrada no muestra la carrera, la nota ni si hay beneficios.

- **Carrera**
- **Tu promedio**
- **Tus beneficios**

El botón tiene `aria-expanded`. El chevron es decorativo.

Al abrir, aparece el contenido de hoy:

- Carrera: nombre, tipo, jornada, periodo, nombre del alumno y RUT, incluida la franja de color.
- Tu promedio: la nota, la etiqueta y la frase del efecto sobre las becas.
- Tus beneficios: el texto del periodo y la lista, o el aviso de que no hay beneficios.

## Lo que no cambia

- Arancel y matrícula siguen abiertos, con totales, avisos y botones.
- Los subpasos de verificación CAE y beneficio estatal.
- El botón de WhatsApp y la barra de pasos.

## Fuera de alcance

- El mock.
- El inicio, la validación de contacto y la firma.
- Escritorio, desde 768 px.
