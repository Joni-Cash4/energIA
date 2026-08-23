declare global {
  interface Window {
    umami?: { track: (event: string) => void }
  }
}

// Los 5 eventos medidos son exactamente los acordados: sin nombres, correos,
// CUPS, archivos, importes ni identificadores de factura — solo la acción.
export type TrackedEvent =
  | 'analizar_factura_click'
  | 'subida_iniciada'
  | 'subida_completada'
  | 'whatsapp_click'
  | 'contacto_completado'

export function track(event: TrackedEvent) {
  if (typeof window !== 'undefined' && window.umami) {
    window.umami.track(event)
  }
}
