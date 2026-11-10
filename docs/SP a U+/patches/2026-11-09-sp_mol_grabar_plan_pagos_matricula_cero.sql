-- Permite monto_matricula = 0 (reintegro / matrícula cubierta).
-- Aplicado en TEST_UNIACC el 2026-11-09.
-- El cuerpo del SP ya omite CTAPAG de pagaré cuando monto = 0
-- (WHERE es_web = 0 AND monto > 0).

SET NOCOUNT ON;
DECLARE @sql nvarchar(max) = OBJECT_DEFINITION(OBJECT_ID('dbo.sp_mol_grabar_plan_pagos'));
IF @sql IS NULL THROW 50000, 'No existe dbo.sp_mol_grabar_plan_pagos', 1;

IF LEFT(LTRIM(@sql), 6) = 'CREATE'
  SET @sql = STUFF(LTRIM(@sql), 1, 6, 'ALTER');

DECLARE @old nvarchar(400) = N'IF @monto_matricula <= 0 OR @monto_arancel < 0
        THROW 50002, ''Matrícula tiene que ser mayor que cero y arancel no puede ser negativo.'', 1;';
DECLARE @new nvarchar(400) = N'IF @monto_matricula < 0 OR @monto_arancel < 0
        THROW 50002, ''Matrícula y arancel no pueden ser negativos.'', 1;';

IF CHARINDEX(@old, @sql) = 0
BEGIN
  SET @old = REPLACE(@old, CHAR(10), CHAR(13) + CHAR(10));
  SET @new = REPLACE(@new, CHAR(10), CHAR(13) + CHAR(10));
END

IF CHARINDEX(@old, @sql) = 0
  THROW 50000, 'Patron de validacion monto_matricula no encontrado', 1;

SET @sql = REPLACE(@sql, @old, @new);
IF CHARINDEX(N'Matrícula tiene que ser mayor que cero', @sql) > 0
  THROW 50000, 'Quedo validacion antigua tras REPLACE', 1;

EXEC sys.sp_executesql @sql;
