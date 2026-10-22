# Validar el teléfono sin saldo SMS en mol-dev

Fecha: 2026-10-22
Proyecto: `mol-docker` y `uniacc-api-docker`
Estado: diseño aprobado, pendiente de revisión del documento

## Problema

Celmedia responde el código 700 cuando no hay saldo. El diálogo del teléfono muestra «No hay saldo para enviar SMS.» y la prueba se detiene.

En mol-dev hay que repetir el flujo muchas veces y los créditos de SMS son pocos. uniacc-mol debe seguir exigiendo el código.

## Decisión

La API de mol-dev autoriza la validación solo cuando Celmedia responde 700 y la variable `OTP_SMS_BYPASS_SIN_SALDO` vale `true`. El navegador marca el teléfono como validado únicamente si recibe esa autorización. No interpreta el texto del error y no puede pedir el bypass.

uniacc-mol no define la variable. Allí el código 700 sigue mostrándose como error.

## Flujo

1. El alumno presiona **Enviar código SMS**. El número debe ser un celular chileno válido y la sesión debe estar identificada, igual que hoy.
2. La API llama a Celmedia.
3. Si el código es 700 y el bypass está activo:
   - No queda un OTP pendiente.
   - La respuesta es éxito con `validadoSinSms: true`.
   - El diálogo se cierra, el teléfono queda validado y no aparece el aviso rojo ni el toast de SMS enviado.
   - Si el correo ya estaba validado, el flujo actual avanza solo al paso siguiente. El correo sigue exigiendo su propio código.
   - El navegador registra el evento de contacto `verificar_ok` para ese teléfono.
4. Cualquier otro rechazo de Celmedia, un teléfono inválido o un límite de intentos se muestra como hoy.
5. La API deja en su log que la validación fue por falta de saldo. El evento `verificar_ok` lo escribe el navegador, igual que cuando el código SMS es correcto.

## Límites

- El bypass no se activa antes de llamar a Celmedia. Un número inválido no lo dispara.
- El correo no cambia.
- La variable vive en el entorno de la API de mol-dev. No se commitea en `true` y no se copia a uniacc-mol.
- El código 700 se reconoce por el código numérico de Celmedia, no por la frase en español.

## Pruebas

- Con el bypass apagado, el código 700 devuelve el error actual.
- Con el bypass encendido, el código 700 devuelve `validadoSinSms` y no deja un OTP pendiente.
- Con el bypass encendido, otro código de Celmedia sigue siendo un error.
- El navegador, al recibir `validadoSinSms`, valida el teléfono y no muestra el aviso rojo.
