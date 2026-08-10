# Memoria de Contexto IA — Ecosistema Uniacc (auth + dashboard admisión)

> Memoria técnica del estado **real** del código y decisiones de arquitectura.
> Leer antes de retomar desarrollo sobre cualquiera de los servicios aquí descritos.

---

## 1. Visión General del Sistema

Piezas principales que conviven en operación:

| Componente | Tipo | Ruta | Puerto (referencia) |
|---|---|---|---|
| `autenticacion-uniacc-api-docker` | API HTTP Express (Docker) | `/opt/autenticacion-uniacc-api-docker` | `9502` / Traefik `:9080/api/auth` |
| `ldap-autenticacion-docker` | LDAP (Docker, red interna) | `/opt/ldap-autenticacion-docker` | `9500` interno |
| `autenticacion_uniacc` | Legacy fallback | `/opt/autenticacion_uniacc` | `9502` manual |
| `ldap-autenticacion` | Legacy fallback | `/opt/ldap-autenticacion` | `9500` manual |
| `rematricula-online` | Frontend Vue 3 + Vite | `/opt/rematricula-online` | `9501` (dev) |
| `uniacc-api-docker` | API Express (Docker) | `/opt/uniacc-api-docker` | Traefik `:9080/api` |
| `supabase` | Stack Docker (PostgreSQL + Kong + …) | `/opt/supabase` | `8000` (Kong gateway) |

**Arranque auth (producción):** `cd /opt/ldap-autenticacion-docker && docker compose up -d` luego `cd /opt/autenticacion-uniacc-api-docker && docker compose up -d` (o `./scripts/start-auth-stack.sh`).

---

## 2. Estado Actual vs Arquitectura Objetivo

### Estado Actual (Implementado)
```
[Browser / WhatsApp Bot / cualquier cliente]
   │  POST /api/auth  (JSON con credenciales)
   │  Header: X-API-Key: <clave_del_cliente>
   ▼
[autenticacion_uniacc API :9502]
   │  valida API Key + origin
   │  ejecuta flujo según origin
   ├──► POST /validate ──► [ldap-autenticacion :9500] ──► [AD Uniacc LDAP]
   ├──► GET  /api/acceso ──► [pixarron.uniacc.cl]
   └──► Supabase REST   ──► [supabase-kong :8000]
```

---

## 3. Componente: `autenticacion_uniacc`

### Ruta
`/opt/autenticacion_uniacc`

### Rol actual
**Servidor HTTP Express en el puerto 9502** que expone endpoints REST (`/api/auth`),
recibe el JSON de cualquier cliente, valida la API Key, ejecuta el flujo contra LDAP o Pixarron y devuelve el resultado. Ya no actúa como librería inyectada en el browser.

### Comandos
```bash
npm run build   # compilar para producción / después de cambios
npm run dev     # tsc --watch (recompila automáticamente)
```

### Estructura de archivos
```
src/
  api/
    ldapAuth.ts         # fetch a LDAP en puerto 9500 con passwordB64
    pixarronAcceso.ts   # fetch directo a pixarron.uniacc.cl/api/acceso
  core/
    loginAudit.ts       # logger de intentos de sesión vía Supabase RPC
    loginFlow.ts        # orquestador: createAuthFlow(supabase) → { runLoginFlow }
  utils/
    uniaccEmail.ts      # normaliza/valida emails @uniacc.cl
    sanitize.ts         # sanitizeUsernameInput
  server.ts             # Servidor Express HTTP
```

### Exportaciones clave
```typescript
// Flujo principal
createAuthFlow(supabase: SupabaseClient)
  → { runLoginFlow(username, passwordB64, urlOrigen, origin) }

// Tipos
AuthOrigin = 1 | 2 // (1 = rematricula-online, 2 = whatsapp)
LoginResult = LoginSuccess | LoginFailure
```

### Lógica de enrutamiento por `origin`
```
origin === 1 (Rematricula)
  → busca en mv_usuario (Supabase)
  → si existe: valida LDAP
  → si no existe: valida Pixarron

origin === 2 (WhatsApp)
  → va DIRECTO a Pixarron API (sin LDAP ni Supabase lookup)
```

### Manejo de password
- **Cliente → librería**: el password llega como Base64 (`passwordB64 = btoa(password)`)
- **Librería internamente**: decodifica con `atob(passwordB64)` antes de usarlo
- **Librería → LDAP server**: re-codifica en Base64 en el body del fetch (`btoa(password)`)
- **LDAP server**: decodifica con `Buffer.from(v, 'base64').toString('utf8')` antes del bind

---

## 4. Componente: `ldap-autenticacion`

### Ruta
`/opt/ldap-autenticacion`

### Rol
Servidor Express que se conecta directamente a los servidores de Active Directory de Uniacc
usando `ldapjs`. Expone endpoints HTTP para validar credenciales.

### Endpoints
```
GET  /health              → sin auth, verifica que el servicio está vivo
POST /validate            → requiere X-API-Key o Authorization: Bearer
POST /api/v1/auth/ldap    → idéntico a /validate (ruta alternativa)
```

### Autenticación (API Key)
- La clave se envía en header `X-API-Key: <valor>` o `Authorization: Bearer <valor>`
- Obligatoria si `NODE_ENV=production`
- Comparación en tiempo constante (`crypto.timingSafeEqual`) para evitar timing attacks

### Servidores LDAP configurados
```
LDAP_SERVER_1=172.16.0.184  (ldap-adm.uniacc.cl)
LDAP_SERVER_2=172.16.1.97   (acad)
```
Solo accesibles desde la red interna Uniacc o con VPN activa.

### Decodificación de password
El body llega con `password` en Base64. El servidor decodifica:
```javascript
const password = Buffer.from(passwordRaw, 'base64').toString('utf8')
```

### Configuración
Lee en este orden de prioridad (sin sobreescribir):
1. `/opt/autenticacion_uniacc/.env.shared` (fuente principal)
2. `/opt/ldap-autenticacion/.env` (fallback local para desarrollo sin shared)

### Comando
```bash
cd /opt/ldap-autenticacion && node server.js
```

---

## 5. Componente: `rematricula-online`

### Ruta
`/opt/rematricula-online`

### Stack
Vue 3 + Vite + TypeScript + Pinia + Supabase JS SDK + TailwindCSS

### Puerto dev
`9501`

