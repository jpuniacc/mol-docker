import { describe, expect, it } from 'vitest'
import {
  CUERPO_CONEXION,
  CUERPO_PAGO_ASIENTO,
  TITULO_CONEXION,
  TITULO_ENLACE_FIRMA,
  TITULO_FIRMA,
  TITULO_INGRESO_CREDENCIAL,
  TITULO_PAGO_ASIENTO,
  campoLoginVacio,
  clasificarErrorRematricula,
  clasificarFalloIngreso,
  cuerpoDescargaFirma,
} from './errorRematriculaCatalogo'

describe('clasificarErrorRematricula', () => {
  it('abre pago cuando Webpay ya está autorizada y no muestra el código', () => {
    const r = clasificarErrorRematricula('ya-autorizada')
    expect(r.escena).toBe('pago')
    expect(r.titulo).toBe(TITULO_PAGO_ASIENTO)
    expect(r.cuerpo).toBe(CUERPO_PAGO_ASIENTO)
    expect(r.cuerpo).not.toContain('ya-autorizada')
  })

  it('el 409 de enlace pendiente abre el modal de firma sin mostrar el código', () => {
    const r = clasificarErrorRematricula('Ese firmante no tiene un enlace de firma pendiente')
    expect(r.escena).toBe('firma')
    expect(r.titulo).toBe(TITULO_ENLACE_FIRMA)
    expect(r.cuerpo).toContain('enlace de firma pendiente')
    expect(r.cuerpo).not.toContain('409')
  })

  it('abre firma cuando falla el envío del contrato', () => {
    const r = clasificarErrorRematricula('No se pudo enviar el contrato a TuFirma')
    expect(r.escena).toBe('firma')
    expect(r.titulo).toBe(TITULO_FIRMA)
  })

  it('la descarga HTTP 400 nombra la operación y oculta el código', () => {
    const r = clasificarErrorRematricula('HTTP 400', { numOperacion: '981372' })
    expect(r.escena).toBe('firma')
    expect(r.cuerpo).toBe(cuerpoDescargaFirma('981372'))
    expect(r.cuerpo).not.toContain('HTTP')
    expect(r.titulo).not.toContain('400')
  })

  it('un código desconocido cae en conexión sin exponerlo', () => {
    const r = clasificarErrorRematricula('XYZ-9')
    expect(r.escena).toBe('conexion')
    expect(r.titulo).toBe(TITULO_CONEXION)
    expect(r.cuerpo).toBe(CUERPO_CONEXION)
    expect(r.cuerpo).toContain('Portal de Solicitudes')
    expect(r.cuerpo).not.toContain('XYZ-9')
  })

  it('una credencial rechazada usa la puerta', () => {
    const r = clasificarFalloIngreso('Usuario o contraseña incorrectos')
    expect(r.titulo).toBe(TITULO_INGRESO_CREDENCIAL)
    expect(r.cuerpo).toContain('Portal de Solicitudes')
  })

  it('un dato faltante también ofrece el Portal de Solicitudes', () => {
    const r = clasificarErrorRematricula('Selecciona un medio de pago')
    expect(r.escena).toBe('datos')
    expect(r.cuerpo).toContain('Selecciona un medio de pago')
    expect(r.cuerpo).toContain('Portal de Solicitudes')
  })

  it('usuario vacío no abre modal', () => {
    expect(campoLoginVacio('', 'secreto')).toBe('login-username')
    expect(campoLoginVacio('ana', '')).toBe('login-password')
    expect(campoLoginVacio('ana', 'secreto')).toBeNull()
  })
})
