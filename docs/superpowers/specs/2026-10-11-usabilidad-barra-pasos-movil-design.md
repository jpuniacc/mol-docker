# Pasos y cabecera del alumno en el celular

Fecha: 2026-10-11  
Proyecto: `mol-docker`  
Estado: aprobado

## Problema

En el celular, los cuatro pasos del alumno no caben en el ancho. Hoy viven en una fila con `min-w-[28rem]` y hay que deslizar para ver Firma de contrato y Resumen final. La cabecera, además, ocupa varias filas: logo, «Salir» y la franja con el nombre.

## Decisión

Solo el flujo del alumno, en `src/views/matricula-alumno/MatriculaAlumnoLayout.vue`. El mock no se edita.

Bajo 768 px los pasos salen de la cabecera y quedan en una barra fija al pie. Desde 768 px la barra no existe: siguen los cuatro nombres arriba, como ahora.

## Barra

La barra es `fixed`, al pie, ancho completo, `z-40`, solo bajo `md`. Fondo blanco, borde superior `border-zinc-200`. Respeta el borde inferior del teléfono con `pb-[env(safe-area-inset-bottom)]`.

Cuatro botones, en este orden, con el número y el nombre corto:

| Paso | Nombre corto | Nombre completo, en el `aria-label` |
|---|---|---|
| 1 | Datos | Datos personales |
| 2 | Pago | Forma de pago |
| 3 | Firma | Firma de contrato |
| 4 | Resumen | Resumen final |

Cada botón ocupa un cuarto del ancho y mide al menos 44 px de alto. El paso actual va en `text-uniacc-orange` y `font-semibold`, y lleva `aria-current="step"`. Los demás van en `text-zinc-500`.

Un paso cerrado lleva `opacity-40` y se puede pulsar. Al pulsarlo se abre el aviso que ya existe: «Paso no disponible». Un paso abierto navega. La regla sigue siendo `accionAlPulsarPaso` y `pasoBloqueadoTrasEnvio` en `src/utils/pasoAlumnoRematricula.ts`. La barra no inventa otra.

## Cabecera

En el celular la cabecera actual se oculta: el logo grande, el botón «Salir», la franja azul y la fila del stepper. En su lugar hay una sola fila blanca, fija arriba con el resto de la cabecera.

A la izquierda, un botón de hamburguesa de al menos 44 px, icono `Menu` de Lucide, `aria-label="Abrir menú"`. Abre un panel lateral izquierdo (`Sheet`) con el nombre, el RUT, la carrera y el enlace Ayuda (`tel:+56226406000`, el mismo texto de hoy). No lleva el año. El panel se cierra al tocar fuera o al seguir Ayuda.

A la derecha, un botón circular de al menos 44 px con el logo de UNIACC dentro. `aria-label="Cuenta"`. Abre «Volver al inicio» y «Salir». Volver al inicio regresa al dashboard. Salir cierra la sesión.

Desde 768 px esa fila no se muestra. Vuelven el logo, «Salir», la franja azul y los cuatro nombres arriba.

## Espacio inferior

El contenedor de la página ya tiene `pb-24`. En el celular pasa a dejar libre la barra: `pb-28 md:pb-24` en el `div` raíz.

WhatsApp sigue fijo a la derecha. En el celular su `bottom` queda por encima de la barra (`bottom-24 md:bottom-6`) y su `z-50` queda sobre ella. Desde 768 px vuelve a `bottom-6`.

## Fuera de alcance

- El mock y el menú del dashboard.
- El contenido de Datos personales, Forma de pago, Firma de contrato y Resumen final.
- El texto del aviso, quién puede abrir cada paso, y el tamaño de la cabecera en el computador.

## Pruebas

No hay función nueva. El pulso del paso ya está cubierto en `src/utils/pasoAlumnoRematricula.test.ts`.

Al implementar, mirar el layout en 375 px y en 768 px. En el celular: hamburguesa, círculo de salir, barra de pasos, y ni el stepper de arriba ni el botón «Salir». En el computador: el stepper y la cabecera de hoy, sin hamburguesa ni barra. El botón naranja de la pantalla y WhatsApp quedan por encima de la barra.