### Configuración del proxy Vite (`vite.config.ts`)
El proxy agrega la API Key compartida y redirige transparentemente:
```typescript
server: {
  port: 9501,
  proxy: {
    '/api/auth': {
      target: env.AUTH_API_URL, // http://localhost:9502
      changeOrigin: true,
      configure: (proxy) => {
        // inyecta 'X-API-Key' para autorizar el cliente
      }
    },
    '/mineduc': { ... }
  }
}
```

### Login (`src/views/auth/LoginView.vue` y `src/services/auth.ts`)
```typescript
// En LoginView.vue
const result = await runLoginFlow(
  username,
  btoa(password),         // Base64
  window.location.href
)

// En services/auth.ts (donde el origin se saca dinámicamente)
  origin: AuthOrigin = (Number(import.meta.env.VITE_AUTH_ORIGIN) as AuthOrigin) || 1
```

### Integración
A través de un fetch directo y simple a `/api/auth` devolviendo la misma promesa que la librería devolvía originalmente. El frontend ya no necesita preocuparse de los endpoints ni credenciales reales de Active Directory o Pixarron.

### Variables de entorno importantes (`.env`)
```env
VITE_SUPABASE_URL="http://172.16.0.206:8000"   # IP del servidor, NO localhost
VITE_SUPABASE_KEY="eyJ..."
AUTH_API_URL="http://localhost:9502"
REMATRICULA_API_KEY="uniacc_mi_llave_generada"
VITE_AUTH_ORIGIN=1
VITE_AUTH_AMBIENTE=1

# API admisión (postulantes / matriculados / firma-acepta). En LAN, usar IP/host alcanzable desde el navegador:
# VITE_API_URL=http://172.16.0.206:3001

# Matrícula mock (cabecera): solo llegan al cliente si llevan prefijo VITE_
VITE_MNP_MV_ANIO_MATRICULA=2026
VITE_MNP_MV_PERIODO_MATRICULA=2
```

### Dashboard admisión — `uniacc-api` y variable `VITE_API_URL`
- Listados **postulantes**, **matriculados** y **estado firma ACEPTA** consumen **HTTP** a `uniacc-api` (`/api/postulantes`, `/api/matriculados`, `/api/firma-acepta`, etc.), no PostgREST desde el navegador para esas pantallas.
- En **producción** o cuando el front se sirve en un host/puerto distinto al de la API (p. ej. front `http://172.16.0.206:9501` y API `:3001`), el bundle debe construirse con **`VITE_API_URL`** apuntando a la base de `uniacc-api` (sin barra final), p. ej. `http://172.16.0.206:3001`. Sin eso, las peticiones relativas `/api/...` van al mismo origen del SPA y fallan si no hay reverse proxy.
- En **desarrollo**, `vite.config.ts` hace proxy de `/api/postulantes`, `/api/matriculados`, `/api/firma-acepta` hacia `VITE_ADMISION_API_TARGET` (por defecto `http://127.0.0.1:3001`).
- **CORS:** `uniacc-api` debe incluir el origen del dashboard en `CORS_ORIGIN`.

> ⚠️ `VITE_SUPABASE_URL` debe usar la IP del servidor (no `localhost`) porque el browser
> accede desde equipos remotos. `localhost` solo existe en el servidor donde corre Vite.

> **Vite y `import.meta.env`:** cualquier variable que deba leerse en el browser debe
> nombrarse con prefijo `VITE_`. Sin eso, en el bundle queda `undefined` y expresiones
> como `undefined + undefined` dan `NaN`.

---

## 6. Componente: Supabase (Docker)

### Ruta
`/opt/supabase`

### Levantar
```bash
cd /opt/supabase && sudo docker compose up -d
```

### Ver estado
```bash
sudo docker compose -f /opt/supabase/docker-compose.yml ps
```

### Puerto expuesto al exterior
`8000` (Kong API Gateway → accede a todo el stack Supabase)

### Tablas usadas por autenticación
| Tabla / RPC | Uso |
|---|---|
| `mv_usuario` | Lookup por `email` para determinar si usa flujo LDAP |
| `registrar_log_inicio_sesion` (RPC) | Log de auditoría de cada intento de sesión |

### Menú del backoffice (dashboard)
| Tabla | Uso |
|---|---|
| `bo_menu_item` | Ítems del menú lateral (árbol, ruta Vue, icono, orden). Migración base `20260424120000_bo_menu_backoffice.sql`; evolución (p. ej. Plan de pagos bajo Rematricula) en `20260423140000_mnp_informacion_finanzas_y_menu_plan_pagos.sql`. |
| `bo_menu_item_grupo` | Visibilidad para `codigo_grupo` 1 (DVU) o 2 (Admisión). TI (3) no requiere filas. |

### Tablas MNP (ERP → Postgres, lectura portal)
| Tabla | Uso |
|---|---|
| `mnp_datos_alumnos` | Identificación/contacto/académicos básicos (proyecto `integracion_umas`, migración `20260420140000_mnp_datos_alumnos.sql`). El front consulta por `email_institucional` alineado a `usuario@uniacc.edu` (p. ej. usuarios Pixarron sin `mv_usuario`). |
| `mnp_informacion_finanzas` | Cuotas y montos de matrícula/arancel, mora y totales (extract tipo `13_informacion_finanzas` / REP_REPORTE_FINANZAS). DDL y RLS de lectura en `rematricula-online`: `20260423140000_mnp_informacion_finanzas_y_menu_plan_pagos.sql`; puede convivir con carga desde `integracion_umas` (`20260420190000_mnp_informacion_finanzas.sql`). La vista **Plan de pagos** del dashboard lee esta tabla vía `supabase-js`. |

---

## 7. Configuración Centralizada (`.env.shared`)

### Ruta
`/opt/autenticacion_uniacc/.env.shared`

### Propósito
Único archivo de configuración para **todo** el ecosistema.
Lo leen tanto el servidor LDAP como el helper del proxy Vite.

### Variables principales
```env
# Proxy Vite → LDAP server
LDAP_SERVICE_URL="http://localhost:9500"
LDAP_API_KEY=<clave_api_ldap>
PORT=9500

# Active Directory
LDAP_SERVER_1=172.16.0.184
LDAP_SERVER_2=172.16.1.97
LDAP_DOMAIN=uniacc.local
LDAP_TLS_REQCERT=never

# Service account LDAP (opcional)
LDAP_SERVICE_USER=
LDAP_SERVICE_PASSWORD=

# Pixarron API
PIXARRON_SERVICE_URL="https://pixarron.uniacc.cl"
PIXARRON_BASIC_USER=
PIXARRON_BASIC_PASS=
```

> ⚠️ Este archivo está en `.gitignore`. NUNCA debe subir a un repositorio.

---

