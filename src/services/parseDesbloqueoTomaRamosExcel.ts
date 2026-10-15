import * as XLSX from 'xlsx'

export type FilaExcelDesbloqueo = {
  rut: string
  dv: string
  codcli: string
}

function clave(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function celda(raw: unknown): string {
  if (raw == null) return ''
  return String(raw).trim()
}

export function filasDesdeMatriz(matriz: unknown[][]): {
  filas: FilaExcelDesbloqueo[]
  error: string | null
} {
  if (matriz.length < 2) return { filas: [], error: 'El archivo no trae filas.' }
  const headers = (matriz[0] ?? []).map(clave)
  const iRut = headers.findIndex((h) => h === 'RUT')
  const iDv = headers.findIndex((h) => h === 'DV' || h === 'DIG')
  const iCod = headers.findIndex((h) => h === 'CODCLI')
  if (iRut < 0 || iDv < 0 || iCod < 0) {
    return { filas: [], error: 'El Excel debe tener columnas RUT, DV y CODCLI.' }
  }
  const filas: FilaExcelDesbloqueo[] = []
  for (const row of matriz.slice(1)) {
    const rut = celda(row?.[iRut])
    const dv = celda(row?.[iDv])
    const codcli = celda(row?.[iCod])
    if (!rut && !dv && !codcli) continue
    filas.push({ rut, dv, codcli })
  }
  if (filas.length === 0) return { filas: [], error: 'El archivo no trae filas.' }
  return { filas, error: null }
}

export const COLUMNAS_PLANTILLA_DESBLOQUEO = ['RUT', 'DV', 'CODCLI'] as const

export function libroPlantillaDesbloqueo(): XLSX.WorkBook {
  const hoja = XLSX.utils.aoa_to_sheet([[...COLUMNAS_PLANTILLA_DESBLOQUEO]])
  hoja['!cols'] = [{ wch: 16 }, { wch: 8 }, { wch: 22 }]
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, 'Desbloqueo')
  return libro
}

export function descargarPlantillaDesbloqueo(): void {
  XLSX.writeFile(libroPlantillaDesbloqueo(), 'desbloqueo-alumno-deuda.xlsx')
}

export function filasDesdeExcel(buffer: ArrayBuffer): {
  filas: FilaExcelDesbloqueo[]
  error: string | null
} {
  const libro = XLSX.read(buffer, { type: 'array' })
  const hoja = libro.Sheets[libro.SheetNames[0] ?? '']
  if (!hoja) return { filas: [], error: 'El archivo no tiene hojas.' }
  const matriz = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: '' }) as unknown[][]
  return filasDesdeMatriz(matriz)
}
