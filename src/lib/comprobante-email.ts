// Envío de comprobantes de pago por correo — hoy sin backend.
//
// `enviarComprobante` es la ÚNICA función que sabe CÓMO se transporta el
// correo. Hoy abre el cliente de correo del propio usuario (mailto:), que no
// permite adjuntar archivos automáticamente por restricciones del navegador
// — por eso el PDF del comprobante se descarga aparte para adjuntarlo a mano.
//
// Cuando exista un backend (o se integre un servicio de envío tipo EmailJS/
// Resend/SendGrid), esta es la única función que debe cambiar — a una
// llamada real (fetch a una API propia, o al SDK del servicio elegido) que
// además adjunte el PDF en base64. La UI que la invoca (el modal de envío de
// comprobantes en nomina/page.tsx) no necesita cambiar: sigue construyendo el
// mismo objeto `EnvioComprobante` con asunto/cuerpo ya resueltos.

export interface EnvioComprobante {
  destinatarioEmail: string
  destinatarioNombre: string
  asunto: string
  cuerpo: string
}

// Devuelve true si la ventana/pestaña de correo se abrió. En un envío
// masivo, los navegadores suelen bloquear todos los window.open salvo el
// primero de un mismo gesto de usuario — por eso el llamador NO debe asumir
// éxito y debe revisar este valor antes de marcar el envío como completado.
export function enviarComprobante(envio: EnvioComprobante): boolean {
  const params = new URLSearchParams({ subject: envio.asunto, body: envio.cuerpo })
  const ventana = window.open(`mailto:${envio.destinatarioEmail}?${params.toString()}`, '_blank')
  return ventana !== null
}

// ── Plantilla editable ────────────────────────────────────────────────────────
export interface PlantillaComprobante {
  asunto: string
  cuerpo: string
}

export const PLACEHOLDERS_COMPROBANTE = [
  { token: '{nombre}',    label: 'Nombre del empleado' },
  { token: '{periodo}',   label: 'Período (ej. Julio 2026)' },
  { token: '{concepto}',  label: 'Concepto (ej. Nómina Mensual)' },
  { token: '{neto}',      label: 'Salario neto pagado' },
  { token: '{fechaPago}', label: 'Fecha de pago' },
  { token: '{empresa}',   label: 'Nombre de la empresa' },
] as const

export function plantillaComprobanteDefault(): PlantillaComprobante {
  return {
    asunto: 'Comprobante de pago — {concepto} {periodo}',
    cuerpo:
`Estimado/a {nombre},

Adjunto encontrarás tu comprobante de pago correspondiente a {concepto} del período {periodo}.

Salario neto pagado: {neto}
Fecha de pago: {fechaPago}

Este correo fue generado desde Cielo Cloud Nómina.

Saludos,
{empresa}`,
  }
}

export function resolverPlantilla(
  plantilla: PlantillaComprobante,
  valores: Record<string, string>
): { asunto: string; cuerpo: string } {
  function sustituir(texto: string): string {
    return Object.entries(valores).reduce(
      (acc, [token, valor]) => acc.split(token).join(valor),
      texto
    )
  }
  return { asunto: sustituir(plantilla.asunto), cuerpo: sustituir(plantilla.cuerpo) }
}
