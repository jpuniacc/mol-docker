-- SP_ACTUALIZA_DATOS_MOL
-- Actualiza FONOACT y MAIL en MT_CLIENT (contacto validado en MOL tras OTP).
-- Presente en TEST_UNIACC; desplegado en UNIACC (prod) 2026-10-29.
-- Ejecutar como SA / dbo. Luego: GRANT EXECUTE ON dbo.SP_ACTUALIZA_DATOS_MOL TO nimbi;

CREATE OR ALTER PROCEDURE dbo.SP_ACTUALIZA_DATOS_MOL
    @CODCLI VARCHAR(20),
    @FONOACT VARCHAR(50),
    @MAIL VARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.MT_CLIENT
        WHERE CODCLI = @CODCLI
    )
    BEGIN
        SELECT
            0 AS RESULTADO,
            'Estudiante no encontrado' AS MENSAJE;
        RETURN;
    END;

    UPDATE dbo.MT_CLIENT
    SET
        FONOACT = @FONOACT,
        MAIL = @MAIL
    WHERE CODCLI = @CODCLI;

    SELECT
        1 AS RESULTADO,
        'Datos actualizados correctamente' AS MENSAJE;
END
GO

GRANT EXECUTE ON dbo.SP_ACTUALIZA_DATOS_MOL TO nimbi;
GO
