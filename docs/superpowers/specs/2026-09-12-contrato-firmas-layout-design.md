# Layout de firmas del contrato (formato Bettersoft)

Fecha: 2026-09-12  
Proyecto: `mol-docker` + `uniacc-api-docker`  
Estado: implementado (pendiente calibrar `y` de recuadros en operación nueva)  
Referencia visual: `docs/contrato/NUEVO CONTRATO ENVIADO POR BETTERSOFT 2 (1).pdf` (9 páginas)  
Complementa: `docs/superpowers/specs/2026-09-11-tufirma-contrato-design.md`

## Problema

El PDF de rematrícula estampa TuFirma en una página extra «Firmas electrónicas», debajo de las etiquetas. El formato Bettersoft pone las tres líneas al cierre del vigésimo primero y el anexo en la hoja siguiente, sin rúbrica. El representante legal no está definido: no debe ir Aliste ni el ejemplo Salazar.

## Decisiones

| Tema | Decisión |
|------|----------|
| Plantilla | Estructura Bettersoft. Generación sigue en pdfmake (no clon Crystal / RPT) |
| Representante legal | Vacío por ahora. Ni Aliste ni Salazar en preámbulo ni en el bloque de firmas |
| Preámbulo | UNIACC como parte, **sin** «por {nombre}, cédula {rut}» |
| Bloque firmas | Tres columnas tras el vigésimo primero: alumno \| `pp. Universidad de Artes, Ciencias y Comunicación - UNIACC` \| sostenedor |
| Nombres impresos | Alumno y sostenedor bajo su etiqueta. El centro **sin** nombre de persona |
| Estampa TuFirma | Sobre la línea, **arriba** de «Estudiante o Alumno» / «Sostenedor Financiero». El centro no se estampa |
| Misma persona sostenedora | Un firmante (alumno), **dos** `fields` con el mismo `filler`. Un correo, dos recuadros |
| Apoderado distinto | Dos firmantes, un recuadro cada uno (izq. alumno, der. apoderado) |
| UNIACC / Aliste | No firma en TuFirma |
| Página extra «Firmas electrónicas» | Se elimina |
| Anexo N° 1 | `pageBreak` antes. Hoja propia, **sin** firmas |
| Página de recuadros | Hoja propia e indivisible antes del anexo (`pageBreak` + `unbreakable`). `signaturePage = n - 1` |
| Documentos ya en TuFirma | Fuera de este alcance (p. ej. `960258`). Se prueban con operación nueva |

## Layout (como págs. 8–9 Bettersoft)

```text
[VIGÉSIMO PRIMERO: Declaración. …]

  _______________     _______________     _______________
  [estampa]           (sin estampa)       [estampa]
  Estudiante          pp. UNIACC          Sostenedor
  {nombre alumno}                         {nombre sostenedor}

— salto de página —

ANEXO N° 1
REQUERIMIENTOS TÉCNICOS CAMPUS VIRTUAL UNIACC
(sin líneas de firma)
```

Coordenadas TuFirma (fracción de página, calibrar en un PDF de prueba):

- Alumno: izquierda, ~`x=0.06`, `w=0.28`, `h≈0.10`, `y` sobre la línea (no `0.28` de la página extra)
- Sostenedor: derecha, ~`x=0.66`, misma `y`/`w`/`h`
- Centro: sin `field`

## Payload TuFirma (cambio)

`firmantes[]` sigue siendo personas distintas (1 o 2).  
`fields[]` **siempre 2** `signature` (alumno + sostenedor). Si no hay apoderado, ambos `filler` = email del alumno.

No enviar un segundo firmante con el mismo email.

`ready`: firmaron todos los de `firmantes[]` (uno si es la misma persona; dos si hay apoderado).

## PDF

- Quitar el `content.push` de la página «Firmas electrónicas».
- Tras las cláusulas: bloque de tres columnas (centro solo texto institucional).
- Anexo con `pageBreak: 'before'`.
- Preámbulo: texto sin placeholders de RL, o placeholders vacíos omitidos (no «—» como si fuera persona).
- Validadores HTTP: `representante.nombre` / `representante.rut` dejan de ser obligatorios (pueden ir vacíos).

## Pruebas

- Unit: `incluirApoderado=false` → 1 firmante, 2 fields, mismo filler; `true` → 2 firmantes, fillers distintos.
- Unit/PDF: no existe «Firmas electrónicas»; anexo en página posterior; preámbulo sin Aliste/Salazar.
- Staging: operación **nueva**. Alumno=sostenedor: un mail, ambos recuadros llenos sobre las líneas. Apoderado distinto: dos mails. Anexo sin estampa.

## Fuera de alcance

Rehacer documentos TuFirma ya creados; Crystal/RPT; pixel-perfect vs Bettersoft; cargar RL real; pedir firma a UNIACC.
