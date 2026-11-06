# Task 1 — Módulo conector en la API: reporte

**Estado:** DONE_WITH_CONCERNS (preocupaciones menores, ver al final)
**Commit:** `6307343 feat(rematricula): armar y enviar el desbloqueo de un RUT a ConectorIntegracion` (rama `dev`, sin push)

## Qué se implementó
Módulo independiente `src/services/desbloqueo-conector-integracion.ts`, copiado tal cual del brief:
- `FilaConector`, `DepsConector` (tipos exportados).
- `filaConector(...)`: arma `rut` como `cuerpo-dv`, usa `'MOL'` si el actor está vacío o solo tiene espacios, recorta el actor a 100 caracteres y mapea `desbloqueado` a `'S'`/`'N'`.
- `depsConectorPorDefecto`: lee el período activo desde `public.tp_periodo_activo` y el estado del RUT desde `public.mnp_desbloqueo_toma_ramos` (Supabase), y hace un `MERGE ... WITH (HOLDLOCK)` en `ConectorIntegracion.dbo.MOL_ALUMNOS_DESBL` usando `getConnectionErpSp('prod')`.
- `sincronizarRutConector(...)`: devuelve `null` si todo sale bien, `'No hay período activo; no se envió a U+.'` si no hay período (sin llamar al merge), o `'<rut> quedó en MOL, pero no llegó a U+.'` ante cualquier error (registra el error con `console.error` y no lanza).

## Archivos modificados
- Nuevo: `src/services/desbloqueo-conector-integracion.ts`
- Nuevo: `src/services/desbloqueo-conector-integracion.test.ts`

No se tocó ningún otro archivo.

## Evidencia de TDD
**RED** — `npx tsx --test src/services/desbloqueo-conector-integracion.test.ts` (solo existía el test):
```
Error: Cannot find module './desbloqueo-conector-integracion'
ℹ tests 1  ℹ pass 0  ℹ fail 1
```
Era lo esperado: el módulo todavía no existía.

**GREEN** — el mismo comando, después de implementar:
```
▶ filaConector
  ✔ arma el RUT con guion y marca S
  ✔ usa MOL si el actor viene vacío y marca N
  ✔ recorta el actor a 100 caracteres
▶ sincronizarRutConector
  ✔ hace el merge con el estado que queda en Supabase
  ✔ devuelve el aviso si U+ falla y no lanza
  ✔ sin período activo no llama al merge
ℹ tests 6  ℹ pass 6  ℹ fail 0
```

## Type-check
`npm run type-check` (`tsc --noEmit`): limpio, sin errores.

## Suite completa
`npm test`: 181 tests, 181 pasan, 0 fallan (60 suites). La suite incluye el archivo nuevo. No hay fallas previas no relacionadas.

## Autorrevisión
- Completitud: los nombres, firmas, textos de aviso, SQL y los 6 tests coinciden literalmente con el brief.
- YAGNI: no se agregó nada fuera del brief.
- Patrones: sigue el estilo existente (`node:test`, inyección de dependencias, `import sql from 'mssql'`, queries a `tp_periodo_activo` como en otros servicios).
- Los tests usan solo dependencias falsas inyectadas; no se conectó a ninguna base de datos.

## Preocupaciones
1. **La salida de los tests no queda limpia:** el test "devuelve el aviso si U+ falla" imprime `[desbloqueo-conector] 18056961-8: timeout` en stderr, por el `console.error` que pide el brief. Es esperado e inofensivo; se dejó como está para respetar el brief al pie de la letra.
2. Al momento del commit, `git status` no mostraba `.env.docker.example` como modificado (solo aparecían los dos archivos nuevos). De todos modos, se agregaron al stage únicamente las dos rutas exactas.
3. `periodoActivo` toma la primera fila activa ordenada por `id`. Si en algún momento hay más de un período activo, se usaría el de menor `id` (comportamiento definido en el brief).

## Fix after review

Se quitó la duplicación de consultas. `leerPeriodoActivo` vive en `src/services/periodo-activo.ts` y lo usan el conector y `periodoDeRematricula`. `rutCuerpoDesbloqueado` vive en el módulo conector y lo usa `estaDesbloqueado`.

Archivos: `periodo-activo.ts` (nuevo), `desbloqueo-conector-integracion.ts`, `desbloqueo-conector-integracion.test.ts`, `desbloqueo-toma-ramos.service.ts`, `matricula-flujo-preflight.service.ts`.

Commit: `b3bf7cd refactor(rematricula): compartir las consultas de período activo y desbloqueo`.

- `npx tsx --test src/services/desbloqueo-conector-integracion.test.ts`: 8 de 8, sin stderr.
- `npm run type-check`: limpio.
- `npm test`: 183 de 183.
