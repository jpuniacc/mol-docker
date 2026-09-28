/** View-model del contrato de prestación de servicios (MOL mock v1). */

export type ContratoDescuentoLinea = {
  concepto: 'matricula' | 'arancel'
  descripcion: string
  detalle: string
  monto: number
  vencimiento: string
}

export type ContratoCuotaLinea = {
  documento: string
  tipoDocumento: string
  valor: number
  fechaVencimiento: string
  cuota?: number
  totalCuotas?: number
  item?: 1 | 2
}

export type ContratoPersonaBloque = {
  nombre: string
  rut: string
  domicilio: string
  comuna: string
  ciudad: string
  nacionalidad: string
  estadoCivil: string
  profesion: string
  /** «domiciliado» / «domiciliada» */
  domiciliadoLabel: string
}

export type ContratoMatriculaViewModel = {
  numOperacion: string
  contrato: string
  fechaContratoLabel: string
  ciudadFirma: string
  periodoAcademico: string
  alumno: ContratoPersonaBloque & {
    carrera: string
    jornada: string
  }
  sostenedor: ContratoPersonaBloque
  emailAlumno: string
  emailApoderado: string | null
  valorMatricula: number
  valorArancel: number
  descuentos: ContratoDescuentoLinea[]
  cuotas: ContratoCuotaLinea[]
  representante: {
    nombre: string
    rut: string
  }
  /** Representante legal no definido en v1; nombre/rut van vacíos. */
  asignaturasNuevo: boolean
}
