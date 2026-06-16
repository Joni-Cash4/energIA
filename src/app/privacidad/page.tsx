import type { Metadata } from 'next'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

export const metadata: Metadata = {
  title: 'Política de privacidad — IAenergía',
  description: 'Política de privacidad y protección de datos de IAenergía.',
}

export default function PrivacidadPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-16 pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <h1 className="text-3xl font-bold text-white mb-2">Política de privacidad</h1>
          <p className="text-[#6B7280] text-sm mb-10">Última actualización: junio de 2026</p>

          <div className="prose prose-invert prose-sm max-w-none space-y-8 text-[#9CA3AF] leading-relaxed">
            <section>
              <h2 className="text-white text-xl font-semibold mb-3">1. Responsable del tratamiento</h2>
              <p>
                <strong className="text-white">Jonathan López de Lacalle Calvo</strong>, NIF: 16086564L,
                titular del servicio <strong className="text-white">IAenergía</strong> (en adelante, "el responsable"),
                es responsable del tratamiento de los datos personales recogidos a través del sitio web{' '}
                <strong className="text-white">iaenergia.es</strong>.
                Contacto: <a href="mailto:contacto@iaenergia.es" className="text-[#00E676] hover:underline">contacto@iaenergia.es</a>
              </p>
            </section>

            <section>
              <h2 className="text-white text-xl font-semibold mb-3">2. Datos que recogemos</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Nombre, email y teléfono al usar el comparador o formulario de contacto.</li>
                <li>Datos de la factura eléctrica (CUPS, consumos, importes) para el análisis.</li>
                <li>Datos de navegación mediante cookies técnicas necesarias.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-white text-xl font-semibold mb-3">3. Finalidad y base legal</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-white">Prestación del servicio</strong>: análisis de factura y envío del informe (interés legítimo / ejecución de contrato).</li>
                <li><strong className="text-white">Comunicaciones comerciales</strong>: solo con consentimiento explícito.</li>
                <li><strong className="text-white">Gestión de leads</strong>: interés legítimo en la captación de clientes.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-white text-xl font-semibold mb-3">4. Conservación de datos</h2>
              <p>
                Los datos se conservan durante el tiempo necesario para la finalidad para la que fueron recogidos
                y, en todo caso, durante los plazos legalmente establecidos (máximo 3 años para datos comerciales).
              </p>
            </section>

            <section>
              <h2 className="text-white text-xl font-semibold mb-3">5. Destinatarios y subencargados</h2>
              <p className="mb-3">
                No cedemos datos a terceros salvo obligación legal. Utilizamos los siguientes subencargados de tratamiento:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong className="text-white">Supabase</strong> (alojado en la UE) — base de datos y autenticación.
                </li>
                <li>
                  <strong className="text-white">Vercel</strong> — alojamiento del frontend.
                </li>
                <li>
                  <strong className="text-white">Anthropic (Claude API)</strong> — análisis automatizado del contenido
                  de las facturas eléctricas subidas por el usuario. Los datos son procesados en servidores ubicados
                  en Estados Unidos. La transferencia internacional se ampara en las Cláusulas Contractuales Tipo
                  aprobadas por la Comisión Europea. Anthropic no utiliza los datos enviados a través de la API
                  para entrenar sus modelos.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-white text-xl font-semibold mb-3">6. Tus derechos</h2>
              <p>
                Puedes ejercer tus derechos de acceso, rectificación, supresión, limitación y portabilidad
                escribiendo a <a href="mailto:contacto@iaenergia.es" className="text-[#00E676] hover:underline">contacto@iaenergia.es</a>.
                También puedes reclamar ante la AEPD (aepd.es).
              </p>
            </section>

            <section>
              <h2 className="text-white text-xl font-semibold mb-3">7. Cookies</h2>
              <p>
                Utilizamos únicamente cookies técnicas necesarias para el funcionamiento del sitio
                (sesión de autenticación). No usamos cookies de seguimiento ni publicidad.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
