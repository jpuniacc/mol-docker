# Final fix wave — avisos email

Fecha: 2026-09-16

- API: el claim recupera filas `enviando` con más de 5 minutos, conservando la transacción corta y `FOR UPDATE SKIP LOCKED`.
- MOL: `onConvenioSubido` exige un `refId` no vacío y muestra error antes de abrir un caso sin referencia.
- Scripts: dependencias Python documentadas en `scripts/requirements.txt` y en el docstring del cargador.
- Verificación API: `npx tsx --test src/services/rematricula-aviso-outbox.service.test.ts` (4/4) y `npm run type-check` exitosos.
- Verificación MOL: `git diff --check` y diagnósticos de los archivos modificados exitosos. El type-check global permanece bloqueado por errores preexistentes de configuración y archivos fuera de esta corrección.
