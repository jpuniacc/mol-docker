# Guía de Pruebas con Postman — Autenticación Uniacc

## Configuración Inicial

### Variables de Entorno (Postman Environment)

Crea un environment en Postman con estas variables:

| Variable | Valor |
|---|---|
| `ldap_url` | `http://localhost:9500` |
| `vite_url` | `http://localhost:9501` |
| `api_key` | `006263d93015ea2afd678d5813628fef8437ad04bdddb333dfd1dc3e61b85c17` |

> **Tip**: En Postman ve a **Environments → Add** y crea el environment `Uniacc Local`.

---

## 1. Servicio LDAP directo (`ldap-autenticacion` → puerto 9500)

### 1.1 Health Check
Verifica que el servidor LDAP está levantado.

```
GET {{ldap_url}}/health
```

**Headers:** *(ninguno)*

**Respuesta esperada (200):**
```json
{
  "status": "ok",
  "service": "LDAP Validation Service"
}
```

---

### 1.2 Validar credenciales LDAP — credenciales correctas

```
POST {{ldap_url}}/validate
```

**Headers:**
```
Content-Type: application/json
X-API-Key: {{api_key}}
```

**Body (raw JSON):**
```json
{
  "username": "nombre.apellido",
  "password": "bm9tYnJlLmFwZWxsaWRv"
}
```

> ⚠️ `password` debe enviarse en **Base64**.
> Para generarlo usa la pestaña **Pre-request Script** (ver sección 4).

**Respuesta esperada (200 — éxito):**
```json
{
  "valid": true,
  "server": "172.16.0.184",
  "message": "Autenticación exitosa"
}
```

**Respuesta esperada (401 — credenciales incorrectas):**
```json
{
  "valid": false,
  "error": "Credenciales inválidas",
  "message": "No se pudo autenticar en ningún servidor LDAP"
}
```

**Respuesta esperada (503 — sin VPN / red interna):**
```json
{
  "valid": false,
  "message": "No se puede conectar a los servidores LDAP...",
  "connectionErrors": [
    { "server": "172.16.0.184", "error": "No se puede resolver el servidor LDAP..." }
  ]
}
```

---

### 1.3 Validar sin API Key (debe fallar)

```
POST {{ldap_url}}/validate
```

**Headers:**
```
Content-Type: application/json
```
*(Sin X-API-Key)*

**Respuesta esperada (401):**
```json
{
  "error": "Unauthorized",
  "message": "API key inválida o ausente. Usa X-API-Key o Authorization: Bearer."
}
```

---

### 1.4 Validar usando `Authorization: Bearer`

