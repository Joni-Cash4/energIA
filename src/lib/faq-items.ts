// Preguntas frecuentes — módulo compartido SIN 'use client' para poder
// usarse tanto en componentes cliente como en páginas de servidor (JSON-LD).

export const FAQ_ITEMS = [
  {
    q: '¿Tengo penalización si cambio de comercializadora?',
    a: 'Depende de tu contrato actual. Algunas comercializadoras incluyen cláusulas de permanencia o penalización por baja anticipada, especialmente en contratos con precio fijo a largo plazo. Antes de hacer ningún cambio, revisamos tu contrato contigo para evitar cualquier sorpresa. En muchos casos el cambio es gratuito, pero no siempre.',
  },
  {
    q: '¿Cuánto tiempo tarda el proceso de cambio?',
    a: 'La ley establece un plazo máximo de 10 días hábiles. Durante este periodo seguirás teniendo luz en todo momento — el cambio es puramente administrativo. La nueva comercializadora se encarga de cancelar tu contrato anterior y notificar a la distribuidora, sin que tengas que hacer nada. El proceso es totalmente gratuito. Recibirás una última factura de tu antigua compañía por el consumo hasta el día del cambio.',
  },
  {
    q: '¿La tarifa indexada es siempre más barata?',
    a: 'No siempre. Con la tarifa indexada pagas el precio real del mercado OMIE cada mes, lo que significa que en meses de precios altos tu factura puede ser mayor que con una tarifa fija. La ventaja es que también bajas cuando el mercado baja, y a largo plazo suele resultar más económica. Analizamos tu caso concreto para recomendarte la opción que más te conviene.',
  },
  {
    q: '¿Qué diferencia hay entre tarifa fija e indexada?',
    a: 'En la tarifa fija pagas siempre el mismo precio por kWh, independientemente del mercado — cómodo, pero incluye un margen de riesgo de la comercializadora. En la tarifa indexada pagas el precio real del mercado OMIE ese mes más un fee transparente. Es más variable pero más honesta y habitualmente más barata a largo plazo.',
  },
  {
    q: '¿Qué es IAenergía? ¿Sois una comercializadora?',
    a: 'No. IAenergía es un servicio de asesoría energética independiente. No vendemos electricidad ni somos una comercializadora. Analizamos tu consumo, comparamos opciones del mercado y te acompañamos en el proceso de cambio.',
  },
  {
    q: '¿Qué es el CUPS?',
    a: 'El CUPS (Código Unificado de Punto de Suministro) es el identificador único de tu punto de conexión a la red eléctrica, como el DNI de tu instalación. Empieza por ES y tiene 20 caracteres. Lo encuentras en cualquier factura eléctrica.',
  },
]
