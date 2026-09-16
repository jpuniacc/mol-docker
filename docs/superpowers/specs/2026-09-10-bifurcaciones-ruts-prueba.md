# Bifurcaciones 2027-01: orden de gates y RUTs de prueba

Periodo: **2027-01**  
Mock: [mol-dev.uniacc.cl](https://mol-dev.uniacc.cl)  
Recorrer primero Datos personales (TyC, OTP, apoderado, discapacidad). Este mapa empieza en **Forma de pago**.

## Orden de preguntas

```text
¿Tiene convenio con certificado (89 / 749 / 1552 / 1565)?
    sí ──► pedir PDF → consejero aprueba
    no / PDF aprobado
            │
¿Tiene CAE?
    sí ──► verificación CAE (continua o en espera)
    no / CAE continua
            │
¿Tiene beca ministerial?
    sí ──► standby MINEDUC (no paga ni firma)
    no ──► plan / internas → deuda / caja / pagaré / firma
```

La beca interna (`MOL_DVU`) no bloquea: se muestra y se aplica.

## Las 11 combinaciones reales

| ID | Convenio PDF | Interna | Estatal | CAE | Qué debe pasar | RUT | Alumno |
|---|---|---|---|---|---|---|---|
| F1 | no | no | no | no | Plan vacío → pago | `10297484-0` | Rafael Fernando Olaechea Álvarez |
| F2 | no | no | no | sí | Verificación CAE → pago o espera | `10134456-8` | Verónica Isabel Cabello Galleguillos |
| F3 | no | no | sí | no | Directo a espera MINEDUC | `10115341-K` | Ivonne Roxana Jofré Cabezas |
| F4 | no | no | sí | sí | CAE y luego espera MINEDUC | `12658450-4` | Alejandra Ester Troncoso Cabrera |
| F5 | no | sí | no | no | Muestra internas → pago | `10230649-K` | Manuel Antonio González Aravena |
| F6 | no | sí | no | sí | CAE y luego internas → pago | `10030344-2` | Percy Yan Lam Pastén |
| F7 | no | sí | sí | no | Directo a espera MINEDUC | `16547602-6` | Johnny Alexis Moraga Ramírez |
| F8 | no | sí | sí | sí | CAE y luego espera MINEDUC | `17733362-K` | Charlotte Yessenia Bravo Estay |
| F9 | sí | no | no | no | Pide PDF; al aprobar → pago | `10929421-7` | Miriam Luz Méndez Muñoz |
| F10 | sí | no | no | sí | Pide PDF; al aprobar → CAE | `10159314-2` | Berta de Lourdes Aguilera Cavagnola |
| F11 | sí | no | sí | no | Pide PDF; al aprobar → MINEDUC | `20508412-6` | Javiera Fernanda Marchant González |

No hay alumnos con certificado + beca interna, ni con CAE + estatal + certificado.

## Cómo probar cada uno

1. Mock matrícula → buscar el RUT → Probar flujo.
2. Completar Datos personales (OTP mock `123456`).
3. En Forma de pago, confirmar la secuencia de la tabla.

Bandeja del consejero: Rematrícula → **Casos rematrícula** (junto a Firma contrato y Matriculados).

Default: **En revisión**. Tabs: Todos / Certificado / CAE / Ministerial / Apoderado / TyC no aceptados.

- PDF subido → caso `CONVENIO_CERTIFICADO` (aprobar / rechazar).
- CAE en espera → caso `CAE_RESOLUCION` (solo listar).
- Beca ministerial → caso `ESTATAL_MINEDUC` (solo listar).
- Apoderado desactualizado → caso `APODERADO_DATOS` (solo listar).
- No acepta TyC → caso `TYC_RECHAZO` (solo listar). Si el mismo alumno vuelve y acepta, el caso pasa a `CERRADO` y sale de “En revisión”.
- Si ya aceptó (`log_mol_tyc_respuesta`), al reentrar no se vuelve a pedir TyC: se retoma en contacto.

## Códigos de certificado

| Código | Convenio | Tipo de PDF |
|---|---|---|
| 89 | Sindicato BancoEstado | Antigüedad laboral |
| 749 | Carabineros | Antigüedad laboral |
| 1552 | Caja Los Andes | Afiliación |
| 1565 | Caja La Araucana | Afiliación |