## 8. Diseño del JSON de Autenticación (Arquitectura Objetivo)

### Contrato del Request

```json
{
  "version": "1",
  "origin": 1,
  "ambiente": 1,
  "credentials": {
    "username": "nombre.apellido",
    "password": "contraseña_en_claro"
  },
  "meta": {
    "urlOrigen": "https://rematricula.uniacc.cl/login",
    "userAgent": "Mozilla/5.0..."
  }
}
```

### Header de autenticación del cliente
```
X-API-Key: <clave_del_cliente_en_base64_o_plain>
```

### Por qué la API Key va en el Header, no en el JSON
- Si `rematricula-online` la pusiera en el JSON body, estaría en el bundle JS del browser
  y cualquier usuario con DevTools la vería (Base64 es reversible, no es cifrado)
- La API Key del proxy Nginx/Vite **se agrega server-side**, el browser nunca la ve
- Los clientes server-side (WhatsApp bot) sí pueden enviarla directamente en el header
  de forma segura porque corren en un servidor

### Validación en `autenticacion_uniacc` (objetivo)
1. Verificar que `X-API-Key` es válida
2. Verificar que el `origin` del body corresponde a esa API Key
3. Ejecutar el flujo según `origin`
4. Devolver el resultado

### API Keys por cliente y Caché
La validación ahora está **100% descentralizada del código en la Base de Datos**:
- Se almacenan las llaves codificadas en SHA-256 en la tabla Supabase `auth_api_clientes` junto al `origen_id` y `ambiente`.
- `autenticacion_uniacc` posee un **caché en memoria** (`apiKeysManager.ts`) que es autohidratado periódicamente desde Supabase usando el pattern `[origen][ambiente] = api_key_hash`.
- Validar una credencial solo conlleva transformar el `X-API-Key` del input en la cadena SHA-256 local rápida en *node* y cruzar el string contra el mapeo temporal interno.

---

## 9. Contrato de Respuesta (LoginResult)

### Éxito
```json
{
  "ok": true,
  "authSource": "mv_ldap",
  "email": "nombre.apellido@uniacc.cl",
  "localPart": "nombre.apellido",
  "mvUsuario": { "id": "...", "nombre_usuario": "...", ... },
  "tipoPixarron": null
}
```

```json
{
  "ok": true,
  "authSource": "pixarron",
  "email": "nombre.apellido@uniacc.cl",
  "localPart": "nombre.apellido",
  "mvUsuario": null,
  "tipoPixarron": "alumno"
}
```

### Fallo
```json
{
  "ok": false,
  "message": "Usuario o contraseña incorrectos."
}
```

---

## 10. Puertos y Orden de Arranque

| # | Servicio | Puerto | Comando |
|---|---|---|---|
| 1 | Supabase (Docker) | `8000` | `cd /opt/supabase && sudo docker compose up -d` |
| 2 | uniacc-api (admisión) | `3001` (típico) | `cd /opt/uniacc-api && npm run dev` |
| 3 | ldap-autenticacion | `9500` | `cd /opt/ldap-autenticacion && node server.js` |
| 4 | autenticacion_uniacc (API HTTP) | `9502` | `cd /opt/autenticacion_uniacc && npm run dev` |
| 5 | rematricula-online | `9501` | `cd /opt/rematricula-online && npm run dev` |

---

## 11. Pendiente de Implementar

- [x] Convertir `autenticacion_uniacc` de librería a servidor HTTP Express (puerto `9502`)
- [x] Endpoint `POST /api/auth` que reciba el JSON descrito en sección 8
- [x] Middleware de validación de `X-API-Key` + `origin` con tabla de clientes registradas
- [x] Agregar `REMATRICULA_API_KEY` y `WHATSAPP_API_KEY` al `.env.shared`
- [x] Actualizar `rematricula-online` para que llame al nuevo endpoint en lugar de usar la librería importada
- [x] Configurar proxy Vite en dev para agregar `X-API-Key` server-side en `rematricula-online`
- [x] Eliminar las variables de entorno de Pixarron y LDAP del `.env` de `rematricula-online` (quedaron solo en el proxy de `autenticacion_uniacc`)

---

## 12. Actualizaciones y Mejoras Recientes

### Plan de pagos (abril 2026) — vista DVU y datos financieros MNP
- **Vista:** `src/views/dashboard/rematricula/PlanDePagosView.vue`; datos con composable **`usePlanPagosFinanzas`** (`select` sobre `mnp_informacion_finanzas`, límite 8000 filas, orden `synced_at` descendente). Filtros locales (RUT, nombre, código cliente, período), paginación y diálogo de detalle.
- **Ruta:** `/dashboard/plan-de-pagos`, nombre `dashboard-plan-de-pagos`. `meta`: `requiresAdminAdmision`, **`requiresSoloGrupoDvU`** (solo `mv_usuario.codigo_grupo === 1`) y **`requiresPerfilUsuarioIn: [1, 2, 3]`** (`codigo_perfil_usuario`). Así se restringe a **DVU** con perfiles 1–3; **TI** no accede aunque el cliente liste todas las entradas del menú para grupo 3.
- **Menú:** ítem hijo del grupo **Rematricula** en `bo_menu_item` (`icon_key` `Wallet`, `route_name` `dashboard-plan-de-pagos`); en **`bo_menu_item_grupo`** solo **`codigo_grupo = 1`** (Admisión no ve el enlace).
- **Tipos:** `MnpInformacionFinanzasRow` y tabla tipada en `src/types/supabase.ts`. Mantenedor TI: ruta incluida en `DASHBOARD_MENU_ROUTE_NAMES`.
- **`env.d.ts`:** extiende `vue-router` `RouteMeta` con `requiresGrupoTI`, `requiresSoloGrupoDvU` y `requiresPerfilUsuarioIn` (además de `requiresAdminAdmision`).

### Matrícula mock (abril 2026) — UI flujo contacto y cabecera sticky
- **Validación de contacto** (`DatosPersonalesMockView.vue`): filas resumen con badges y botones que abren **modales** (correo con OTP real vía API; teléfono con validación por dígitos hasta SMS/WhatsApp). Instrucciones destacadas con `Alert` + icono `Info`. Texto de la tarjeta: datos del registro y selección de cada opción para validar.
- **OTP correo:** cliente `src/services/rematriculaOtpApi.ts` → `uniacc-api` (`/api/rematricula/contacto-otp/email/solicitar` y `…/verificar`), con **contador regresivo** `MM:SS` desde `expiresAt` del servidor (no texto de fecha fija). Código OTP en **`<input>` nativo** filtrado a solo dígitos (6) + `keydown` para bloquear letras; evita el desfase de `Input` + `useVModel(passive)`.
- **Teléfono:** mismo patrón de input nativo, solo dígitos, máximo 15, normalización al cargar desde `mnp_datos_alumnos` / sesión.
- **Layout mock** (`MatriculaMockLayout.vue`): bloque **cabecera + banda estudiante + stepper** en `sticky top-0` (barra mock fuera del sticky). En **desktop**, al hacer scroll (`>24px`), logo y título «Matrícula …» pasan a tamaño compacto con transición; botones flotantes siguen en `z-40`.