```
POST {{ldap_url}}/validate
```

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{api_key}}
```

Funciona exactamente igual que con `X-API-Key`.

---

### 1.5 Ruta alternativa `/api/v1/auth/ldap`

```
POST {{ldap_url}}/api/v1/auth/ldap
```

Headers y body idénticos al ejemplo 1.2. Útil para integraciones futuras (bots, servicios externos).

---

## 2. Proxy Vite del frontend (puerto 9501)

> El proxy de Vite enruta `/api/auth/ldap` al servidor LDAP y agrega `X-API-Key` automáticamente. Requiere que el frontend esté levantado con `npm run dev`.

### 2.1 LDAP vía proxy Vite

```
POST {{vite_url}}/api/auth/ldap
```

**Headers:**
```
Content-Type: application/json
```
*(Sin API Key — la agrega el proxy internamente)*

**Body:**
```json
{
  "username": "nombre.apellido",
  "password": "bm9tYnJlLmFwZWxsaWRv"
}
```

---

### 2.2 Pixarron vía proxy Vite

```
GET {{vite_url}}/api/pixarron/acceso/nombre.apellido/{{password_b64}}
```

**Respuesta esperada (200 — con acceso):**
```json
[{ "permiteAcceso": "1", "tipo": "alumno" }]
```

**Respuesta esperada (200 — sin acceso):**
```json
[{ "permiteAcceso": "0", "tipo": null }]
```

---

## 3. Flujo por `origin`

Simula el comportamiento del portal según el sistema de origen que llama.

### 3.1 Origen `rematricula-online` → flujo completo
El sistema:
1. Valida formato `@uniacc.cl`
2. Busca en `mv_usuario` (Supabase)
3. Si existe → valida LDAP
4. Si no existe → valida Pixarron

Se prueba enviando al proxy Vite (punto 2.1). El origen lo determina el cliente frontend, no el endpoint.

---

### 3.2 Origen `whatsapp` → solo Pixarron

Pasa directo al API de Pixarron sin consultar Supabase ni LDAP:

```
GET {{vite_url}}/api/pixarron/acceso/nombre.apellido/{{password_b64}}
```

---

## 4. Pre-request Script para generar Base64

Agrega esto en la pestaña **Pre-request Script** de cualquier request que necesite Base64:

```js
// Reemplaza el valor con la contraseña real a probar
const passwordPlano = "mi_contraseña_de_prueba"
pm.environment.set("password_b64", btoa(passwordPlano))
console.log("password_b64 generado:", pm.environment.get("password_b64"))
```

Y en el body del request usa `{{password_b64}}`:
```json
{
  "username": "nombre.apellido",
  "password": "{{password_b64}}"
}
```

---

## 5. Tabla de Códigos de Respuesta

| Código | Causa |
|---|---|
| `200` | Petición procesada (revisa `valid: true/false` en el body) |
| `400` | Body mal formado, campos faltantes o password no es Base64 válido |
| `401` | API Key inválida/ausente **o** credenciales LDAP incorrectas |
| `503` | Servidores LDAP inaccesibles (requiere VPN o red interna Uniacc) |
| `500` | Error inesperado en el servidor |

---

## 6. Colección Postman — importar como JSON

Guarda este contenido en un archivo `uniacc-auth.postman_collection.json` e impórtalo en Postman:

```json
{
  "info": {
    "name": "Uniacc Auth",
    "_postman_id": "uniacc-auth-collection",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    { "key": "ldap_url", "value": "http://localhost:9500" },
    { "key": "vite_url", "value": "http://localhost:9501" },
    { "key": "api_key", "value": "REEMPLAZA_CON_TU_API_KEY" }
  ],
  "item": [
    {
      "name": "1. Health Check",
      "request": {
        "method": "GET",
        "url": "{{ldap_url}}/health"
      }
    },
    {
      "name": "2. LDAP Validate — directo con X-API-Key",
      "event": [{
        "listen": "prerequest",
        "script": {
          "exec": ["pm.environment.set('password_b64', btoa('TU_CONTRASEÑA'))"]
        }
      }],
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "X-API-Key", "value": "{{api_key}}" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"username\": \"nombre.apellido\",\n  \"password\": \"{{password_b64}}\"\n}"
        },
        "url": "{{ldap_url}}/validate"
      }
    },
    {
      "name": "3. LDAP Validate — directo con Bearer",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Authorization", "value": "Bearer {{api_key}}" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"username\": \"nombre.apellido\",\n  \"password\": \"{{password_b64}}\"\n}"
        },
        "url": "{{ldap_url}}/validate"
      }
    },
    {
      "name": "4. LDAP sin API Key (espera 401)",
      "request": {
        "method": "POST",
        "header": [{ "key": "Content-Type", "value": "application/json" }],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"username\": \"nombre.apellido\",\n  \"password\": \"{{password_b64}}\"\n}"
        },
        "url": "{{ldap_url}}/validate"
      }
    },
    {
      "name": "5. LDAP vía Proxy Vite",
      "request": {
        "method": "POST",
        "header": [{ "key": "Content-Type", "value": "application/json" }],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"username\": \"nombre.apellido\",\n  \"password\": \"{{password_b64}}\"\n}"
        },
        "url": "{{vite_url}}/api/auth/ldap"
      }
    },
    {
      "name": "6. Pixarron vía Proxy Vite",
      "request": {
        "method": "GET",
        "url": "{{vite_url}}/api/pixarron/acceso/nombre.apellido/{{password_b64}}"
      }
    },
    {
      "name": "7. LDAP ruta alternativa v1",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "X-API-Key", "value": "{{api_key}}" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"username\": \"nombre.apellido\",\n  \"password\": \"{{password_b64}}\"\n}"
        },
        "url": "{{ldap_url}}/api/v1/auth/ldap"
      }
    }
  ]
}
```
