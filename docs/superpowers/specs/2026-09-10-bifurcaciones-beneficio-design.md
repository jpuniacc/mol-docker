# Bifurcaciones de rematrícula por perfil de beneficio

Fecha: 2026-09-10  
Proyecto: `mol-docker`  
Estado: implementado (pendiente commit / rebuild)

## Problema

El mock no trata el perfil del alumno (CAE × estatal × interna × convenio) como bifurcaciones de un mismo flujo. Hay que mapear las combinaciones reales de 2027-01 y hacer que la estatal **bloquee** rematrícula en MOL hasta MINEDUC.

## Decisiones

| Tema | Decisión |
|------|----------|
| Ejes | Convenio certificado × beca interna (`MOL_DVU`) × beca estatal × CAE |
| Teóricas / reales | 16 / 11 en `v_mnp_mv_plan_pagos` 2027-01 |
| Tramo común | TyC, OTP, apoderado, discapacidad, deuda, caja, pagaré: no se multiplican |
| Estatal | Bloquea: no pago, no firma, no resumen |
| CAE | Sigue el gate existente (verificación → continua o standby) |
| Interna | No bloquea; se muestra y se aplica |
| Certificado | Gate existente (PDF + consejero) |
| Orden de gates | Convenio PDF → CAE → beca ministerial |
| Estatal + CAE/cert | Primero PDF (si aplica), luego CAE, al final standby MINEDUC |
| Celdas vacías | No hay UI inventada (cert+interna, o CAE+estatal+cert) |

## Orden de gates (forma de pago)

```text
Datos personales
        │
   ¿convenio con requiere_certificado?
        sí ──► PDF + EN_REVISION hasta aprobación
        no / aprobado
        │
   ¿CAE?
        sí ──► verificación CAE
                 pendiente ──► standby CAE_RESOLUCION
                 continua ──► sigue
        no
        │
   ¿beca estatal en plan ∩ catálogo?
        sí ──► standby MINEDUC + caso ESTATAL_MINEDUC
        │        (no avanza a pago/firma/resumen)
        no
        │
   Lista internas MOL_DVU (o vacía) → deuda / caja / pagaré / firma
```

## Las 11 bifurcaciones reales

| ID | Perfil | Alumnos | Qué hace MOL | RUT de prueba |
|---|---|---|---|---|
| F1 | limpio | 514 | Sin CAE, sin certificado → pago | `10297484-0` |
| F2 | solo CAE | 289 | Verificación CAE → pago o standby | `10134456-8` |
| F3 | solo estatal | 32 | Standby MINEDUC | `10115341-K` |
| F4 | estatal + CAE | 49 | CAE y luego standby MINEDUC | `12658450-4` |
| F5 | solo interna | 2626 | Muestra MOL_DVU → pago | `10230649-K` |
| F6 | interna + CAE | 1009 | CAE y luego internas → pago | `10030344-2` |
| F7 | interna + estatal | 205 | Standby MINEDUC | `16547602-6` |
| F8 | interna + estatal + CAE | 189 | CAE y luego standby MINEDUC | `17733362-K` |
| F9 | solo certificado | 81 | Gate PDF + consejero | `10929421-7` |
| F10 | certificado + CAE | 45 | PDF y luego CAE | `10159314-2` |
| F11 | certificado + estatal | 2 | PDF y luego standby MINEDUC | `20508412-6` |

F3, F4, F7, F8 y F11 colapsan al mismo subflujo de bloqueo estatal.

Celdas teóricas sin alumnos (no implementar):

- certificado + interna (± CAE ± estatal)
- CAE + estatal + certificado

## Caso de bandeja

Tipo nuevo `ESTATAL_MINEDUC`: se abre al detectar estatal; solo listar (no se resuelve en MOL).  
`ref_tipo`: `log_evento`. Payload: códigos estatales del plan.

## UI

- Standby estatal: mismo patrón visual que CAE en espera.
- Lista de beneficios: etiqueta `Interna`, `Estatal`, `No renovable` (u otra del catálogo).
- Guard de router: con bloqueo estatal no se entra a firma/resumen.

## Fuera de alcance

- Resolver estatal o CAE desde la bandeja
- Producto cartesiano con apoderado / deuda / OTP
- Webpay / Toku reales
- Las 5 celdas vacías

## Criterios de éxito

1. F1 llega a pago sin CAE, sin certificado y sin standby estatal.
2. F3/F7 van directo a standby MINEDUC. F4/F8 hacen CAE y luego MINEDUC. F11 pide PDF y luego MINEDUC. Ninguno firma.
3. F2/F6 siguen el gate CAE existente.
4. F9/F10 piden certificado primero (F10 sigue a CAE cuando el PDF está aprobado).
5. F5 muestra internas y no bloquea.
6. Recargar no pierde el bloqueo estatal.
7. En bandeja aparece el caso `ESTATAL_MINEDUC` sin duplicar al recargar.