Durante las pruebas post-despliegue de la separación de la API, se efectuaron las siguientes correcciones clave en la capa de auditoría (logs):

### Resolución de Condición de Carrera en Logging
Anteriormente, cuando el frontend consumía la librería local, existía una condición de carrera: si el login vía Pixarron (o en algunos casos LDAP) era exitoso, el frontend disparaba de inmediato `router.push('/dashboard')`. Dado que la inserción a Supabase (`logAudit()`) era una Promesa *fire-and-forget*, cambiar de página instruía al browser a matar abruptamente las peticiones en progreso — provocando la no-inserción de logs válidos.
Aislar y migrar este procesamiento a `autenticacion_uniacc` (como API HTTP Express en Node.js) solucionó naturalmente este problema. Node.js termina de ejecutar la promesa enviada a la DB a pesar de que el servidor ya haya emitido la respuesta 200 HTTP al cliente.

### Mapeo Constante del Payload Original (JSON)
Dado que los registros de Supabase expandieron sus campos para abarcar `origen_peticion` y `json_recibido`, se actualizó `loginFlow.ts`:
- Se extrae `req.body` y se pasa a través del orquestador.
- La inserción a Supabase mediante `getLoginAuditLogger` se integró dinámicamente.

### Robustez mediante Fallback de Stored Procedures (PGRST202)
Se agregó un mecanismo tolerante a fallos interactivo contra el SDK de Supabase:
Si el servidor Express intenta invocar `registrar_log_inicio_sesion` inyectando los 2 campos nuevos y PosgreSQL rechaza el mapeo (`error code PGRST202` por falta de actualización del *signature* del RPC), el backend atrapa silenciosamente el error y ejecuta un *fallback* relanzando la misma consulta ignorando los dos campos nuevos. Esto asegura compatibilidad híbrida y una migración segura.

---

## 13. Matrícula mock, datos MNP y validación de contacto (`rematricula-online`)

Contexto: flujo de **simulación** de matrícula en línea para probar UX y datos; incluye usuarios **sin** fila en `mv_usuario` (p. ej. autenticación vía Pixarron), que obtienen ficha desde **`mnp_datos_alumnos`**.

### Layout y ciclo académico en cabecera
- Archivo: `src/views/matricula-mock/MatriculaMockLayout.vue`.
- Año y período de matrícula se leen de **`VITE_MNP_MV_ANIO_MATRICULA`** y **`VITE_MNP_MV_PERIODO_MATRICULA`** (ver sección 5: obligatorio prefijo `VITE_` para variables expuestas al browser).
- Se muestra un ciclo tipo `año-período` (p. ej. `2026-2`) en la banda del estudiante; el título visible **«Matrícula …»** en cabecera usa el mismo ciclo cuando hay datos; si faltan variables, se muestra `—` o solo «Matrícula».
- Stepper mock: datos personales → forma de pago → firma → resumen (nombres de ruta en `src/router/index.ts`).
- **Sticky:** la barra superior **Mock** no es sticky. El bloque **cabecera (logo + título) + banda gradiente + stepper** va en un contenedor `sticky top-0 z-30` con fondo `bg-zinc-100` y borde inferior, para que los pasos sigan visibles al hacer scroll. En **viewport `md` y superior**, si `scrollY > 24`, el logo y el título se muestran en versión **compacta** (transición ~200 ms); en móvil el tamaño del logo en fila no cambia por scroll (solo ajustes `md:`).

### Store Pinia `datosAlumnoMnp`
- Archivo: `src/stores/datosAlumnoMnp.ts`.
- Acción **`fetchSiSinMvUsuario(username, tieneMvUsuario)`**: si el usuario tiene `mv_usuario`, limpia el store; si no, construye el correo institucional con **`emailInstitucionalDesdeUsername`** (`usuario@uniacc.edu`, minúsculas) y consulta Supabase `mnp_datos_alumnos` por `email_institucional`.
- Estado: `loading`, `error`, `filas[]`; getter **`primeraFila`** para la UI. Si hay más de un registro, la vista muestra alerta (varias filas para el mismo correo).

### Vista datos personales mock
- Archivo: `src/views/matricula-mock/DatosPersonalesMockView.vue`.
- **Paso 1 — Validación de contacto:** dos filas resumen (correo personal y teléfono) con valor actual, badge **Validado** / **Pendiente** y botón **«Validar o actualizar …»** que abre un **`Dialog`** (shadcn-vue) por canal. Copy de ayuda en `Alert` destacado (naranja institucional). Descripción de la tarjeta: datos del registro y que debe seleccionarse cada opción para validar.
- **Correo — OTP real (servidor):** servicio **`src/services/rematriculaOtpApi.ts`** (base desde `admisionApiBaseUrl()` / `VITE_API_URL`). Payload incluye `usuarioConexion`, `emailInstitucional`, `emailPersonal` y opcionalmente `urlOrigen` (URL del documento al solicitar). Tras **«Enviar código al correo»**, el modal muestra campo de **6 dígitos**, reenvío y confirmación; caducidad mostrada como **contador `MM:SS`** calculado desde `expiresAt` devuelto por la API, con `setInterval` limpiado al cerrar/validar/cambiar correo. Al verificar OK se cierra el modal y queda **Validado**.
- **Teléfono:** en el modal, número solo **dígitos** (máx. 15), input nativo con filtrado en `input` + `keydown` (mismo motivo que el OTP: evitar desincronización del componente `Input` con `useVModel` passive). **`validarTelefono`** marca OK si hay 8–15 dígitos; en código permanece **TODO** para OTP SMS/WhatsApp antes de considerar el canal “fuerte” en backend.
- Flags **`correoValidadoOk`** y **`telefonoValidadoOk`**; al modificar correo se resetea OTP UI; al modificar teléfono se invalida validación teléfono. **«Ver el resto de mis datos»** solo con ambos OK.
- **Paso 2 — Ficha completa:** resto de campos; correo personal y teléfono son los confirmados en el paso 1. **«Corregir correo o teléfono»** vuelve al paso 1.

