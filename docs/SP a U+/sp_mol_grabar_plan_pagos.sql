-- U+ Test. Graba dos pagarés (matrícula y arancel) cuando el contrato ya está firmado.
-- Los CORRPAGNUM entran reservados. Este SP pide el número de operación y las dos boletas.
-- Inserta MT_POSBEN (estado 4) por cada beneficio que llega en @beneficios.
-- Una tabla vacía no inserta nada. @codcli es el RUT sin dígito verificador.
-- Después del COMMIT, MOL llama aparte a SP_MOL_ACTUALIZA_MATRICULA_FIRMADA
-- con el código académico (MT_ALUMNO.CODCLI), no con este @codcli.
-- Si esa segunda llamada falla, los pagarés y los beneficios quedan. Se reintenta solo la ficha.

IF TYPE_ID(N'dbo.mol_plan_beneficio') IS NULL
    EXEC(N'
        CREATE TYPE dbo.mol_plan_beneficio AS TABLE (
            codben     decimal(18, 0) NOT NULL,
            porc_sol   decimal(18, 4) NULL,
            porc_apr   decimal(18, 4) NULL,
            monto_sol  decimal(18, 2) NULL,
            monto_apr  decimal(18, 2) NULL,
            monto      decimal(18, 2) NOT NULL,
            aplicable  decimal(18, 0) NOT NULL
        )
    ');
GO

CREATE OR ALTER PROCEDURE dbo.sp_mol_grabar_plan_pagos
    @codcli              varchar(20),
    @codcarr             varchar(20),
    @ano                 int,
    @periodo             int,
    @contrato            varchar(40),
    @caja                int,
    @usuario             varchar(8),
    @codapod             varchar(30),
    @monto_matricula     decimal(18, 2),
    @monto_arancel       decimal(18, 2),
    @cuotas              int,
    @fecha_inicio        date,
    @corrpag_matricula   decimal(20, 0),
    @corrpag_arancel     decimal(20, 0),
    @beneficios          dbo.mol_plan_beneficio READONLY,
    @num_operacion       decimal(20, 0) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @cuotas < 1 OR @cuotas > 12
        THROW 50001, 'Las cuotas deben ir de 1 a 12.', 1;
    IF @monto_matricula <= 0 OR @monto_arancel <= 0
        THROW 50002, 'Matrícula y arancel tienen que ser mayores que cero.', 1;
    IF @corrpag_matricula IS NULL OR @corrpag_arancel IS NULL
        THROW 50003, 'Faltan los CORRPAGNUM reservados.', 1;
    IF EXISTS (
        SELECT codben FROM @beneficios GROUP BY codben HAVING COUNT(*) > 1
    )
        THROW 50004, 'Hay un beneficio repetido en el plan.', 1;
    IF EXISTS (SELECT 1 FROM @beneficios WHERE monto <= 0 OR aplicable NOT IN (1, 2))
        THROW 50005, 'Cada beneficio necesita monto mayor que cero y aplicable 1 o 2.', 1;
    IF EXISTS (
        SELECT 1
        FROM @beneficios b
        INNER JOIN dbo.MT_POSBEN p
            ON p.CODBEN = b.codben
           AND p.ORDEN = 1
           AND p.CODCLI = @codcli
           AND p.CODCARR = @codcarr
           AND p.ANO = @ano
           AND p.PERIODO = CAST(@periodo AS varchar(2))
    )
        THROW 50006, 'Ya existe el beneficio en MT_POSBEN para este periodo.', 1;

    DECLARE @hoy date = CAST(GETDATE() AS date);
    DECLARE @ctadoc_matricula decimal(20, 0);
    DECLARE @ctadoc_arancel decimal(20, 0);
    DECLARE @orden int;
    DECLARE @item int;
    DECLARE @corrpag decimal(20, 0);
    DECLARE @monto decimal(18, 2);
    DECLARE @ctadocnum decimal(20, 0);
    DECLARE @i int;
    DECLARE @base decimal(18, 2);
    DECLARE @monto_cuota decimal(18, 2);
    DECLARE @folio decimal(20, 0);
    DECLARE @vence date;

    BEGIN TRY
        BEGIN TRAN;

        EXEC dbo.sp_parametro_transaccion_correlativo
            @tipo = 'CORRELATIVO',
            @salida = @num_operacion OUTPUT,
            @muestra = 'NO';

        EXEC dbo.sp_parametro_transaccion_correlativo
            @tipo = 'SECUENCIA',
            @salida = @ctadoc_matricula OUTPUT,
            @muestra = 'NO';

        EXEC dbo.sp_parametro_transaccion_correlativo
            @tipo = 'SECUENCIA',
            @salida = @ctadoc_arancel OUTPUT,
            @muestra = 'NO';

        INSERT INTO dbo.MT_DOCITEM (
            ITEM, CTADOC, CTADOCNUM, ANO, PERIODO, CODCLI, CODCARR, TIPOCARR,
            CANTIDAD, PRECIO, MONTO, FECCOM, USUARIO, ESTADO, CTATRANS, num_operacion, SEDE
        )
        VALUES
            (1, 41, @ctadoc_matricula, @ano, @periodo, @codcli, @codcarr, 1,
             1, @monto_matricula, @monto_matricula, @hoy, @usuario, 1, @ctadoc_matricula, @num_operacion, 'STGO'),
            (2, 41, @ctadoc_arancel, @ano, @periodo, @codcli, @codcarr, 1,
             1, @monto_arancel, @monto_arancel, @hoy, @usuario, 1, @ctadoc_arancel, @num_operacion, 'STGO');

        INSERT INTO dbo.MT_CTADOC (
            CTADOC, CTADOCNUM, ITEM, CUOTA, NUMCUOT, CODCLI, CODAPOD, CODCARR,
            MONTO, SALDO, SALDO_AD, ESTADO, RECIBIDO, FACTURABLE, CONTRATO, CAJA,
            CTATRANS, FECVEN, FECDEUDA, FECREP, FECCANCEL, UBICACION, TIPOCARR,
            ANO, PERIODO, GASTOSOP, USUARIO, CODBAN, NUM_OPERACION
        )
        VALUES
            (41, @ctadoc_matricula, 1, 1, 1, @codcli, @codapod, @codcarr,
             @monto_matricula, 0, 0, 1, 'S', 'S', @contrato, @caja,
             @ctadoc_matricula, @hoy, @hoy, @hoy, @hoy, 1, 1,
             @ano, @periodo, 0, @usuario, 0, @num_operacion),
            (41, @ctadoc_arancel, 2, 1, 1, @codcli, @codapod, @codcarr,
             @monto_arancel, 0, 0, 1, 'S', 'S', @contrato, @caja,
             @ctadoc_arancel, @hoy, @hoy, @hoy, @hoy, 1, 1,
             @ano, @periodo, 0, @usuario, 0, @num_operacion);

        DECLARE @docs TABLE (
            orden int NOT NULL,
            item int NOT NULL,
            corrpag decimal(20, 0) NOT NULL,
            monto decimal(18, 2) NOT NULL,
            ctadocnum decimal(20, 0) NOT NULL
        );

        INSERT INTO @docs (orden, item, corrpag, monto, ctadocnum)
        VALUES
            (1, 1, @corrpag_matricula, @monto_matricula, @ctadoc_matricula),
            (2, 2, @corrpag_arancel, @monto_arancel, @ctadoc_arancel);

        DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
            SELECT orden, item, corrpag, monto, ctadocnum
            FROM @docs
            ORDER BY orden;

        OPEN cur;
        FETCH NEXT FROM cur INTO @orden, @item, @corrpag, @monto, @ctadocnum;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            INSERT INTO dbo.MT_CTAPAG (
                CTAPAG, CTAPAGNUM, CODCLI, CODCARR, CODAPOD, MONTO, SALDO, SALDO_AD,
                ESTADO, RECIBIDO, CODBAN, TIPOCARR, ANO, PERIODO, CAJA, CTATRANS,
                FECVEN, FECCANCEL, FECREG, FECHA, USUARIO, NUM_OPERACION
            )
            VALUES (
                5, @corrpag, @codcli, @codcarr, @codapod, @monto, 0, 0,
                1, 'N', 0, 1, @ano, @periodo, @caja, @corrpag,
                @fecha_inicio, @hoy, @hoy, @hoy, @usuario, @num_operacion
            );

            SET @base = ROUND(@monto / @cuotas, 0);
            SET @i = 1;

            WHILE @i <= @cuotas
            BEGIN
                SET @monto_cuota = CASE
                    WHEN @i = @cuotas THEN @monto - (@base * (@cuotas - 1))
                    ELSE @base
                END;
                SET @vence = DATEADD(month, @i - 1, @fecha_inicio);
                SET @folio = CAST(
                    CAST(@corrpag AS varchar(20)) + RIGHT('0' + CAST(@i AS varchar(2)), 2)
                    AS decimal(20, 0)
                );

                INSERT INTO dbo.MT_CTADOC (
                    CTADOC, CTADOCNUM, CUOTA, NUMCUOT, CODCLI, CODAPOD, CODCARR,
                    MONTO, SALDO, SALDO_AD, ESTADO, RECIBIDO, CONTRATO, CAJA,
                    CTATRANS, FECVEN, VCTOORI, FECDEUDA, FECREP, UBICACION, TIPOCARR,
                    ANO, PERIODO, GASTOSOP, USUARIO, CODBAN, NUM_OPERACION
                )
                VALUES (
                    14, @folio, @i, @cuotas, @codcli, @codapod, @codcarr,
                    @monto_cuota, @monto_cuota, 0, 2, 'S', @contrato, @caja,
                    @corrpag, @vence, @vence, @hoy, @hoy, 1, 1,
                    @ano, @periodo, 0, @usuario, 0, @num_operacion
                );

                SET @i = @i + 1;
            END

            INSERT INTO dbo.MT_CTADEP (
                CTADOC, CTADOCNUM, CTAPAG, CTAPAGNUM, CODCLI, CODCARR, CODAPOD,
                MONTO, TIPOCARR, USUARIO, CODBAN, ESTADO, CTATRANS, NUM_OPERACION,
                CAJA, FECREG_DEP, ANO
            )
            VALUES (
                41, @ctadocnum, 5, @corrpag, @codcli, @codcarr, @codapod,
                @monto, 1, @usuario, 0, '1', @ctadocnum, @num_operacion,
                @caja, @hoy, @ano
            );

            FETCH NEXT FROM cur INTO @orden, @item, @corrpag, @monto, @ctadocnum;
        END

        CLOSE cur;
        DEALLOCATE cur;

        INSERT INTO dbo.MT_POSBEN (
            CODBEN, ORDEN, CODCLI, CODCARR, ANO, PERIODO,
            PORC_SOL, PORC_APR, MONTO_SOL, MONTO_APR, MONTO,
            APROBADO, APLICABLE, USUARIO, FECAPROB,
            ESTADO, FECASIG, num_operacion
        )
        SELECT
            b.codben,
            1,
            @codcli,
            @codcarr,
            @ano,
            CAST(@periodo AS varchar(2)),
            b.porc_sol,
            b.porc_apr,
            b.monto_sol,
            b.monto_apr,
            b.monto,
            'S',
            b.aplicable,
            @usuario,
            CAST(@hoy AS datetime),
            4,
            CAST(@hoy AS datetime),
            @num_operacion
        FROM @beneficios b;

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF CURSOR_STATUS('local', 'cur') >= 0
        BEGIN
            CLOSE cur;
            DEALLOCATE cur;
        END

        IF XACT_STATE() <> 0
            ROLLBACK TRAN;

        THROW;
    END CATCH
END
