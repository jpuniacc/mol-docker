# Migración de API Keys a Supabase y refactor del flujo de Origen

La propuesta es centralizar el manejo de las API Keys directamente en Supabase, permitiendo que la validación en el Backend sea dinámica sin necesidad de editar los `.env` para cada nuevo cliente. Además, implementaremos la migración del string del `origin` a `integer` y añadiremos el soporte de ambientes (dev/qa/prod).

## User Review Required

> [!WARNING]
> La migración obligará a que cualquier sistema cliente (*Rematricula*, *Whatsapp*) envíe `origin` como Integer (1 o 2) en vez de String en el body de su JSON, y además añada obligadamente una nueva variable `ambiente`. Esto rompe temporalmente compatibilidad hacia atrás, pero es necesario para dejar el diseño final.

## Proposed Changes

### Supabase (Database)

#### [MODIFY] SQL Schema (Tabla de Clientes y RPC)
Se deberá ejecutar un script SQL directo en Supabase que realice lo siguiente:
1. **Creación de Tabla:**
```sql
CREATE TABLE public.auth_api_clientes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    origen_id integer NOT NULL,                   -- 1: Rematricula, 2: Whatsapp
    ambiente varchar(10) NOT NULL,                -- 'dev', 'qa', 'prod'
    descripcion text,
    api_key_hash text NOT NULL,                   -- HASH SHA-256 de la API Key
    es_activo boolean DEFAULT true,
    creado_en timestamp with time zone DEFAULT now(),
    UNIQUE(origen_id, ambiente)
);
```

2. **Migración de Tabla de logs (`log_inicio_sesion`)**
Dado que el `origin` ahora es numérico, la columna `origen_peticion` en `log_inicio_sesion` debe modificarse o insertarse como integer, así como la actualización que hiciste en la función `registrar_log_inicio_sesion`.

---

### Backend Autenticacion (`autenticacion_uniacc`)

#### [NEW] `src/core/apiKeysManager.ts`
Crearemos un módulo con un método `initApiKeysCache(supabase)` que:
- Se ejecute al arrancar el servidor `server.ts`.
- Descargue la tabla `auth_api_clientes` completa de Supabase.
- Guarde un caché en memoria del tipo: `Map<'1_dev', 'sha256Hash...'>`.
- Esto evita que cada inicio de sesión genere una consulta extra (latencia) hacia Supabase.

#### [MODIFY] `src/server.ts`
- Actualizaremos el middleware `validateApiKey` para leer `req.body.origin` (que ahora será int) y `req.body.ambiente`.
- Se hará un `hash(X-Api-Key)` y se comparará con la memoria RAM cargada.
- Se llamará a `initApiKeysCache` antes de hacer el `app.listen`.

#### [MODIFY] `src/core/loginFlow.ts` e `loginAudit.ts`
- `AuthOrigin` se cambiará a tipo numérico (`1 | 2`).
- Las reglas de enrutamiento se mapearán: `origin === 1` para flujo completo (mv_usuario -> LDAP -> Pixarron), y `origin === 2` para Whatsapp.
- El RPC caller también se ajustará a la nueva función que enviaste (pasando el origin_id modificado).

---

### Frontend Vue (`rematricula-online`)

#### [MODIFY] `src/services/auth.ts`
- Modificaremos el contrato de Typescript para que envíe `origin: 1` y añadiremos `ambiente: "dev" | "prod"` dinámicamente evaluando `import.meta.env.MODE` (o permitiendo que reciba el ambiente explícitamente en `runLoginFlow`).

#### [MODIFY] `src/stores/auth.ts` y vistas
Solo verificaremos que las llamadas a `runLoginFlow` sean correctamente inyectadas con el número de origen en lugar del texto.

---

## Open Questions

> [!IMPORTANT]
> 1. En la nueva función RPC `registrar_log_inicio_sesion` que enviaste, el campo todavía se llama `p_origen_peticion text`. ¿Quieres que modifiquemos la tabla de base de datos actual para que cambie de `text` a `integer`? ¿O prefieres que simplemente casteemos el `1` hacia `"1"` como texto al enviarlo a la función actual?
> 2. Respecto a la tabla `log_inicio_sesion`: ¿Te gustaría que añadamos el parámetro de `ambiente` a esa tabla para que los logs digan si el error de login ocurrió en DEV o en PROD?
> 3. ¿Las API Keys planeas generarlas tú e insertarlas en vivo en tu Supabase o te incluyo un script en la carpeta scripts que te permita generar api key + hash?

## Verification Plan

### Automated Tests
1. Generaremos un Postman actualizado (o los curl) enviando "origin": 1 y "ambiente": "dev".
2. Consultaremos Supabase asegurando el acceso.

### Manual Verification
1. Compilaremos ambos microservicios `npm run dev`.
2. Haremos un login en local desde `localhost:9501` para verificar que la inyección dinámica de ambiente lee `"dev"` correctamente y la validación en caché funciona sin golpear extra la BD.