### Tipos y columnas `mnp_datos_alumnos`
- Tipo **`MnpDatosAlumnosRow`** en `src/types/supabase.ts` alineado a la migración real de la tabla (no incluye columna `modalidad`).
- En la ficha mock, la fila académica etiquetada **«Tipo de carrera»** lee **`tipo_carrera`**.

### Backend asociado (OTP correo)
- En **`uniacc-api`**: rutas bajo `/api/rematricula/contacto-otp/email/…`, servicio y controlador dedicados; rate limit en memoria; envío de correo según configuración SMTP del API. Tablas/migraciones Supabase del flujo OTP en el repo de rematrícula según evolución (`mnp_contacto_otp_email`, etc.).

### Pendiente explícito (post-mock)
- [x] OTP por **correo** para validar correo personal (integrado front + `uniacc-api`).
- [ ] OTP por **SMS/WhatsApp** para teléfono y persistencia en backend de contacto confirmado si el negocio lo exige (hoy teléfono OK es solo validación de formato en cliente).

---

## 14. Dashboard admisión: `uniacc-api` + `rematricula-online` (lo realmente implementado)

### Rol de `uniacc-api`
- Backend Node/Express con acceso a **PostgreSQL** (mismas tablas `public.mv_*` / `gestorfirma_*` que expone Supabase) y a **SQL Server** UNIACC para jobs de sincronización.
- **Scripts CLI** (`package.json`): `sync:postulantes`, `sync:matriculados`, `sync:firma-acepta`, `sync:all` — ejecutan sync sin pasar por HTTP (útil con cron o tareas en red interna donde vive SQL Server).

### Qué consume el front (`rematricula-online`) por HTTP
| Área | Composable / vistas | Endpoints usados |
|---|---|---|
| Postulantes | `usePostulantes` | `GET /api/postulantes`, `GET /api/postulantes/stats`, `GET /api/postulantes/:id`, `POST /api/postulantes/refresh`, etc. |
| Matriculados | `useMatriculados` | `GET /api/matriculados?…`, `GET /api/matriculados/stats`, `POST /api/matriculados/sync` |
| Firma ACEPTA | `useFirmaAcepta`, `EstadoFirmaContratoView` | `GET /api/firma-acepta`, `POST /api/firma-acepta/sync`, PDF: `GET /api/firma-acepta/documento/:tipo/:rut/:codigo` |

### PDFs firmados (ACEPTA)
- Se guardan en **filesystem** del servidor que corre `uniacc-api` (`STORAGE_PATH` / `storage/archivos_firmados`). El front abre el PDF vía la ruta de documento anterior; **no** se usa Supabase Storage para este flujo en el código actual.

### Intento revertido / no vigente en repo
- Migraciones Supabase para bucket `firma-documentos` y políticas de Storage: **eliminadas** del árbol de `rematricula-online/supabase/migrations/`.
- Subida de PDFs a Supabase Storage desde `uniacc-api` y dependencia `@supabase/supabase-js` en ese proyecto: **revertidas / quitadas**.

### Dónde el front **sí** usa Supabase (`supabase-js` + `VITE_SUPABASE_URL`)
- **`useDesistimiento`:** RPC `uniacc_marcar_desistido`, `uniacc_desmarcar_desistido`, `uniacc_set_estado_seguimiento` y lecturas auxiliares.
- **`datosAlumnoMnp`:** tabla `mnp_datos_alumnos`.
- **Plan de pagos (DVU):** tabla `mnp_informacion_finanzas` vía `usePlanPagosFinanzas` en `PlanDePagosView.vue`.
- **Simulador / prospectos:** cliente aparte `supabaseSimuladorClient` (`VITE_SIMULADOR_SUPABASE_*`).
- Componentes que aún llaman RPC vía `supabase` (p. ej. `data-table-dropdown.vue` según evolución del repo).

### Orden de arranque sugerido (incluye admisión)
| # | Servicio | Notas |
|---|---|---|
| 1 | Postgres / Supabase Docker | Datos en `public` |
| 2 | `uniacc-api` | `npm run dev` o `pm2` / proceso systemd |
| 3 | `rematricula-online` | Con `.env` correcto (`VITE_API_URL` si aplica) |
| 4 | Auth stack | `ldap-autenticacion`, `autenticacion_uniacc` según necesidad de login |

---

## 15. Shell del dashboard, navegación lateral y marca UNIACC (`rematricula-online`)

Implementación vigente del **dashboard** tras login (rutas bajo `/dashboard`, p. ej. `/dashboard/home`).

### Layout y componentes
- **Padre de rutas:** `src/views/dashboard/layout/DashboardView.vue`.
- **Matrícula mock** (`/dashboard/matricula-mock/...`): si la ruta incluye `matricula-mock`, se renderiza **solo** `<RouterView />` (layout del mock a pantalla completa, sin barra lateral).
- **Resto del dashboard:** envuelto en **`SidebarProvider`** (componentes shadcn en `src/components/ui/sidebar/`). El estado abierto/cerrado del panel se persiste con **cookie** `sidebar:state` (ver `SidebarProvider.vue`).
- **`DashboardSidebarNav.vue`** (`src/views/dashboard/layout/`): barra lateral con `Sidebar` en modo **`collapsible="icon"`** + **`variant="inset"`**, **`SidebarRail`**, menú (`SidebarMenu` / `RouterLink`). En **móvil** el mismo bloque usa **Sheet** (drawer).
- **`SidebarInset`:** zona principal con cabecera blanca (`border-zinc`, sombra), contenido y pie.

### Logo y título visible
- **Logo UNIACC:** archivo estático **`/Logo/logoUniaccNew.svg`** → `public/Logo/logoUniaccNew.svg`. En el shell actual el logo aparece **solo en la cabecera de la barra lateral** (centrado; enlace a inicio). **No** se duplica el logo en la cabecera principal junto al `SidebarTrigger`.
- **Nombre del sitio** mostrado en cabecera (sm+), pie y bloques que usan el store: Pinia **`useAppStore().appName`** en `src/stores/app.ts`, valor **`Sitio Matricula`**.
- **Ciclo académico** en cabecera (p. ej. «Matrícula 2026-2»): mismas variables **`VITE_MNP_MV_ANIO_MATRICULA`** y **`VITE_MNP_MV_PERIODO_MATRICULA`** que en el mock y en `LoginView`.

