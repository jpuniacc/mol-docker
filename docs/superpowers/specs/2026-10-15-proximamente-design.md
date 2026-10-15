# Pantalla Próximamente

Fecha: 2026-10-15  
Proyecto: `mol-docker`  
Estado: aprobado

## Problema

MOL debe poder cerrar la entrada pública con un mensaje, y volver a abrirla sin un despliegue. Mientras está cerrada, un administrativo puede desbloquear el login habitual en su pestaña.

## Decisión

Una pantalla propia en `/proximamente` y una fila de configuración. El interruptor parte apagado.

## Lo que ve quien entra

La pantalla usa el mismo marco que el login: logo UNIACC, título del periodo y tarjeta blanca.

Dentro de la tarjeta, en este orden:

1. Saludo fijo: **Hola** y el icono Lucide `Hand`, con un movimiento breve de saludo. Si el sistema pide menos movimiento, el icono queda quieto.
2. El mensaje guardado.
3. Usuario y contraseña, para administrativos.

Texto inicial del mensaje:

«El proceso de rematrícula estará disponible próximamente. Cuando se habilite, podrás ingresar con tu usuario y contraseña habituales.»

## Interruptor apagado

`/`, `/login` y `/proximamente` muestran el login habitual. El desbloqueo de la pestaña no hace falta.

## Interruptor prendido

Quien no tiene sesión de MOL y abre `/` o `/login` cae en `/proximamente`. Un acceso directo a `/login` también.

El inicio de sesión de esa pantalla llama al mismo flujo de credenciales que el login y no guarda sesión:

- Contraseña incorrecta: el mismo aviso de error del login. No hay desbloqueo.
- Credenciales de un alumno (sin fila en `mv_usuario`): no hay desbloqueo ni sesión. El aviso dice que ese acceso es solo para administrativos.
- Credenciales de un administrativo (hay fila en `mv_usuario`, grupo DVU, Admisión o TI): se guarda el desbloqueo en `sessionStorage` de esa pestaña y se abre el login habitual de MOL. La sesión de MOL sigue cerrada.

Al cerrar la pestaña o el navegador, el desbloqueo desaparece. Con la pestaña desbloqueada, `/proximamente` abre el login habitual.

Quien ya tiene sesión de MOL no pasa por esta pantalla. Sigue en el dashboard.

Si la fila de configuración no se puede leer, se muestra el login habitual.

## Mantenedor

Nombre de menú: **Próximamente**. Ruta `dashboard-mantenedor-proximamente`, bajo el mismo grupo de menú que los otros mantenedores de rematrícula (`b0000001-0001-4000-8000-000000000024`). Ítem asignado al grupo DVU (1). TI lo ve por la regla actual del menú (el grupo 3 ve todo). Admisión no tiene el ítem.

La ruta exige administrativo, grupo DVU o TI, y perfil 1, 2 o 3. Quien no cumple vuelve al inicio del dashboard.

En la pantalla: interruptor, campo del mensaje y guardar. El saludo no se edita. Un mensaje vacío no se guarda.

## Tabla

`public.tp_mol_proximamente`, una sola fila.

- `activo boolean`, parte en `false`.
- `mensaje text`, parte con el texto inicial. No puede quedar vacío.
- `actualizado_en timestamptz`, lo pone la base al guardar.

`anon` y `authenticated` pueden leer la fila, porque la pantalla aparece antes del login. El mantenedor la actualiza con el cliente de la app. Quién puede abrir esa pantalla lo deciden el menú y la ruta, como en los otros mantenedores. Si la fila llegara con el mensaje en blanco, la pantalla muestra solo el saludo.

## Lo que no cambia

- El login habitual, una vez desbloqueado o con el interruptor apagado.
- Las sesiones que ya están abiertas.
- El mock y el flujo del alumno después de entrar.
