// Noticias de redacción propia — basadas en datos públicos (REE, OMIE, CNMC),
// reescritas con voz neutral. NUNCA mencionar comercializadoras concretas aquí
// (ni Próxima Energía, ni Atulado, ni ninguna otra) — la web se posiciona como
// comparador independiente, no como escaparate de una empresa.
//
// Enlazan a páginas internas (mercado, comparador, faq) en vez de fuentes
// externas, ya que son piezas de redacción propia, no agregación de RSS.

export interface NoticiaPropia {
  id: string
  titulo: string
  descripcion: string
  url: string
  imagen?: string
  fuente: string
  fecha: string // ISO date
}

export const NOTICIAS_PROPIAS: NoticiaPropia[] = [
  {
    id: 'propia-fiscalidad-junio-2026',
    titulo: 'Por qué tu factura de la luz puede subir desde junio aunque consumas lo mismo',
    descripcion:
      'El IVA y el Impuesto Especial sobre la Electricidad vuelven a sus tipos habituales tras el fin de las rebajas fiscales temporales. El importe final puede subir en torno a un 15% sin que haya cambiado tu consumo.',
    url: '/comparador',
    fuente: 'IAenergía',
    fecha: '2026-06-01',
  },
  {
    id: 'propia-mercado-mayo-2026',
    titulo: 'El precio medio del mercado eléctrico repunta en mayo: qué lo explica',
    descripcion:
      'El precio medio del mercado diario (OMIE) se situó en torno a 54 €/MWh en mayo, con una tendencia alcista ligada al encarecimiento del gas natural y al menor peso de la producción hidroeléctrica respecto al año anterior.',
    url: '/mercado',
    fuente: 'IAenergía',
    fecha: '2026-06-05',
  },
  {
    id: 'propia-balance-renovables-mayo-2026',
    titulo: 'Las renovables cubren ya el 60% de la generación eléctrica en España',
    descripcion:
      'Según datos de Red Eléctrica, la solar fotovoltaica crece un 28% respecto al año anterior y se consolida como la tecnología con más peso del mes, mientras la eólica y la hidráulica retroceden por menor disponibilidad de recurso.',
    url: '/mercado',
    fuente: 'IAenergía',
    fecha: '2026-06-08',
  },
  {
    id: 'propia-ahorro-verano-2026',
    titulo: 'Ventilador toda la noche: cuánto cuesta realmente y cómo ahorrar más',
    descripcion:
      'Dormir con el ventilador encendido toda la noche cuesta normalmente entre 3 y 12 céntimos, ya que no enfría el aire sino que lo mueve. Usar temporizador y velocidad baja reduce aún más el consumo en los meses de calor.',
    url: '/faq',
    fuente: 'IAenergía',
    fecha: '2026-06-10',
  },
]