### Navegación y perfiles
- **Menú lateral dinámico (BD):** tablas Supabase **`bo_menu_item`** (jerárquico: `parent_id`, `tipo` `link`/`group`, `label`, `route_name`, `icon_key` → Lucide en front, `orden`, `activo`) y **`bo_menu_item_grupo`** (`menu_item_id`, `codigo_grupo` **1 o 2**). Usuarios con **`mv_usuario.codigo_grupo === 3` (TI)** ven **todos** los ítems activos sin necesidad de filas en `bo_menu_item_grupo`.
- **Construcción del menú:** `buildDashboardMenuPlan` en **`src/views/dashboard/layout/buildDashboardMenu.ts`**; iconos en **`menuIcons.ts`**. Datos cacheados en Pinia **`src/stores/dashboardMenu.ts`** (carga en `router.beforeEach` al entrar a `/dashboard`).
- **Sesión:** el store **`src/stores/auth.ts`** persiste en `sessionStorage` **`codigo_grupo`** junto al perfil (LDAP vía `mv_usuario`). Getter **`esGrupoTI`** (`codigo_grupo === 3`).
- **Rutas protegidas:** rutas con `meta.requiresAdminAdmision` solo son accesibles si el **`route.name`** figura en el conjunto derivado del menú filtrado por grupo (misma lógica que el sidebar). Rutas hijas del mock `matricula-mock-*` se permiten si el menú incluye `matricula-mock-datos`. **`meta.requiresGrupoTI`:** solo TI (rutas bajo **`/dashboard/backoffice/*`**, layout **`BackofficeLayout.vue`**). **`meta.requiresSoloGrupoDvU`:** tras pasar el chequeo del menú, exige **`codigo_grupo === 1`** (bloquea TI aunque vea todos los ítems en el cliente). **`meta.requiresPerfilUsuarioIn`:** lista de **`codigo_perfil_usuario`** permitidos (p. ej. Plan de pagos: `[1, 2, 3]`). Mantenedores: **`/dashboard/backoffice/menu`** → **`BoMenuMantenimientoView.vue`**; **`/dashboard/backoffice/usuarios`** → **`BoUsuariosMantenimientoView.vue`** (listado, **alta** (`insert`) y **edición** (`update`) en **`mv_usuario`**; el correo es editable solo en el alta y solo lectura al editar). El ítem lateral «Mantenedor de usuarios» se define en **`bo_menu_item`** (hijo del grupo Backoffice, `route_name` `dashboard-backoffice-usuarios`). **`/dashboard/admin/menu`** redirige al path de menú en backoffice. **Plan de pagos:** `dashboard-plan-de-pagos` bajo grupo Rematricula (visibilidad menú solo DVU en BD; acceso efectivo DVU + perfiles 1–3 vía meta del router).
- **Escritura `mv_usuario` desde el navegador:** el front usa `supabase.from('mv_usuario').insert(...)` y `.update(...)`. Si PostgREST devuelve error por RLS o permisos, hay que ampliar políticas en Postgres, exponer una RPC `SECURITY DEFINER` acotada, o centralizar el cambio en **`uniacc-api`**; hasta entonces la pantalla de usuarios seguirá mostrando el error de Supabase al guardar.
- **Perfil ejecutivo (3):** puede usar pantallas de admisión/rematrícula si su **grupo** y el menú en BD lo permiten (ya no depende solo de `esSuperAdminOAdmin` para esas rutas). El getter **`esSuperAdminOAdmin`** sigue existiendo para otros usos (p. ej. acciones en tablas).
- El antiguo menú horizontal **`DashboardMenu.vue`** fue **eliminado**; la navegación del dashboard pasa por la barra lateral.

### UX de inicio
- **`src/views/dashboard/home/HomeView.vue`:** página de inicio con franja de bienvenida al estilo login (gradiente naranja / magenta / azul), tarjetas con acentos `uniacc-orange` y copy alineado al portal (sin el texto genérico «Dashboard Template»).

### Estilos globales del sidebar
- En **`src/assets/index.css`**, variables **`--sidebar-*`** (fondo, acento, borde, *ring*) afinadas a la **paleta UNIACC** (naranja en acentos), coherentes con el resto de la UI.

### Store de app (sin estado duplicado del panel)
- **`src/stores/app.ts`:** expone `appName`, `isLoading`, `setLoading`. **No** mantiene `sidebarOpen` / `toggleSidebar` locales: el colapsado del sidebar lo gestiona solo el contexto de **`SidebarProvider`**.

---

## 16. Actualización sesión actual (abril 2026) — Simulador, menú jerárquico y mantenedor carreras

### Simulador de uso (`src/views/dashboard/matricula/SimuladorUso.vue`)
- **Orden en vista:** deduplicación de prospectos ahora se hace sobre una copia ordenada por `created_at` descendente en frontend (no depende del orden de backend).
- **Exportación CSV alineada a vista:** `exportarCSV()` ordena explícitamente por `created_at` descendente antes de construir `rows`.
- **Número de simulación por RUT:** se calcula sobre la lista ordenada, manteniendo `1 = más reciente`.
- **Becas en CSV:** se agregó columna **`Beca Nombre`** además de `Beca` (ID). Se resuelve consultando `becas_uniacc` por IDs únicos con `fetchBecaPorId`.

### Nuevo mantenedor de carreras (`carreras_uniacc`)
- **Nueva ruta:** `/dashboard/mantenedor-carreras`, nombre `dashboard-mantenedor-carreras`.
- **Control de acceso:** `meta.requiresPerfilUsuarioIn: [1, 2]` + `requiresAdminAdmision` (solo perfiles 1 y 2 dentro del dashboard admisión).
- **Rutas válidas de menú:** `dashboard-mantenedor-carreras` agregado en `src/constants/dashboardRouteNames.ts` para poder seleccionarlo desde el mantenedor de menú.
- **Nueva vista:** `src/views/dashboard/matricula/MantenedorCarrerasView.vue`.
  - Listado y recarga de carreras.
  - CRUD de campos operativos (crear/editar/eliminar con confirmación).
  - Búsqueda por texto libre.
  - Filtros adicionales por **Facultad**, **Nivel** y **Modalidad** (combinables con búsqueda).
- **Nueva capa de datos:** `src/composables/useCarrerasUniacc.ts` con `fetchCarreras`, `createCarrera`, `updateCarrera`, `deleteCarrera` sobre `supabaseSimuladorClient`.

### Menú lateral con jerarquía real de submenú
- Se implementó soporte de **2 niveles** en el menú dinámico para permitir estructura:
  - `Matrícula` (group) → `Simulador` (group) → enlaces (`Uso Simulador`, `Mantenedor carreras`).
