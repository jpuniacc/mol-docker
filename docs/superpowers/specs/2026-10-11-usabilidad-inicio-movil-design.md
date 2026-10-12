# Inicio del alumno en el celular

Fecha: 2026-10-11  
Proyecto: `mol-docker`  
Estado: aprobado

## Problema

En el celular el inicio repite «Rematrícula 2027-1» en la cabecera, en la franja de color y como «Periodo». «Tus datos» queda antes del botón de continuar. Salir es un icono de flecha.

## Decisión

Solo el alumno de Pixarrón, bajo 768 px. El computador no cambia. El mock no se edita.

## Cabecera

En `src/views/dashboard/layout/DashboardView.vue`, si el usuario es alumno Pixarrón, la cabecera de hoy se oculta en el celular.

Una fila blanca: hamburguesa a la izquierda (`Menu`, al menos 44 px, `aria-label="Abrir menú"`) y un círculo con el logo de UNIACC a la derecha (`aria-label="Cuenta"`). El círculo abre dos opciones: «Volver al inicio» y «Salir». Salir cierra la sesión.

La hamburguesa abre un `Sheet` izquierdo con el nombre, el RUT, la carrera y Ayuda (`tel:+56226406000`). No abre el menú del personal. No lleva el año.

Desde 768 px vuelve la cabecera de hoy, con el menú lateral.

## Página

En `src/views/dashboard/home/HomeView.vue`, solo en la vista del alumno y solo bajo 768 px:

- Se ocultan la franja de color y la línea «Periodo».
- Primero va «Hola» y la tarjeta «Tu rematrícula», con el botón naranja a la derecha y la lista de pasos.
- «Tus datos» no está en la página. El nombre, el RUT y la carrera viven en la hamburguesa.

Desde `md` se ven la franja y el periodo. «Tus datos» no vuelve: la identidad queda en el menú.

## Fuera de alcance

- El flujo de rematrícula (`MatriculaAlumnoLayout.vue`).
- El menú del personal y el mock.
- El texto de los pasos y la regla de Pendiente, En curso y Listo.
