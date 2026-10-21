# Prueba pública de Pixarrón

Fecha: 2026-10-21  
Proyecto: `mol-docker` y `autenticacion-uniacc-api-docker`  
Estado: diseño aprobado (pendiente plan de implementación)

## Problema

Desde mol.uniacc.cl el login de alumnos que no están en `mv_usuario` llama a Pixarrón y recibe 504 a los 6 segundos. Desde mol-dev el mismo nombre llega a IIS en menos de un segundo. Hace falta una página, sin login de MOL, que dispare ese llamado desde el servidor y deje un log detallado en pantalla y en un archivo.

## Decisiones

| Tema | Decisión |
|------|----------|
| Quién entra | Cualquiera que conozca la URL. Sin login de MOL y sin clave de pruebas |
| Dónde se llama | Contenedor `autenticacion-api`, el mismo del login |
| Modos | Conectividad (`GET /`) y acceso (`GET /api/acceso/{usuario}/{clave}`) |
| Destino | Solo `PIXARRON_SERVICE_URL`. Hoy `https://pixarron.uniacc.cl` |
| Clave del alumno | Enmascarada en pantalla y en el archivo |
| Historial | Una línea JSON por intento en un archivo del contenedor. La pantalla muestra solo el intento recién hecho |
| Menú | La ruta no se agrega al menú |
| Login real | No se modifica |

## Página

Ruta pública `/prueba-pixarron`, nombre `prueba-pixarron`, vista `src/views/prueba/PruebaPixarronView.vue`. Queda fuera de `/dashboard`, así que el router no pide sesión.

El título indica que la prueba sale del servidor de mol.uniacc.cl. Hay un botón **Probar conectividad**. Más abajo, usuario y clave, y el botón **Probar acceso**, activo solo cuando ambos campos tienen texto. Mientras el servidor responde, los botones no se pueden volver a apretar. La página espera hasta 35 segundos, por encima de la suma de los topes de DNS, TLS y HTTP.

El resultado muestra un resumen y, debajo, el log completo en un bloque que se puede copiar. La clave no viaja en la query de la página.

Resumen:

| Condición | Texto |
|-----------|--------|
| La respuesta HTTP trae estado 504 | 504 |
| La cabecera `Server` contiene `IIS` | Llegó a IIS |
| Cualquier otro resultado | Otro error |

Un 404 con `Server: Microsoft-IIS/10.0` es llegada. El 504 se evalúa antes que la cabecera IIS.

## Endpoint

`POST /api/auth/prueba-pixarron` en `autenticacion-api`. El nginx de MOL ya reenvía `/api/auth` a ese contenedor. Esta ruta no usa `validateApiKey`.

Cuerpo:

```json
{ "modo": "conectividad" }
```

```json
{ "modo": "acceso", "usuario": "…", "clave": "…" }
```

`modo` solo acepta esos dos valores. En acceso, usuario y clave son obligatorios y no pueden ser solo espacios. Otro cuerpo responde 400 y no llama a Pixarrón.

Conectividad hace `GET {PIXARRON_SERVICE_URL}/`. Acceso hace `GET {PIXARRON_SERVICE_URL}/api/acceso/{usuario}/{clave}` con la autenticación básica de `PIXARRON_BASIC_USER` y `PIXARRON_BASIC_PASS`. Esas dos variables no se escriben en el log ni en la respuesta. El header `Authorization` tampoco.

Cada intento mide tres pasos, y un paso fallido no cancela el siguiente:

1. DNS, con tope de 5 segundos. Guarda las direcciones y el tiempo.
2. Conexión TLS al puerto de la URL (443 si no trae puerto), con tope de 8 segundos. Guarda tiempo de TCP, tiempo de TLS, protocolo, sujeto del certificado y huella SHA256. Cierra esa conexión.
3. El GET HTTP, con tope de 15 segundos. Guarda estado, cabeceras y como máximo 2 KB del cuerpo.

Si Pixarrón responde 504, corta la conexión o no contesta, el endpoint responde 200 con el log. El resumen sale de la tabla de arriba.

La clave se reemplaza por `***` en la URL, en el cuerpo y en cualquier texto del log, tanto en claro como codificada para URL. El reemplazo ocurre antes de cortar el cuerpo a 2 KB.

## Archivo

Se agrega una línea JSON, el mismo objeto `log` de la respuesta, en `/var/log/pixarron-prueba/pruebas.log`. El compose monta `./logs` del proyecto de autenticación en `/var/log/pixarron-prueba`. `logs/` ya está en `.gitignore`.

Si el archivo no se puede escribir, el llamado igual se hace. La respuesta sigue en 200, `guardado` queda en `false` y el resumen de la página avisa que no quedó guardado.

## Respuesta

Éxito, también cuando Pixarrón falla:

```json
{
  "ok": true,
  "guardado": true,
  "resumen": "504",
  "log": {}
}
```

`resumen` es `504`, `llego` u `otro`. La página los muestra como «504», «Llegó a IIS» y «Otro error».

El `log` incluye fecha ISO, modo, usuario solo en acceso, URL enmascarada, resultado de DNS, resultado TLS, estado HTTP, cabeceras, cuerpo recortado y, si un paso falla, nombre, mensaje y código del error.

Petición inválida: 400 con `{ "ok": false, "message": "…" }` y sin línea en el archivo.

## Fuera de alcance

- Cambiar el flujo de login o las variables de Pixarrón.
- Aceptar otra URL de destino.
- Mostrar el historial del archivo en la página.
- Publicar el archivo por HTTP.
- Agregar la ruta al menú.
- Poner un límite de intentos.

## Criterios de éxito

- `/prueba-pixarron` abre sin sesión y no aparece en el menú.
- Conectividad desde mol-dev: resumen «Llegó a IIS», con `Server: Microsoft-IIS/10.0` en el log y la misma línea en el archivo.
- Acceso con usuario y clave: la clave no aparece en la pantalla ni en el archivo.
- Acceso sin usuario o sin clave: 400 y ninguna llamada a Pixarrón.
- En mol.uniacc.cl, conectividad: resumen «504», tiempo cercano a 6 segundos, huella del certificado y sin cabecera de IIS.
- Si el archivo no se puede escribir, la pantalla igual muestra el log y avisa que no quedó guardado.

## Pruebas

En `autenticacion-uniacc-api-docker` se agregan pruebas con `node:test`, sin un framework nuevo. Cubren el enmascarado de la clave en claro y codificada, el resumen (`504`, `llego`, `otro`) y que un error de red igual arma el log.

En el navegador, en mol-dev, se abre la ruta sin sesión, se dispara la conectividad y se confirma que la pantalla y el archivo coinciden. El acceso se prueba con un usuario real y se revisa el enmascarado.

Después se publica el front y `autenticacion-api` en mol.uniacc.cl y se repite la conectividad. El login real no se toca.
