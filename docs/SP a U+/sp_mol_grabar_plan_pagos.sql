-- U+ Test. Graba dos pagarés (matrícula y arancel) cuando el contrato ya está firmado.
-- Los CORRPAGNUM entran reservados. Este SP pide el número de operación y las dos boletas.
-- Inserta MT_POSBEN (estado 4) por cada beneficio que llega en @beneficios.
-- El cargo (DOCITEM y boleta 41) es el bruto: pagaré más beneficios de ese concepto.
-- Cada beneficio además es un pago (MT_CTAPAG con la forma de pago del beneficio
-- y MT_CTADEP contra esa boleta). El pagaré tipo 5 queda por el saldo.
-- La jornada de pagos, depósitos, boleta y cargo es la de MT_ALUMNO para esa carrera.
-- Boleta, cuotas, pagarés y depósitos usan el apoderado de MT_CLIENT.
-- Si no hay otro, queda el alumno. @codapod se conserva y no se escribe.
-- FECHA y SEDE de la boleta y de las cuotas, y MONTOINT / DEVENGO_SEM del cargo,
-- quedan como en la matrícula de producción. FECREG de la boleta y de las cuotas
-- es la fecha de la caja abierta: la clave foránea pide esa pareja en MT_PARCAJA.
-- POSBEN guarda 0 en interés y porcentaje parcial.
-- Una tabla vacía no inserta beneficios. @codcli es el RUT sin dígito verificador.
-- Después del COMMIT, MOL llama aparte a SP_MOL_ACTUALIZA_MATRICULA_FIRMADA
-- con el código académico (MT_ALUMNO.CODCLI), no con este @codcli.
-- Si esa segunda llamada falla, los pagarés y los beneficios quedan. Se reintenta solo la ficha.
-- @documentos_webpay es un JSON array (DocumentoCuenta) con los documentos de la tarjeta Webpay.
-- Se recorre con OPENJSON dentro de la misma transacción, antes del COMMIT.
-- La base está en nivel de compatibilidad 100: OPENJSON se evalúa vía master.sys.sp_executesql.
-- Folio null (tipo 20, el 5 %) pide CORRPAGNUM. Un folio presente es el de la tarjeta.
-- MT_CTADEP solo si aplicaBoleta es true, contra la boleta 41 del concepto.
-- Un concepto que llega en el JSON no genera pagaré tipo 5 ni cuotas 14.
-- Sin POSBEN para el tipo 20. Sin JSON (NULL) el procedimiento se comporta como antes.

