# Modal de error de rematrícula e ingreso

Fecha: 2026-10-16  
Proyecto: `mol-docker`  
Estado: diseño aprobado, pendiente de implementación

## Problema

Un error de rematrícula aparece como un toast con el código crudo. En forma de pago, Webpay respondió `ya-autorizada` y eso fue el texto visible.

En el inicio de sesión, una credencial rechazada o una verificación fallida también sale en un toast. Los bloqueos de alumno no vigente, SUBDERE, arancel diferenciado y términos rechazados ya tienen modal, con otro aspecto.

El alumno y el consejero necesitan saber qué pasó, en una frase, y tener una salida clara.

## Decisión

Un solo modal, montado en la matrícula del alumno, en el backoffice de rematrícula y en el inicio de sesión. Todo error de esas superficies lo abre. Un aviso de éxito sigue siendo un toast.

El modal usa la franja elegida: dibujo arriba, saludo, título, cuerpo y botón rosa. En rematrícula suma dos enlaces. En el ingreso, los controles son los de esa sección.

## Saludo y lugares

- En la matrícula del alumno, el saludo es «Hola, {nombre del alumno}».
- En el backoffice, el saludo es «Hola, {nombre del consejero}».
- El backoffice usa las mismas cuatro escenas que el alumno.

## Forma

1. Franja `#fff7f2` con la ilustración de la escena.
2. Saludo en `#D91B7A`.
3. Título en `#1E3A5F`.
4. Cuerpo en una frase simple. No muestra códigos como `ya-autorizada`.
5. Botón rosa `#D91B7A`: **Intentar de nuevo**.
6. En rematrícula, enlaces en `#3B9EC9`: **Ir al inicio** y **Reportar este bache**. El ingreso reemplaza estos controles.

La ilustración es corta. Si la persona prefiere menos movimiento, queda quieta. El modal usa `alertdialog`, anuncia el error y deja el foco en el botón rosa.

## Escenas

| Escena | Dibujo | Cuándo | Título de ejemplo |
|---|---|---|---|
| Conexión | Astronauta y Wi-Fi tachado | Red, tiempo de espera, servidor o un error que el catálogo no reconoce | Houston, tenemos un pequeño problema |
| Pago | Tarjeta con visto | Webpay, incluido `ya-autorizada`, monto inválido o un cobro que no salió | Este pago ya tiene asiento |
| Firma | Lápiz y contrato | TuFirma, el PDF del contrato, el envío a firmar o la descarga en Gestión de firmas | La firma se quedó en el tintero |
| Datos | Ficha y lápiz | Falta un campo, una fecha o un motivo | Falta una pieza del formulario |

El cuerpo de conexión dice que los datos siguen a salvo. El de `ya-autorizada` dice que la matrícula o el arancel ya quedaron autorizados y que no hace falta pasar la tarjeta otra vez. Un cobro que no salió usa la escena Pago con otra frase. La escena Datos nombra lo que falta, por ejemplo el día 5, 15 o 25.

En Gestión de firmas, abrir un contrato llama a `GET /api/rematricula/alumno/contrato/firma/{numOperacion}/documento`. Si TuFirma rechaza la descarga, hoy el toast muestra el código, por ejemplo `HTTP 400`. Ese caso abre Firma, saluda al consejero y dice: «No pudimos traer el contrato de la operación {número}. El registro sigue aquí». **Intentar de nuevo** repite la descarga. No muestra `HTTP 400`.

## Catálogo y botones

Cada error pasa por un catálogo. Un código conocido elige escena, título y cuerpo. Un código desconocido cae en Conexión, con el título de Houston y un cuerpo genérico. El código técnico no se muestra.

- **Intentar de nuevo** repite la acción que falló.
- Si el error es de Datos, el botón cierra el modal y deja el foco en el campo.
- Si no hay acción que repetir, el botón solo cierra.
- **Ir al inicio**, en la matrícula del alumno, abre la ruta `matricula-alumno-datos`. En el backoffice abre `dashboard-rematricula-kpi`.
- **Reportar este bache** abre un correo a `mol@uniacc.cl` con el título de la escena.

## Inicio de sesión

La misma franja se usa en el login. El saludo aparece solo si el flujo ya conoce el nombre. Si no, el modal parte en el título.

### No se pudo ingresar

Dibujo: astronauta frente a una puerta bloqueada.

- Credencial rechazada. Título: «La puerta no quiso abrir esta vez». Cuerpo: «No pudimos comprobar tus datos de acceso. Revisa tu usuario y contraseña e inténtalo nuevamente».
- Servidor o verificación de registros. Título: «La puerta está un poquito atascada». Cuerpo: pide reintentar en unos minutos.
- **Intentar de nuevo** cierra el modal y deja el foco en el usuario.
- **Necesito ayuda para ingresar** abre un correo a `servicio.estudiante@uniacc.cl`.
- Usuario o contraseña vacíos no abren el modal. Se marca el campo vacío y el foco queda ahí.

### Bloqueos que ya existen

Conservan su título, su cuerpo y el contacto `servicio.estudiante@uniacc.cl`. Pasan a la misma franja y a la ilustración de la puerta. El botón sigue siendo **Entendido** y solo cierra.

- Alumno no vigente: «No es posible continuar con tu proceso de rematrícula».
- Beca SUBDERE: el mismo título, con el cuerpo actual de la beca.
- Arancel diferenciado: el mismo título, con el cuerpo de revisión académica.
- Términos rechazados: «Sesión cerrada» y el mensaje actual. El botón sigue diciendo **Entendido**.

## Alcance

Cubre los errores de la matrícula del alumno, del backoffice de rematrícula y del inicio de sesión. No cambia los toast de éxito ni los errores del resto de MOL.

## Prueba

El catálogo se prueba con seis casos: `ya-autorizada` abre Pago con «Este pago ya tiene asiento»; un fallo de firma abre Firma; la descarga `HTTP 400` de Gestión de firmas abre Firma con la operación y no muestra el código; un código desconocido abre Conexión y no expone el código; una credencial rechazada abre la puerta con «La puerta no quiso abrir esta vez»; usuario vacío no abre el modal.
