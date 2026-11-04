# Pixarrón: claves con `+` en el path

Fecha: 2026-11-04  
Proyectos: `autenticacion-uniacc-api-docker` (cambio), `mol-docker` (consumo vía `/api/auth`)  
Estado: implementado en mol-dev

## Problema

MOL autentica alumnos de rematrícula con Pixarrón:

`GET {PIXARRON_SERVICE_URL}/api/acceso/{usuario}/{clave}`

La clave va en el **path**. Si contiene el carácter ASCII `+` (U+002B), IIS de Pixarrón responde **404 HTML** (“File or directory not found”). `encodeURIComponent` produce `%2B` y también falla.

MOL traduce ese 404 al mensaje:

«Servicio de acceso no encontrado. Comprueba la URL del API o el proxy.»

Eso engaña: el proxy y auth están; el path hacia Pixarrón es el que rompe.

Caso: alumno en cartera de rematrícula (`kenny.recabarren`), clave con `+`. No está en `mv_usuario`, así que el flujo es Pixarrón (alumno), no LDAP.

## Evidencia (prod, desde `autenticacion-api`)

| Clave en la URL | HTTP | Cuerpo |
|---|---|---|
| `Sebastian10+` / `Sebastian10%2B` | 404 | HTML IIS |
| Query / POST alternativos | 404 / 405 | no hay contrato |
| Base64 de la clave en el path | 200 | `permiteAcceso: "0"` (Pixarrón no decodifica; clave literal incorrecta) |
| `Sebastian10＋` (plus fullwidth U+FF0B) | 200 | `permiteAcceso: "1"`, `tipo: "alumno"` |
| `ClaveMal＋` | 200 | `permiteAcceso: "0"` (sigue validando) |

Conclusión: Pixarrón **normaliza** el plus fullwidth al `+` real de la clave. El ASCII `+` no debe ir en el path.

## Decisión

En `fetchPixarronAcceso` (`autenticacion-uniacc-api-docker`), antes de armar la URL:

1. Sustituir cada `+` (U+002B) de la clave por `＋` (U+FF0B) **solo para el segmento de path**.
2. Aplicar `encodeURIComponent` al usuario y a esa clave de path.
3. Si la respuesta no es OK y el cuerpo parece HTML 404 de IIS, devolver un mensaje que no culpe al proxy, por ejemplo: que no se pudo validar el acceso en el servicio (posible carácter especial en la clave) y que reintente o contacte soporte.

No se cambia el contrato HTTP de `POST /api/auth`. No se escribe la clave en logs. No se altera LDAP ni `mv_usuario`.

## Alcance

Incluye:

- `src/api/pixarronAcceso.ts` (y tests del módulo).
- Despliegue primero en **mol-dev** (`autenticacion-api` en el host de desarrollo).
- Luego copia a **uniacc-mol** (prod), mismo patrón rsync + rebuild.

No incluye:

- Nuevo endpoint en Pixarrón.
- Alta en `mv_usuario` / LDAP para este alumno.
- Cambiar el mensaje genérico de “acceso no permitido” (`permiteAcceso: "0"`).
- Normalizar otros caracteres salvo que aparezca evidencia igual de clara (hoy `# ? / %` espacio con `encodeURIComponent` llegan a la app).

## Prueba

1. Unit: clave con `+` → la URL armada contiene U+FF0B (o su forma percent-encoded), no U+002B ni un `%2B` solo.
2. Unit: 404 con cuerpo HTML → mensaje nuevo, no el de “URL del API o el proxy”.
3. En mol-dev: login alumno con clave que tenga `+` → 200 auth OK (o el `permiteAcceso` real), sin 404 mapeado a proxy.
4. Control: clave sin `+` sigue igual.
5. Tras OK en mol-dev, copiar a uniacc-mol y repetir el caso de cartera.

## Fuera de esta entrega

Pedir a Pixarrón un contrato sin clave en el path (query/body) sigue siendo deseable a largo plazo; no bloquea este fix.
