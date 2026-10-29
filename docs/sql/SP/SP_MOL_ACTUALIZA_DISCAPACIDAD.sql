-- SP_MOL_ACTUALIZA_DISCAPACIDAD
-- Actualiza MT_CLIENT.DISCAPACIDAD con un CODIGO de MT_DISCAPACIDAD.
-- Presente en TEST_UNIACC; desplegado en UNIACC (prod) 2026-10-29.
-- Ejecutar como SA / dbo. Luego: GRANT EXECUTE ON dbo.SP_MOL_ACTUALIZA_DISCAPACIDAD TO nimbi;

CREATE OR ALTER PROCEDURE dbo.SP_MOL_ACTUALIZA_DISCAPACIDAD
(
    @CODCLI        VARCHAR(20),
    @DISCAPACIDAD  VARCHAR(100)
)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY

        IF NOT EXISTS (
            SELECT 1
            FROM dbo.MT_CLIENT
            WHERE CODCLI = @CODCLI
        )
        BEGIN
            RAISERROR('El alumno no existe en MT_CLIENT.', 16, 1);
            RETURN;
        END;

        IF NOT EXISTS (
            SELECT 1
            FROM dbo.MT_DISCAPACIDAD
            WHERE CODIGO = @DISCAPACIDAD
        )
        BEGIN
            RAISERROR('La discapacidad ingresada no existe en MT_DISCAPACIDAD.', 16, 1);
            RETURN;
        END;

        UPDATE dbo.MT_CLIENT
        SET DISCAPACIDAD = @DISCAPACIDAD
        WHERE CODCLI = @CODCLI;

        SELECT
            @CODCLI AS CODCLI,
            @DISCAPACIDAD AS DISCAPACIDAD,
            'OK' AS RESULTADO;

    END TRY
    BEGIN CATCH

        SELECT
            ERROR_NUMBER() AS ERROR_NUMBER,
            ERROR_MESSAGE() AS ERROR_MESSAGE,
            'ERROR' AS RESULTADO;

    END CATCH
END
GO

GRANT EXECUTE ON dbo.SP_MOL_ACTUALIZA_DISCAPACIDAD TO nimbi;
GO
