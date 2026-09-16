# Task 3 — Portal: esMock, convenio y apoderado

## Estado

Implementado.

## Cambios

- `abrirCasoRematricula` acepta `esMock` y envía `p_es_mock` al RPC.
- Los casos de rechazo de TyC y datos de apoderado propagan `ctx.esMock`.
- El caso de apoderado incluye sus datos en `payload` y ya no invoca el endpoint SMTP directo ni registra `correo_ok`/`correo_error`.
- La carga de un certificado de convenio abre un caso `CONVENIO_CERTIFICADO`.
- `ConvenioVigenteUpload` propaga el ID retornado por `subirDocumentoConvenio`; se usa `storagePath` como respaldo para `refId`.
- Los tipos de Supabase incluyen `p_es_mock?: boolean | null`.

## Verificación

- `git diff --check`: PASS.
- Diagnósticos IDE de los archivos modificados: PASS.
- `npm run type-check`: ejecutado; FAIL por errores preexistentes del árbol/dependencias, incluidos incompatibilidad de `@tsconfig/node22`, ausencia de `http-proxy`, configuración de Vitest y un tipo previo de cuotas de pagaré en `FormaPagoMockView.vue`.
- ESLint dirigido: no pudo iniciar porque falta `eslint-plugin-cypress` en las dependencias instaladas.

## Consideraciones

El árbol ya contenía numerosos cambios sin commit. El commit de esta tarea se limita a los archivos del brief y este reporte.

## Corrección posterior a revisión

- Se agregó `src/utils/periodoCatalogo.ts`, dependencia requerida por las vistas de TyC, apoderado y forma de pago.
- Se agregó `src/utils/periodoCatalogo.test.ts`.
- Se agregó `supabase/migrations/20260910180000_resolver_caso_cerrado.sql`, que habilita el estado `CERRADO` usado al aceptar TyC después de un rechazo.
- `npx vitest run src/utils/periodoCatalogo.test.ts`: no inició por un error preexistente de configuración de Vitest: `Cannot merge config in form of callback`.
- `git diff --check` sobre los archivos de la corrección: PASS.