- **Builder actualizado:** `src/views/dashboard/layout/buildDashboardMenu.ts`
  - ahora procesa hijos de tipo `group` dentro de un `group` raíz y sus links nietos.
  - `allowedRouteNamesFromMenu()` incluye también links anidados para no bloquear navegación en guards.
- **Render actualizado:** `src/views/dashboard/layout/DashboardSidebarNav.vue`
  - integra `SidebarMenuSub`, `SidebarMenuSubItem`, `SidebarMenuSubButton` para pintar subgrupos con sus enlaces.
- Con esto, la configuración en `bo_menu_item`/`bo_menu_item_grupo` con `Simulador` como grupo hijo ya se refleja correctamente en sidebar.

---

## 17. Actualización mayo 2026 — Plan de pagos consolidado, simulador persistente y PDF

Contexto: se reemplazó la fuente antigua de plan de pagos por una vista consolidada basada en el extract ERP final y se construyó un simulador persistente para DVU.

### Fuente consolidada ERP → Supabase
- **Query ERP final:** `/opt/integracion_umas/SQL/mv_mnp_alumnos_matriculas_periodos_v2.sql`.
  - Devuelve una fila por alumno/carrera usando llave **`codcli + cod_carrera`**.
  - Pivotea documentos de pago: matrícula y arancel en columnas separadas.
  - Expone CAE como `Si` / `No`.
  - Agrega beneficios del último período en `beneficios_json` con `FOR JSON PATH` para cargarlo como `jsonb`.
- **Tabla destino consolidada:** `public.mnp_mv_plan_pagos_consolidado`.
  - Migración en `rematricula-online`: `supabase/migrations/20260525120000_mnp_mv_plan_pagos_consolidado.sql`.
  - Misma migración espejo en `/opt/integracion_umas/supabase/migrations/`.
  - RLS habilitado; lectura a `anon`, `authenticated`, `service_role` según migración actual.
- **Vista estable para frontend:** `public.v_mnp_mv_plan_pagos`.
  - Migración vigente: `supabase/migrations/20260525120100_v_mnp_mv_plan_pagos_consolidado.sql`.
  - Usa `WITH (security_invoker = true)`.
  - Mapea la tabla consolidada al contrato usado por `PlanDePagosView.vue`.
  - Calcula `beca_matricula`, `beca_arancel`, `valor_total_matricula`, `valor_total_arancel` desde `beneficios_json`.
  - Expone campos nuevos: `alumno_cae`, `tiene_beneficio`, `beneficio_ano`, `beneficio_periodo`, `cantidad_beneficios`, `monto_total_beneficios`.

### ETL asociado (`integracion_umas`)
- Configuración: `/opt/integracion_umas/config/extracts.yaml` incluye el extract `SQL/mv_mnp_alumnos_matriculas_periodos_v2.sql` hacia `public.mnp_mv_plan_pagos_consolidado`.
- Script: `/opt/integracion_umas/scripts/sync_erp_to_supabase.py`.
  - Normaliza RUT, email y teléfonos.
  - Inyecta `anio_matricula` / `periodo_matricula` desde variables del entorno.
  - Convierte `beneficios_json` desde string SQL Server `FOR JSON PATH` a `psycopg2.extras.Json` para Postgres `jsonb`.
- Comando de carga usado:
```bash
cd /opt/integracion_umas
.venv/bin/python scripts/sync_erp_to_supabase.py --only SQL/mv_mnp_alumnos_matriculas_periodos_v2.sql
```

### Vista Plan de pagos (`rematricula-online`)
- Archivo principal: `src/views/dashboard/rematricula/PlanDePagosView.vue`.
- Fuente actual: `usePlanPagosMvStore` → `src/services/fetchPlanPagosMv.ts` → Supabase `v_mnp_mv_plan_pagos`.
- La tabla muestra período, alumno, carrera, CAE, beneficios, matrícula, arancel y neto plan.
- Filtros locales: RUT, nombre, `codcli`, período.
- **Importante:** para plan de pagos, la llave operativa es **`codcli`**, porque representa alumno + carrera/modalidad. No usar RUT como identificador único.
- El bloque superior de la vista (título, actualizar, filtros y badges) es `sticky top-0`.
- El modal de detalle fue rediseñado como ficha visual con tarjetas:
  - Datos personales.
  - Datos apoderado.
  - Carrera.
  - Plan de pago.
  - Beneficios.
- En plan de pago se muestra **valor cuota** por concepto:
  - `valor cuota = neto del concepto / cantidad de cuotas`.
- Para alumnos sin documentos de pago se muestra **`Sin documento de pago`**.

### Simulador plan de pago persistente
- Migración principal: `supabase/migrations/20260525140000_mnp_simulador_plan_pago.sql`.
- Tablas creadas:
  - `mnp_simulador_convenio`
  - `mnp_simulador_beca_estado`
  - `mnp_simulador_regla`
  - `mnp_simulacion_plan_pago`
  - `mnp_simulacion_plan_pago_detalle`
- Catálogo de convenios vigente:
  - **Fuente real:** `public.tp_convenio` (migración `20260526120000_tp_convenio.sql`)
  - Tipo TS: `TpConvenioRow` en `src/types/supabase.ts`.
  - Store dedicado: `src/stores/convenio.ts` (fallback a `mnp_simulador_convenio` si la tabla no existe o viene vacía).
  - Semilla inicial: `0 / Sin Convenio`; el simulador precarga el último `convenio_id` del historial por `codcli`.
- Catálogo de tipo de pago vigente:
  - **Fuente real:** `public.tp_tipo_pago`
  - Tipo TS: `TpTipoPagoRow` en `src/types/supabase.ts`.
  - Store dedicado: `src/stores/tipoPago.ts`.
  - Opciones esperadas:
    - `1` / `CONTADO`
    - `2` / `CHEQUE`
    - `3` / `PAGARE (MANDATO)`
    - `4` / `ORDEN DE COMPRA`
- El simulador usa `tp_tipo_pago` para **Tipo pago matrícula** y **Tipo pago arancel anual**. El store mapea cada registro a conceptos `MATRICULA` y `ARANCEL` para compatibilidad con el motor.
- Al abrir un alumno:
  1. Carga catálogos (`fetchSimuladorCatalogos`) y `tp_tipo_pago`.
  2. Construye default con `PAGARE (MANDATO)` si existe.
  3. Carga historial por `codcli`.
  4. Si hay historial, precarga la última forma de pago usada en matrícula y arancel desde `inputs_json`.
  5. El checkbox **Marcar con CAE** siempre se determina desde `alumno_cae` de `v_mnp_mv_plan_pagos`; el historial no lo sobreescribe.
