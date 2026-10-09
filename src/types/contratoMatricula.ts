/** View-model del contrato de prestación de servicios (MOL mock v1). */

export type ContratoDescuentoLinea = {
  concepto: 'matricula' | 'arancel'
  /** Correlativo del documento de pago. */
  documento: string
  tipoDocumento: string
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
  /** Header del pagaré (CORRPAGNUM), distinto del folio de cada cuota. */
  ctapagnum?: string
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

/** Pago Webpay de un concepto, para el recuadro de aranceles del contrato. */
export type PagoWebpayContrato = {
  fecha: string | null
  hora: string | null
  autorizacion: string | null
  forma: 'debito' | 'credito' | null
  ultimos4: string | null
  cuotas: number | null
  monto: number
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
  pagoWebpayMatricula?: PagoWebpayContrato | null
  pagoWebpayArancel?: PagoWebpayContrato | null
  representante: {
    nombre: string
    rut: string
  }
  /** Representante legal no definido en v1; nombre/rut van vacíos. */
  asignaturasNuevo: boolean
}
