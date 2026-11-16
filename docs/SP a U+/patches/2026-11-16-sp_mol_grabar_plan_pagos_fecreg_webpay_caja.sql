-- FECREG / FECREG_DEP del Webpay usan @fecreg_caja, igual que la boleta 41.
-- FECCANCEL del CTAPAG Webpay sigue @hoy; FECHA sigue @fecha_json.
-- No aplicar en U+ desde este commit: el patch se corre en Task 4 (TEST primero).

SET NOCOUNT ON;
DECLARE @sql nvarchar(max) = OBJECT_DEFINITION(OBJECT_ID('dbo.sp_mol_grabar_plan_pagos'));
IF @sql IS NULL THROW 50000, 'No existe dbo.sp_mol_grabar_plan_pagos', 1;

IF LEFT(LTRIM(@sql), 6) = 'CREATE'
  SET @sql = STUFF(LTRIM(@sql), 1, 6, 'ALTER');

-- Ya aplicado
IF CHARINDEX(N'@fecven_json, @hoy, @fecreg_caja, @fecha_json', @sql) > 0
   AND CHARINDEX(N'@caja, @fecreg_caja, @ano, @jornada', @sql) > 0
   AND CHARINDEX(
         N'41, @ctadoc_boleta, @ctapag_json, @ctapagnum, @codcli, @codcarr, @codapod_boleta',
         @sql) > 0
BEGIN
  PRINT 'Patch FECREG Webpay ya aplicado';
  RETURN;
END

DECLARE @old_pag nvarchar(400) =
  N'@fecven_json, @hoy, @hoy, @fecha_json, @usuario, @num_operacion, @jornada';
DECLARE @new_pag nvarchar(400) =
  N'@fecven_json, @hoy, @fecreg_caja, @fecha_json, @usuario, @num_operacion, @jornada';

IF CHARINDEX(@old_pag, @sql) = 0
BEGIN
  SET @old_pag = REPLACE(@old_pag, CHAR(10), CHAR(13) + CHAR(10));
  SET @new_pag = REPLACE(@new_pag, CHAR(10), CHAR(13) + CHAR(10));
END
IF CHARINDEX(@old_pag, @sql) = 0
  THROW 50000, 'Patron CTAPAG FECREG Webpay no encontrado', 1;

SET @sql = REPLACE(@sql, @old_pag, @new_pag);

DECLARE @old_dep nvarchar(400) = N'@caja, @hoy, @ano, @jornada';
DECLARE @new_dep nvarchar(400) = N'@caja, @fecreg_caja, @ano, @jornada';
-- Anclar al bloque Webpay: solo la ocurrencia tras @ctapag_json en CTADEP.
-- Preferir REPLACE del bloque largo si @old_dep aparece más de una vez:
DECLARE @old_dep_block nvarchar(900) =
  N'41, @ctadoc_boleta, @ctapag_json, @ctapagnum, @codcli, @codcarr, @codapod_boleta,
                        @monto_json, 1, @usuario, 0, ''1'', @ctadoc_boleta, @num_operacion,
                        @caja, @hoy, @ano, @jornada';
DECLARE @new_dep_block nvarchar(900) =
  N'41, @ctadoc_boleta, @ctapag_json, @ctapagnum, @codcli, @codcarr, @codapod_boleta,
                        @monto_json, 1, @usuario, 0, ''1'', @ctadoc_boleta, @num_operacion,
                        @caja, @fecreg_caja, @ano, @jornada';

IF CHARINDEX(@old_dep_block, @sql) = 0
BEGIN
  SET @old_dep_block = REPLACE(@old_dep_block, CHAR(10), CHAR(13) + CHAR(10));
  SET @new_dep_block = REPLACE(@new_dep_block, CHAR(10), CHAR(13) + CHAR(10));
END
IF CHARINDEX(@old_dep_block, @sql) = 0
  THROW 50000, 'Patron CTADEP FECREG_DEP Webpay no encontrado', 1;

SET @sql = REPLACE(@sql, @old_dep_block, @new_dep_block);

IF CHARINDEX(N'@fecven_json, @hoy, @hoy, @fecha_json', @sql) > 0
  THROW 50000, 'Quedo FECREG=@hoy en CTAPAG Webpay', 1;

EXEC sys.sp_executesql @sql;
PRINT 'Patch FECREG Webpay aplicado';
