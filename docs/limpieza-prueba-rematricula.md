# Limpieza de una prueba de rematrícula

Borra el avance MOL de un alumno para repetir el flujo. No toca cartera, plan de pagos ni datos de ERP.

Alumno de prueba usado: RUT `22103156-3`, codcli `20251MUIN1DR015`.

Después de borrar, el alumno tiene que **cerrar sesión** en el navegador. El wizard guarda el avance en `sessionStorage` hasta el logout.

## 1. Postgres de Supabase (`supabase-db`, base `postgres`)

```sql
BEGIN;

DELETE FROM public.mnp_aviso_consejero
 WHERE rut_alumno = '22103156-3' OR codcli = '20251MUIN1DR015';

DELETE FROM public.mnp_discapacidad_encuesta
 WHERE rut_alumno = '22103156-3' OR codcli = '20251MUIN1DR015';

DELETE FROM public.log_mol_contacto_otp
 WHERE rut_alumno = '22103156-3' OR codcli = '20251MUIN1DR015';

DELETE FROM public.log_mol_tyc_respuesta
 WHERE rut_alumno = '22103156-3' OR codcli = '20251MUIN1DR015';

DELETE FROM public.log_mol_evento
 WHERE rut_alumno = '22103156-3' OR codcli = '20251MUIN1DR015';

DELETE FROM public.mnp_caso_rematricula
 WHERE rut_alumno = '22103156-3' OR codcli = '20251MUIN1DR015';

DELETE FROM public.mnp_convenio_documento
 WHERE rut_alumno = '22103156-3' OR codcli = '20251MUIN1DR015';

DELETE FROM public.mnp_verificacion_cae_mol
 WHERE rut_alumno = '22103156-3' OR codcli = '20251MUIN1DR015';

COMMIT;

SELECT public.refresh_mnp_progreso_rematricula(2027, 1);
```

El `refresh` rearma el embudo del periodo. El alumno vuelve a **sin ingreso**.

Comprobar:

```sql
SELECT etapa_actual, ultima_actividad_label
  FROM public.mnp_progreso_rematricula
 WHERE codcli = '20251MUIN1DR015';
```

## 2. Postgres de uniacc-api (schema `mnp`)

Contrato enviado a TuFirma. Si la fila queda, el siguiente envío reutiliza el mismo PDF.

```sql
DELETE FROM mnp.rematricula_contrato_tufirma
 WHERE rut = '22103156-3' OR codcli = '20251MUIN1DR015';
```
