# Hotfix de progreso — plan aprobado, solo DEV

El código revisado ya tenía refresh al cargar y señales Webpay/borrador desde la migración 20261106190000. El caso 21067143-9 ya figura forma_pago antes de este cambio. Falta limitar recálculos, acotar espera y cubrir medioArancel/RUT con DV sin colisiones.

1. Respaldar servicio/vista, función aplicada, progreso y borradores en backups/hotfix-progreso-20261107 (hecho).
2. Tests RED: seis de refresh (concurrencia, TTL, período, errores, red y timeout); 16 fixtures SQL que ejecutan CTE reales (RUT con/sin DV, buy_order delimitado, autorizada/período/concepto, ambos medios y modal vacío).
3. Conservar refresh antes de KPI/lista y warning existente. Servicio compartido: single-flight por período, cache solo éxito 60 s, timeout 8 s con AbortController; errores devueltos como resultado para listar con aviso.
4. Migración nueva: TTL global 60 s bajo advisory lock existente, sin nueva tabla ni permisos. Webpay por codcli académico o RUT normalizado completo/sin DV; buy_order exige RUT sin DV + año + semestre + separador. Borrador acepta medioMatricula o medioArancel webpay/pagare persistidos; abrir el modal no persiste medios (ver continuarSelectorMedios/persistirMediosYMontosWebpay). No cambia firma ni U+.
5. GREEN unit/SQL; verificar caso real, controles datos/sin_ingreso y TTL global. Compilar en contenedor y rebuild solo mol-dev; API sin cambios, revisar compilación y chip con servicio actual.
6. Smoke HTTP de API y logs, guardar evidencia; commit dev solo archivos hotfix, sin push, sin yarn.lock ni cambios previos de API. Plan de avisos copiado como archivo no commiteado.

Rollback: revertir archivos selectivamente desde respaldo, restaurar refresh-antes.sql y rebuild mol-dev; no deshacer otros commits ni borrar datos de contactos. No ejecutar rollback sin necesidad/confirmación.

## Verificación ejecutada
- RED: 4 fallos unitarios (single-flight, TTL, rechazo de red y timeout) antes de implementar. SQL detectó RUT con DV/formateado, colisión de prefijo y medioArancel; regresión adicional rechazó extracción de RUT desde codcli alfanumérico.
- GREEN: 6/6 pruebas del servicio; 16/16 fixtures SQL aislados (ROLLBACK). Suite Vue/jsdom: 460/460 tests, 76 archivos (la configuración existente también recoge un test en backups).
- Aplicada migración nueva en DEV. Refresh devuelve 4690 filas; segunda llamada dentro del TTL no modifica ninguna marca actualizado_en. Controles existentes datos y sin_ingreso mantienen su etapa.
- Caso 20221TRIE1DR052 / 21067143-9: etapa SQL forma_pago; HTTP bandeja y detalle 200, chip forma_pago; resumen de medios «Mat. Webpay ✓» y webpay_matricula_autorizada=true. Ya estaba en forma_pago al iniciar; este cambio endurece frescura y cobertura, no se atribuye una transición que no ocurrió en esta ejecución.
- Build/rebuild mol-dev OK (Vite). API tsc --noEmit OK, sin cambios/rebuild de API.
- Type-check global frontend sigue fallando con 80 diagnósticos preexistentes. Comparación montando el servicio original read-only: los mismos 80 y hash idéntico de líneas de error (912af7924442f78f30a88dfcc84fdc964e7a3f7e1721d624aabbe83d6c680a52); ninguno afecta al servicio modificado. No se amplió alcance para resolverlos.
- Salud front/API HTTP 200. Logs recientes de mol-dev, API y DB sin errores detectados de permisos/sintaxis/aplicación en la ventana revisada.
- Sin smoke visual de navegador. La vista ya llamaba refresh antes de KPI/lista, por eso no se modificó el componente ni la partición de chips 5/6.
- Evidencias SQL/HTTP/build y baseline typecheck en el respaldo. Imagen previa: mol-docker-mol-dev:pre-hotfix-progreso-20261107-1848.
- Avisos: PLAN.md copiado en docs/wireframes/avisos-proxima-accion, sin commit ni implementación. CORTE 2, cron, retención y WhatsApp siguen fuera del hotfix.
