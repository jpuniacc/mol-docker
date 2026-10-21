# Prueba pública de Pixarrón — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una página pública en MOL dispara, desde `autenticacion-api`, una prueba de conectividad o de acceso a Pixarrón y muestra un log enmascarado que también queda en un archivo.

**Architecture:** La vista `/prueba-pixarron` hace `POST /api/auth/prueba-pixarron`. Nginx ya reenvía ese prefijo al contenedor del login. El endpoint no valida API key. Mide DNS, TLS y HTTP contra `PIXARRON_SERVICE_URL` y responde 200 con el log aunque Pixarrón falle.

**Tech Stack:** Vue 3 + TypeScript en `mol-docker`. Express + `node:test` en `autenticacion-uniacc-api-docker`.

## Global Constraints

- Ruta pública `/prueba-pixarron`, fuera del menú y de `/dashboard`.
- Destino fijo: `PIXARRON_SERVICE_URL` (por defecto `https://pixarron.uniacc.cl`).
- Modos: `conectividad` (`GET /`) y `acceso` (`GET /api/acceso/{usuario}/{clave}` con Basic de las variables ya existentes).
- La clave del alumno, su forma codificada, `PIXARRON_BASIC_USER`, `PIXARRON_BASIC_PASS` y el header `Authorization` no salen en la respuesta ni en el archivo.
- Topes: DNS 5 s, TLS 8 s, HTTP 15 s. La página espera 35 s.
- Resumen: estado 504 → `504`; cabecera `Server` con `IIS` → `llego`; el resto → `otro`. El 504 se evalúa primero.
- Archivo: `/var/log/pixarron-prueba/pruebas.log`, montado desde `./logs`. Si no se puede escribir, `guardado: false` y la pantalla avisa.
- Petición inválida: 400 y sin línea en el archivo.
- No se modifica el login.

## Archivos

- Crear: `autenticacion-uniacc-api-docker/src/prueba/pixarronPrueba.ts`
- Crear: `autenticacion-uniacc-api-docker/src/prueba/pixarronPrueba.test.ts`
- Modificar: `autenticacion-uniacc-api-docker/src/server.ts`
- Modificar: `autenticacion-uniacc-api-docker/package.json` (script `test`)
- Modificar: `autenticacion-uniacc-api-docker/tsconfig.json` (excluir `*.test.ts`)
- Modificar: `autenticacion-uniacc-api-docker/docker-compose.yml` (volumen `./logs`)
- Crear: `mol-docker/src/views/prueba/PruebaPixarronView.vue`
- Modificar: `mol-docker/src/router/index.ts`

## Interfaces

```ts
export type ResumenPrueba = '504' | 'llego' | 'otro'
export type ModoPrueba = 'conectividad' | 'acceso'

export function resumirPrueba(estado: number | null, server: string | null): ResumenPrueba
export function validarCuerpoPrueba(body: unknown):
  | { ok: true; modo: 'conectividad' }
  | { ok: true; modo: 'acceso'; usuario: string; clave: string }
  | { ok: false; message: string }
export function enmascararTexto(texto: string, secretos: string[]): string
export function ejecutarPruebaPixarron(input: EntradaPrueba, deps: DependenciasPrueba): Promise<LogPruebaPixarron>
export function guardarLineaLog(ruta: string, log: LogPruebaPixarron): Promise<boolean>
```

### Task 1: Lógica y pruebas del log

- [ ] Escribir `pixarronPrueba.test.ts` y verlo fallar.
- [ ] Implementar enmascarado, resumen, validación, ejecución con pasos inyectados y escritura del archivo.
- [ ] `node --import tsx --test src/prueba/pixarronPrueba.test.ts` en verde.

### Task 2: Endpoint y volumen

- [ ] `POST /api/auth/prueba-pixarron` sin `validateApiKey`.
- [ ] Volumen `./logs:/var/log/pixarron-prueba` en el compose de producción.
- [ ] Excluir los test del `tsc`.

### Task 3: Vista

- [ ] Ruta pública y pantalla con los dos botones, el resumen y el log copiable.
- [ ] Aviso si `guardado` es false.

### Task 4: Verificación

- [ ] Reconstruir `autenticacion-api` y `mol-dev`.
- [ ] Abrir `/prueba-pixarron` sin sesión, disparar conectividad y comparar pantalla y archivo.
- [ ] Disparar acceso y confirmar que la clave no aparece.
- [ ] Publicar front y API en mol.uniacc.cl y repetir la conectividad.
