# Operación — avisos internos de próximas acciones

## Estado de esta entrega
Solo DEV. Scheduler deshabilitado por defecto; no se activó ni se hizo envío real. No se modificó .env ni SEGUIMIENTO_FROM_MODE.

Defaults de código:
```
SEGUIMIENTO_AVISOS_ENABLED=false
SEGUIMIENTO_AVISOS_DRY_RUN=true
```
Con cualquiera de esas protecciones, el runner genera previews sin escribir cola ni invocar SMTP. No hay ruta HTTP de envío.

## Simulación y pruebas (DEV)
Desde `/opt/uniacc-api-docker`:
```
docker exec uniacc-api node dist/scripts/seguimiento-avisos-dry-run.js
docker exec uniacc-api node dist/scripts/seguimiento-avisos-dry-run.js --fixture
docker exec uniacc-api node dist/scripts/seguimiento-avisos-verificar.js
```
El primer comando consulta notas elegibles reales, muestra solo conteos/asuntos y no envía. El segundo usa exclusivamente alumnos sintéticos y muestra asunto/texto/HTML. El tercero comprueba selecciones, históricos, gestión, aislamiento por cartera, idempotencia y lease ambiguo dentro de una transacción; termina con ROLLBACK y no manda correo.

Permisos SQL, desde `/opt/mol-docker`:
```
docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/seguimiento_avisos_rls.sql
```
Esta suite también termina con ROLLBACK: comprueba SELECT/INSERT/UPDATE/DELETE denegados a anon/authenticated en ambas tablas, RLS, estado válido y default de nuevas notas.

## Activación futura — requiere autorización explícita, NO realizada aquí
1. Revisar el dry-run, mantenedor de ejecutivos y asignaciones de cartera. Confirmar destinatarios y plantilla antes de autorizar envíos reales.
2. Mantener el modo global SEGUIMIENTO_FROM_MODE. direct: From del ejecutivo y To al mismo ejecutivo; relay_reply_to: From SMTP_FROM y Reply-To ejecutivo. El nombre se obtiene del mantenedor existente; no se agregan CC.
3. Definir explícitamente `SEGUIMIENTO_AVISOS_BASE_URL=https://mol-dev.uniacc.cl` en la configuración DEV; para envío real es obligatorio un origen HTTPS sin credenciales. SMTP_FROM debe estar configurado por el canal existente. No mostrar ni copiar secretos a logs.
4. Para prueba programada sin correo, configurar ENABLED=true y mantener DRY_RUN=true. Se simula lunes–viernes a las 09:00 America/Santiago, con recuperación hasta antes de las 10:00. No se guardan filas de cola en simulación.
5. Solo tras autorización real, configurar `SEGUIMIENTO_AVISOS_ENABLED=true` y `SEGUIMIENTO_AVISOS_DRY_RUN=false`; recrear solo el servicio API DEV para cargar configuración. No ejecutar ese cambio en esta tarea.
6. Desactivar inmediatamente poniendo ENABLED=false (o DRY_RUN=true) y recreando la API. Cambiar la configuración del archivo no cambia un contenedor ya iniciado.

## Recuperación y límites
- Un digest por ejecutivo/fecha local/tipo. No se encola si está vacío.
- Nuevas acciones después de un digest enviado se incluyen en el siguiente día hábil; no se fuerza un segundo correo del día.
- Históricos permanecen visibles en badge si siguen pendientes, pero nunca entran al digest por su bandera false. Su fecha de contacto no determina elegibilidad: la marca se fija al aplicar la migración para filas existentes.
- Error anterior a SMTP: estado error y backoff (máximo tres intentos). Si llega el día siguiente sin enviarse, se cancela la fila vieja y se construye el digest del nuevo día.
- SMTP aceptado sin confirmación DB, rechazo/timeout incierto o lease vencido: estado ambiguo; requiere revisar logs del proveedor/relay antes de cualquier decisión manual. No prometer exactly-once SMTP ni cambiar ambiguo a pendiente a ciegas.
- Reasignación: se consulta nuevamente la cartera antes del envío. El antiguo ejecutivo no recibe acciones que ya no le pertenecen.
- La API conserva el mecanismo actual de identidad X-Mol y su control de acceso perimetral. Estos cambios no sustituyen una futura revisión de autenticación del backoffice.

## Respaldo / rollback no destructivo
`/opt/mol-docker/backups/avisos-proxima-accion-20261107` contiene fuentes previas, contactos SQL comprimidos y evidencias.
Antes de cualquier rollback, confirmar necesidad y estado actual. Deshabilitar scheduler, restaurar solamente archivos propios desde respaldo y rebuild de los servicios DEV; las columnas/tablas aditivas pueden permanecer inertes con RLS. No usar reset --hard ni borrar columnas, contactos o cola para deshacer este cambio.
