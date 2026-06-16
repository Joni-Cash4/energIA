// Noticias de redacción propia — basadas en datos públicos (REE, OMIE, CNMC),
// reescritas con voz neutral. NUNCA mencionar comercializadoras concretas aquí
// (ni Próxima Energía, ni Atulado, ni ninguna otra) — la web se posiciona como
// comparador independiente, no como escaparate de una empresa.
//
// Cada pieza tiene su propia página en /noticias/[id] con el contenido completo,
// y termina con una llamada a la acción hacia una página interna relevante.

export interface NoticiaPropia {
  id: string
  titulo: string
  descripcion: string
  contenido: string[] // párrafos
  url: string          // dónde aparece "Leer artículo" en el listado → /noticias/{id}
  imagen: string
  fuente: string
  fecha: string // ISO date
  cta: { label: string; href: string }
}

export const NOTICIAS_PROPIAS: NoticiaPropia[] = [
  {
    id: 'propia-fiscalidad-junio-2026',
    titulo: 'Por qué tu factura de la luz puede subir desde junio aunque consumas lo mismo',
    descripcion:
      'El IVA y el Impuesto Especial sobre la Electricidad vuelven a sus tipos habituales tras el fin de las rebajas fiscales temporales. El importe final puede subir en torno a un 15% sin que haya cambiado tu consumo.',
    contenido: [
      'Desde el 1 de junio de 2026, muchos consumidores están notando una subida en su factura eléctrica sin haber cambiado sus hábitos de consumo. La explicación no está en el mercado, sino en la fiscalidad.',
      'Durante los últimos años, el Gobierno aplicó rebajas temporales tanto en el IVA como en el Impuesto Especial sobre la Electricidad (IEE) para amortiguar el impacto de los precios energéticos en los hogares y las empresas. Esas rebajas tenían fecha de caducidad, y su fin implica que ambos impuestos vuelven a sus tipos habituales.',
      'En la práctica, esto puede suponer un incremento del importe final de la factura de en torno a un 15%, incluso si el consumo en kWh es idéntico al de meses anteriores. Es un cambio puramente fiscal, no energético.',
      'Para quienes tienen tarifas indexadas al mercado, este efecto se suma (o resta) a las variaciones propias del precio de la energía, por lo que conviene revisar el desglose completo de la factura — no solo el total — para entender qué parte corresponde a impuestos y qué parte a consumo real.',
    ],
    url: '/noticias/propia-fiscalidad-junio-2026',
    imagen: '/noticias/fiscalidad.svg',
    fuente: 'IAenergía',
    fecha: '2026-06-01',
    cta: { label: 'Analiza tu factura gratis', href: '/comparador' },
  },
  {
    id: 'propia-mercado-mayo-2026',
    titulo: 'El precio medio del mercado eléctrico repunta en mayo: qué lo explica',
    descripcion:
      'El precio medio del mercado diario (OMIE) se situó en torno a 54 €/MWh en mayo, con una tendencia alcista ligada al encarecimiento del gas natural y al menor peso de la producción hidroeléctrica respecto al año anterior.',
    contenido: [
      'El precio medio del mercado eléctrico diario (OMIE) cerró mayo de 2026 en torno a 54 €/MWh, consolidando una tendencia alcista que se viene observando a lo largo de las últimas semanas.',
      'Parte de esta subida está ligada a la tensión en los mercados internacionales de gas natural, que sigue actuando como referencia para fijar el precio en las horas en las que el sistema necesita recurrir a centrales de ciclo combinado para cubrir la demanda.',
      'A nivel nacional, la reserva hidráulica se mantiene en niveles altos (en torno al 84% de su capacidad), por encima del año anterior. Sin embargo, la producción hidroeléctrica real del mes ha caído cerca de un 23% respecto a mayo de 2025, lo que reduce su efecto moderador sobre el precio.',
      'El resultado es un mercado con mayor volatilidad: mientras que en mayo de 2025 el precio medio apenas superó los 21 €/MWh, este año se han registrado picos puntuales cercanos a los 90 €/MWh, manteniéndose con frecuencia por encima de los 60 €/MWh en la recta final del mes.',
    ],
    url: '/noticias/propia-mercado-mayo-2026',
    imagen: '/noticias/mercado.svg',
    fuente: 'IAenergía',
    fecha: '2026-06-05',
    cta: { label: 'Ver precios de mercado en directo', href: '/mercado' },
  },
  {
    id: 'propia-balance-renovables-mayo-2026',
    titulo: 'Las renovables cubren ya el 60% de la generación eléctrica en España',
    descripcion:
      'Según datos de Red Eléctrica, la solar fotovoltaica crece un 28% respecto al año anterior y se consolida como la tecnología con más peso del mes, mientras la eólica y la hidráulica retroceden por menor disponibilidad de recurso.',
    contenido: [
      'Según los datos publicados por Red Eléctrica, la demanda eléctrica en mayo de 2026 creció un 1,3% respecto al año anterior, alcanzando los 16.335 GWh.',
      'Las energías renovables lideraron la generación con una cuota del 60,5% del total mensual. La gran protagonista fue la solar fotovoltaica, con un crecimiento del 28% respecto a 2025, situándose como la tecnología con mayor peso del mes (27,7% del mix).',
      'No todas las renovables crecieron por igual: tanto la eólica (-8%) como la hidráulica (-23,5%) registraron descensos importantes, condicionadas por la menor disponibilidad de viento y agua embalsada utilizable durante el periodo.',
      'Para cubrir ese hueco y el aumento de la demanda, la generación nuclear creció un 31,1%, mientras que el ciclo combinado de gas —pese a reducir su producción interanual un 11,4%— siguió siendo una tecnología de respaldo clave, aportando un 13,3% del total.',
    ],
    url: '/noticias/propia-balance-renovables-mayo-2026',
    imagen: '/noticias/renovables.svg',
    fuente: 'IAenergía',
    fecha: '2026-06-08',
    cta: { label: 'Ver precios de mercado en directo', href: '/mercado' },
  },
  {
    id: 'propia-ahorro-verano-2026',
    titulo: 'Ventilador toda la noche: cuánto cuesta realmente y cómo ahorrar más',
    descripcion:
      'Dormir con el ventilador encendido toda la noche cuesta normalmente entre 3 y 12 céntimos, ya que no enfría el aire sino que lo mueve. Usar temporizador y velocidad baja reduce aún más el consumo en los meses de calor.',
    contenido: [
      'Con la llegada del calor, una de las dudas más habituales es cuánto cuesta realmente dormir con el ventilador encendido toda la noche. La respuesta, en la mayoría de los casos, es: muy poco — normalmente entre 3 y 12 céntimos por noche, dependiendo de la potencia del aparato y del precio de la luz en ese momento.',
      'La razón es sencilla: un ventilador no enfría el aire de la habitación, simplemente lo mueve. Esa corriente de aire genera una sensación de frescor en la piel que reduce la sensación de calor, pero el consumo eléctrico real es mucho menor que el de un aparato de aire acondicionado.',
      'Para ahorrar todavía más, hay algunas pautas sencillas: usar el temporizador para que se apague pasadas unas horas, elegir velocidad baja o modo noche en lugar de la velocidad máxima, y evitar dejarlo encendido en habitaciones vacías.',
      'Un consejo adicional: si tu tarifa tiene discriminación horaria, comprobar en qué periodo (P1, P2 o P3) caen las horas de uso del ventilador puede ayudarte a entender mejor el coste real de tenerlo encendido toda la noche.',
    ],
    url: '/noticias/propia-ahorro-verano-2026',
    imagen: '/noticias/ahorro.svg',
    fuente: 'IAenergía',
    fecha: '2026-06-10',
    cta: { label: 'Más preguntas frecuentes sobre tu factura', href: '/faq' },
  },
]

export function getNoticiaPropia(id: string): NoticiaPropia | undefined {
  return NOTICIAS_PROPIAS.find((n) => n.id === id)
}