- Normalización CAE:
  - `Si`, `SI`, `Sí`, `S`, `true`, `1` → seleccionado.
  - `No`, vacío u otro valor → desmarcado.
- Archivos clave:
  - `src/components/rematricula/SimuladorPlanPagoDialog.vue`
  - `src/stores/simuladorPlanPago.ts`
  - `src/stores/tipoPago.ts`
  - `src/stores/convenio.ts`
  - `src/services/simuladorPlanPago.ts`
  - `src/utils/simuladorPlanPago.ts`
  - `src/types/simuladorPlanPago.ts`
- Motor de cálculo (`src/utils/simuladorPlanPago.ts`):
  - Parte de `monto_matricula`, `monto_arancel`, `beca_matricula`, `beca_arancel`.
  - Aplica beca estado, convenio, abonos, CAE, beneficio adicional y descuento medio de pago.
  - No permite netos negativos.
  - Calcula `valor_cuota = neto / cuotas`.

### Plan convenios simulador plan de pagos
- Objetivo: alimentar el select **Convenio** desde el catálogo `public.tp_convenio`, similar a `tp_tipo_pago`, manteniendo el motor compatible con `SimuladorConvenioRow`.
- Base de datos:
  - Migración: `supabase/migrations/20260526120000_tp_convenio.sql`.
  - Tabla: `public.tp_convenio`.
  - Columnas principales: `codigo_convenio`, `descripcion_convenio`, `concepto`, `tipo_descuento`, `valor_descuento`, `activo`, `created_at`.
  - Semilla mínima requerida: `0 / Sin Convenio / AMBOS / MONTO / 0`.
  - RLS habilitado y lectura para roles del dashboard.
- Frontend:
  - Tipo: `TpConvenioRow` en `src/types/supabase.ts`.
  - Store: `src/stores/convenio.ts`.
  - Getter `opciones`: filas activas para el select.
  - Getter `simuladorConvenios`: mapea `TpConvenioRow` a `SimuladorConvenioRow`.
  - Servicio `src/services/simuladorPlanPago.ts`: debe priorizar `tp_convenio`; `mnp_simulador_convenio` queda solo como fallback si `tp_convenio` falla o viene vacío.
  - Store `src/stores/simuladorPlanPago.ts`: carga `useConvenioStore()` al abrir el simulador, pasa `convenios: convenioStore.simuladorConvenios` a catálogos y restaura `inputs_json.convenio_id` desde historial por `codcli`.
  - UI `src/components/rematricula/SimuladorPlanPagoDialog.vue`: el select **Convenio** lista `convenioStore.opciones`, muestra `descripcion_convenio` y guarda `id` como string en `form.convenio_id`.
- Reglas de cálculo:
  - `PORCENTAJE`: descuenta porcentaje sobre el neto base del concepto.
  - `MONTO`: descuenta monto fijo.
  - `concepto`: aplica a `MATRICULA`, `ARANCEL` o `AMBOS`.
  - El neto nunca baja de cero.
- Para continuar mañana:
  - Aplicar la migración en el ambiente objetivo si aún no existe `tp_convenio`.
  - Abrir el simulador y confirmar que **Convenio** muestra datos desde `tp_convenio`.
  - Confirmar default **Sin Convenio**.
  - Guardar una simulación con convenio y reabrir el mismo `codcli`; debe precargar el último convenio usado.
  - Probar convenio por monto fijo y por porcentaje.
  - Revisar PDF borrador/oficial para confirmar que refleja el descuento por convenio.
  - Reintentar tests cuando se corrija la configuración de Vitest (`Cannot merge config in form of callback`).

### Generación PDF plan de pagos
- Dependencias agregadas:
  - `jspdf`
  - `jszip`
- Utilidades:
  - `src/utils/planPagoPdf.ts`
    - Construcción de datos normalizados para PDF.
    - PDF individual.
    - PDF multipágina.
    - Descarga o preview mediante `Blob URL`.
  - `src/services/planPagoPdfBatch.ts`
    - PDF borrador.
    - PDF oficial desde simulación guardada.
    - PDF multipágina para filtrados.
    - ZIP con PDFs individuales.
    - Progreso por lote.
- En `SimuladorPlanPagoDialog.vue`:
  - Botón **Ver borrador PDF** abre el PDF en el visor del navegador con `window.open(blobUrl)`.
  - Si el navegador bloquea el popup, muestra error.
  - El PDF oficial del historial sigue descargándose desde simulación persistida + detalle.
- En `PlanDePagosView.vue`:
  - Botones masivos en la barra sticky:
    - **PDF filtrados**: genera PDF único multipágina.
    - **ZIP filtrados**: genera un PDF por alumno/codcli.
  - Usa `dataFiltrada` como fuente.
  - Muestra progreso `Generando X / total`.
  - Para masivo, prioriza la última simulación guardada por `codcli`; si no existe, calcula automático con defaults.

### Validaciones y estado de pruebas
- Lints IDE (`ReadLints`) revisados en archivos tocados: sin errores al momento de los cambios.
- `npm run test` no existe; el script correcto es `npm run test:unit`.
- `npm run test:unit -- --run src/utils/simuladorPlanPago.test.ts` no pudo cargar por problema preexistente de `vitest.config.ts`:
  - `Error: Cannot merge config in form of callback`.
- Se validó el motor con `tsx` y cálculo base:
  - matrícula `250.000 / 10 = 25.000`
  - arancel `3.810.000 / 10 = 381.000`
- También se validó mapeo de `tp_tipo_pago` para default `PAGARE (MANDATO)`.

### Pendientes / advertencias
- Aplicar migraciones nuevas en ambientes donde aún no existan:
```bash
cd /opt/rematricula-online
supabase db push
```
  o ejecutar los SQL correspondientes vía `psql`.
- `tp_tipo_pago` y `tp_convenio` deben existir en el schema expuesto por Supabase usado por el frontend y tener permisos de lectura para el rol que opera el dashboard.
- Mañana: validar en UI el flujo completo de convenios (ver sección **Plan convenios simulador plan de pagos**).
- Las políticas RLS del simulador están actualmente a nivel `authenticated`; si el control debe ser estrictamente DVU/perfil, endurecerlo en DB con una tabla/RPC de roles o mover escritura a backend.
- Los PDF se generan en frontend; para lotes grandes conviene filtrar antes. La UI advierte cuando supera 500 registros.