DROP PROCEDURE IF EXISTS dbo.sp_mol_grabar_plan_pagos;
GO
DROP TYPE IF EXISTS dbo.mol_plan_beneficio;
GO
CREATE TYPE dbo.mol_plan_beneficio AS TABLE (
    codben     decimal(18, 0) NOT NULL,
    porc_sol   decimal(18, 4) NULL,
    porc_apr   decimal(18, 4) NULL,
    monto_sol  decimal(18, 2) NULL,
    monto_apr  decimal(18, 2) NULL,
    monto      decimal(18, 2) NOT NULL,
    aplicable  decimal(18, 0) NOT NULL,
    concepto   char(1)        NOT NULL,
    corrpag    decimal(20, 0) NOT NULL
);
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
    @documentos_webpay   nvarchar(max) = NULL,
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
    IF EXISTS (SELECT 1 FROM @beneficios WHERE concepto NOT IN ('M', 'A') OR corrpag IS NULL)
        THROW 50007, 'Cada beneficio necesita concepto M o A y su folio.', 1;
    IF EXISTS (SELECT corrpag FROM @beneficios GROUP BY corrpag HAVING COUNT(*) > 1)
        THROW 50008, 'Hay un folio de beneficio repetido.', 1;
    IF EXISTS (
        SELECT 1 FROM @beneficios
        WHERE corrpag IN (@corrpag_matricula, @corrpag_arancel)
    )
        THROW 50009, 'El folio del beneficio no puede ser el del pagaré.', 1;
    IF EXISTS (
        SELECT 1
        FROM @beneficios b
        LEFT JOIN dbo.MT_BENEFICIO ben ON ben.CODBEN = b.codben
        WHERE ben.FPAGOGENERADA IS NULL
    )
        THROW 50010, 'El beneficio no tiene forma de pago.', 1;

    DECLARE @jornada varchar(10);
    SELECT TOP 1 @jornada = NULLIF(LTRIM(RTRIM(JORNADA)), '')
    FROM dbo.MT_ALUMNO
    WHERE RUT = @codcli
      AND CODCLI LIKE '%' + @codcarr + '%'
      AND NULLIF(LTRIM(RTRIM(JORNADA)), '') IS NOT NULL;
    IF @jornada IS NULL
        THROW 50011, 'La carrera del alumno no tiene jornada.', 1;

    DECLARE @codapod_boleta varchar(30);
    SELECT @codapod_boleta = NULLIF(LTRIM(RTRIM(CODAPOD)), '')
    FROM dbo.MT_CLIENT
    WHERE CODCLI = @codcli;
    IF @codapod_boleta IS NULL OR @codapod_boleta = @codcli
        SET @codapod_boleta = @codcli;

    DECLARE @fecreg_caja date;
    SELECT TOP 1 @fecreg_caja = CAST(FECHA AS date)
    FROM dbo.MT_PARCAJA
    WHERE CAJA = @caja AND ABIERTA = 'S'
    ORDER BY FECHA DESC;
    IF @fecreg_caja IS NULL
        THROW 50012, 'La caja no está abierta.', 1;

    DECLARE @hoy date = CAST(GETDATE() AS date);
    DECLARE @bruto_matricula decimal(18, 2) = @monto_matricula
        + ISNULL((SELECT SUM(monto) FROM @beneficios WHERE concepto = 'M'), 0);
    DECLARE @bruto_arancel decimal(18, 2) = @monto_arancel
        + ISNULL((SELECT SUM(monto) FROM @beneficios WHERE concepto = 'A'), 0);
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

    CREATE TABLE #docs_web (
        orden       int IDENTITY(1, 1) NOT NULL,
        concepto    varchar(20)    NULL,
        ctapag      int            NULL,
        ctadoc      int            NULL,
        folio       varchar(30)    NULL,
        monto       decimal(18, 2) NOT NULL,
        fecha       date           NOT NULL,
        fecven      date           NOT NULL,
        cuota       int            NOT NULL,
        numcuot     int            NOT NULL,
        aplicaBoleta bit           NOT NULL
    );

    -- La base corre con nivel de compatibilidad 100 y OPENJSON pide 130.
    -- El lote se ejecuta en el contexto de master (nivel 130) y escribe en #docs_web.
    IF @documentos_webpay IS NOT NULL
        EXEC master.sys.sp_executesql
            N'INSERT INTO #docs_web (concepto, ctapag, ctadoc, folio, monto, fecha, fecven, cuota, numcuot, aplicaBoleta)
              SELECT concepto, ctapag, ctadoc, folio, monto, fecha, fecven, cuota, numcuot, ISNULL(aplicaBoleta, 0)
              FROM OPENJSON(@j)
              WITH (
                  concepto     varchar(20)    ''$.concepto'',
                  ctapag       int            ''$.ctapag'',
                  ctadoc       int            ''$.ctadoc'',
                  folio        varchar(30)    ''$.folio'',
                  monto        decimal(18, 2) ''$.monto'',
                  fecha        date           ''$.fecha'',
                  fecven       date           ''$.fecven'',
                  cuota        int            ''$.cuota'',
                  numcuot      int            ''$.numcuot'',
                  aplicaBoleta bit            ''$.aplicaBoleta''
              )',
            N'@j nvarchar(max)',
            @j = @documentos_webpay;

    DECLARE @web_matricula bit = CASE WHEN EXISTS (SELECT 1 FROM #docs_web WHERE concepto = 'matricula') THEN 1 ELSE 0 END;
    DECLARE @web_arancel bit = CASE WHEN EXISTS (SELECT 1 FROM #docs_web WHERE concepto = 'arancel') THEN 1 ELSE 0 END;
    DECLARE @web_orden int;
    DECLARE @concepto_json varchar(20);
    DECLARE @ctadoc_json int;
    DECLARE @cuota_json int;
    DECLARE @numcuot_json int;
    DECLARE @aplica_json bit;
    DECLARE @folio_json varchar(30);
    DECLARE @ctapag_json int;
    DECLARE @monto_json decimal(18, 2);
    DECLARE @fecha_json date;
    DECLARE @fecven_json date;
    DECLARE @ctapagnum decimal(20, 0);
    DECLARE @ctadocnum_web decimal(20, 0);
    DECLARE @ctadoc_boleta decimal(20, 0);

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
            CANTIDAD, PRECIO, MONTO, MONTOINT, FECCOM, USUARIO, ESTADO, CTATRANS,
            num_operacion, SEDE, DEVENGO_SEM, jornada
        )
        VALUES
            (1, 41, @ctadoc_matricula, @ano, @periodo, @codcli, @codcarr, 1,
             1, @bruto_matricula, @bruto_matricula, 0, @hoy, @usuario, 1, @ctadoc_matricula,
             @num_operacion, 'STGO', 'SI', @jornada),
            (2, 41, @ctadoc_arancel, @ano, @periodo, @codcli, @codcarr, 1,
             1, @bruto_arancel, @bruto_arancel, 0, @hoy, @usuario, 1, @ctadoc_arancel,
             @num_operacion, 'STGO', 'SI', @jornada);

        INSERT INTO dbo.MT_CTADOC (
            CTADOC, CTADOCNUM, ITEM, CUOTA, NUMCUOT, CODCLI, CODAPOD, CODCARR,
            MONTO, SALDO, SALDO_AD, ESTADO, RECIBIDO, FACTURABLE, CONTRATO, CAJA,
            CTATRANS, FECVEN, FECDEUDA, FECREP, FECCANCEL, UBICACION, TIPOCARR,
            ANO, PERIODO, GASTOSOP, USUARIO, CODBAN, NUM_OPERACION,
            FECREG, FECHA, SEDE, jornada
        )
        VALUES
            (41, @ctadoc_matricula, 1, 1, 1, @codcli, @codapod_boleta, @codcarr,
             @bruto_matricula, 0, 0, 1, 'S', 'S', @contrato, @caja,
             @ctadoc_matricula, @hoy, @hoy, @hoy, @hoy, 1, 1,
             @ano, @periodo, 0, @usuario, 0, @num_operacion,
             @fecreg_caja, @hoy, 'STGO', @jornada),
            (41, @ctadoc_arancel, 2, 1, 1, @codcli, @codapod_boleta, @codcarr,
             @bruto_arancel, 0, 0, 1, 'S', 'S', @contrato, @caja,
             @ctadoc_arancel, @hoy, @hoy, @hoy, @hoy, 1, 1,
             @ano, @periodo, 0, @usuario, 0, @num_operacion,
             @fecreg_caja, @hoy, 'STGO', @jornada);

        DECLARE @docs TABLE (
            orden int NOT NULL,
            item int NOT NULL,
            corrpag decimal(20, 0) NOT NULL,
            monto decimal(18, 2) NOT NULL,
            ctadocnum decimal(20, 0) NOT NULL
        );

        INSERT INTO @docs (orden, item, corrpag, monto, ctadocnum)
        SELECT orden, item, corrpag, monto, ctadocnum
        FROM (
            VALUES
                (1, 1, @corrpag_matricula, @monto_matricula, @ctadoc_matricula, @web_matricula),
                (2, 2, @corrpag_arancel, @monto_arancel, @ctadoc_arancel, @web_arancel)
        ) AS v (orden, item, corrpag, monto, ctadocnum, es_web)
        WHERE v.es_web = 0;

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
                FECVEN, FECCANCEL, FECREG, FECHA, USUARIO, NUM_OPERACION, jornada
            )
            VALUES (
                5, @corrpag, @codcli, @codcarr, @codapod_boleta, @monto, 0, 0,
                1, 'N', 0, 1, @ano, @periodo, @caja, @corrpag,
                @fecha_inicio, @hoy, @hoy, @hoy, @usuario, @num_operacion, @jornada
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
                    ANO, PERIODO, GASTOSOP, USUARIO, CODBAN, NUM_OPERACION,
                    FECREG, FECHA, SEDE, jornada
                )
                VALUES (
                    14, @folio, @i, @cuotas, @codcli, @codapod_boleta, @codcarr,
                    @monto_cuota, @monto_cuota, 0, 2, 'S', @contrato, @caja,
                    @corrpag, @vence, @vence, @hoy, @hoy, 1, 1,
                    @ano, @periodo, 0, @usuario, 0, @num_operacion,
                    @fecreg_caja, @hoy, 'STGO', @jornada
                );

                SET @i = @i + 1;
            END

            INSERT INTO dbo.MT_CTADEP (
                CTADOC, CTADOCNUM, CTAPAG, CTAPAGNUM, CODCLI, CODCARR, CODAPOD,
                MONTO, TIPOCARR, USUARIO, CODBAN, ESTADO, CTATRANS, NUM_OPERACION,
                CAJA, FECREG_DEP, ANO, jornada
            )
            VALUES (
                41, @ctadocnum, 5, @corrpag, @codcli, @codcarr, @codapod_boleta,
                @monto, 1, @usuario, 0, '1', @ctadocnum, @num_operacion,
                @caja, @hoy, @ano, @jornada
            );

            FETCH NEXT FROM cur INTO @orden, @item, @corrpag, @monto, @ctadocnum;
        END

        CLOSE cur;
        DEALLOCATE cur;

        INSERT INTO dbo.MT_POSBEN (
            CODBEN, ORDEN, CODCLI, CODCARR, ANO, PERIODO,
            PORC_SOL, PORC_APR, MONTO_SOL, MONTO_APR, MONTO,
            APROBADO, APLICABLE, USUARIO, FECAPROB,
            ESTADO, FECASIG, num_operacion,
            MONTOINT, PORCINT, PORC_PAR
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
            @num_operacion,
            0,
            0,
            0
        FROM @beneficios b;

        INSERT INTO dbo.MT_CTAPAG (
            CTAPAG, CTAPAGNUM, CODCLI, CODCARR, CODAPOD, MONTO, SALDO, SALDO_AD,
            ESTADO, RECIBIDO, CODBAN, TIPOCARR, ANO, PERIODO, CAJA, CTATRANS,
            FECVEN, FECCANCEL, FECREG, FECHA, USUARIO, NUM_OPERACION, jornada
        )
        SELECT
            ben.FPAGOGENERADA,
            b.corrpag,
            @codcli,
            @codcarr,
            @codapod_boleta,
            b.monto,
            0,
            0,
            1,
            'N',
            0,
            1,
            @ano,
            @periodo,
            @caja,
            b.corrpag,
            @hoy,
            @hoy,
            @hoy,
            @hoy,
            @usuario,
            @num_operacion,
            @jornada
        FROM @beneficios b
        INNER JOIN dbo.MT_BENEFICIO ben ON ben.CODBEN = b.codben;

        INSERT INTO dbo.MT_CTADEP (
            CTADOC, CTADOCNUM, CTAPAG, CTAPAGNUM, CODCLI, CODCARR, CODAPOD,
            MONTO, TIPOCARR, USUARIO, CODBAN, ESTADO, CTATRANS, NUM_OPERACION,
            CAJA, FECREG_DEP, ANO, jornada
        )
        SELECT
            41,
            CASE WHEN b.concepto = 'M' THEN @ctadoc_matricula ELSE @ctadoc_arancel END,
            ben.FPAGOGENERADA,
            b.corrpag,
            @codcli,
            @codcarr,
            @codapod_boleta,
            b.monto,
            1,
            @usuario,
            0,
            '1',
            CASE WHEN b.concepto = 'M' THEN @ctadoc_matricula ELSE @ctadoc_arancel END,
            @num_operacion,
            @caja,
            @hoy,
            @ano,
            @jornada
        FROM @beneficios b
        INNER JOIN dbo.MT_BENEFICIO ben ON ben.CODBEN = b.codben;

        DECLARE cur_web CURSOR LOCAL FAST_FORWARD FOR
            SELECT orden, concepto, ctapag, ctadoc, folio, monto, fecha, fecven, cuota, numcuot, aplicaBoleta
            FROM #docs_web
            ORDER BY orden;

        OPEN cur_web;
        FETCH NEXT FROM cur_web INTO
            @web_orden, @concepto_json, @ctapag_json, @ctadoc_json, @folio_json,
            @monto_json, @fecha_json, @fecven_json, @cuota_json, @numcuot_json, @aplica_json;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @ctadoc_boleta = CASE WHEN @concepto_json = 'matricula' THEN @ctadoc_matricula ELSE @ctadoc_arancel END;
            SET @ctapagnum = NULL;

            IF @folio_json IS NULL
                EXEC dbo.sp_parametro_transaccion_correlativo
                    @tipo = 'CORRPAGNUM',
                    @salida = @ctapagnum OUTPUT,
                    @muestra = 'NO';
            ELSE
                SET @ctapagnum = CAST(@folio_json AS decimal(20, 0));

            IF @ctapag_json IS NOT NULL
            BEGIN
                INSERT INTO dbo.MT_CTAPAG (
                    CTAPAG, CTAPAGNUM, CODCLI, CODCARR, CODAPOD, MONTO, SALDO, SALDO_AD,
                    ESTADO, RECIBIDO, CODBAN, TIPOCARR, ANO, PERIODO, CAJA, CTATRANS,
                    FECVEN, FECCANCEL, FECREG, FECHA, USUARIO, NUM_OPERACION, jornada
                )
                VALUES (
                    @ctapag_json, @ctapagnum, @codcli, @codcarr, @codapod_boleta, @monto_json, 0, 0,
                    1, 'N', 0, 1, @ano, @periodo, @caja, @ctapagnum,
                    @fecven_json, @hoy, @hoy, @fecha_json, @usuario, @num_operacion, @jornada
                );

                IF @aplica_json = 1
                    INSERT INTO dbo.MT_CTADEP (
                        CTADOC, CTADOCNUM, CTAPAG, CTAPAGNUM, CODCLI, CODCARR, CODAPOD,
                        MONTO, TIPOCARR, USUARIO, CODBAN, ESTADO, CTATRANS, NUM_OPERACION,
                        CAJA, FECREG_DEP, ANO, jornada
                    )
                    VALUES (
                        41, @ctadoc_boleta, @ctapag_json, @ctapagnum, @codcli, @codcarr, @codapod_boleta,
                        @monto_json, 1, @usuario, 0, '1', @ctadoc_boleta, @num_operacion,
                        @caja, @hoy, @ano, @jornada
                    );
            END

            IF @ctadoc_json IS NOT NULL
            BEGIN
                INSERT INTO dbo.MT_CTADOC (
                    CTADOC, CTADOCNUM, CUOTA, NUMCUOT, CODCLI, CODAPOD, CODCARR,
                    MONTO, SALDO, SALDO_AD, ESTADO, RECIBIDO, CONTRATO, CAJA,
                    CTATRANS, FECVEN, FECDEUDA, FECREP, UBICACION, TIPOCARR,
                    ANO, PERIODO, GASTOSOP, USUARIO, CODBAN, NUM_OPERACION,
                    FECREG, FECHA, SEDE, jornada
                )
                VALUES (
                    @ctadoc_json, @ctapagnum, @cuota_json, @numcuot_json, @codcli, @codapod_boleta, @codcarr,
                    @monto_json, 0, 0, 1, 'S', @contrato, @caja,
                    @ctapagnum, @fecven_json, @hoy, @hoy, 1, 1,
                    @ano, @periodo, 0, @usuario, 0, @num_operacion,
                    @fecreg_caja, @fecha_json, 'STGO', @jornada
                );
            END

            FETCH NEXT FROM cur_web INTO
                @web_orden, @concepto_json, @ctapag_json, @ctadoc_json, @folio_json,
                @monto_json, @fecha_json, @fecven_json, @cuota_json, @numcuot_json, @aplica_json;
        END

        CLOSE cur_web;
        DEALLOCATE cur_web;

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF CURSOR_STATUS('local', 'cur') >= 0
        BEGIN
            CLOSE cur;
            DEALLOCATE cur;
        END

        IF CURSOR_STATUS('local', 'cur_web') >= 0
        BEGIN
            CLOSE cur_web;
            DEALLOCATE cur_web;
        END

        IF XACT_STATE() <> 0
            ROLLBACK TRAN;

        THROW;
    END CATCH
END
