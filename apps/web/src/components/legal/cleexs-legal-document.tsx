import { cn } from '@/lib/utils';

const docDate = '13 de mayo de 2026';

const p = 'mb-3 text-[14px] leading-[1.65] text-slate-700 antialiased';
const h2 =
  'mt-8 scroll-mt-28 border-b border-slate-200 pb-1.5 text-lg font-bold tracking-tight text-slate-900 first:mt-0 sm:text-xl';
const h3 = 'mt-5 text-[14px] font-semibold text-slate-900';
const ul = 'mb-3 list-disc space-y-1.5 pl-5 text-[14px] leading-[1.65] text-slate-700 marker:text-slate-400';
const lead = 'mb-5 text-[14px] leading-relaxed text-slate-600';

export type LegalDocumentSectionId = 'terminos-de-servicio' | 'politica-de-privacidad';

const SECTION_NAV: Array<{ id: LegalDocumentSectionId; label: string; className: string }> = [
  {
    id: 'terminos-de-servicio',
    label: 'Ir a Términos de servicio',
    className:
      'rounded-full bg-white px-3 py-1.5 text-violet-800 shadow-sm ring-1 ring-violet-200/80 transition hover:bg-violet-50',
  },
  {
    id: 'politica-de-privacidad',
    label: 'Ir a Política de privacidad',
    className:
      'rounded-full bg-white px-3 py-1.5 text-indigo-800 shadow-sm ring-1 ring-indigo-200/80 transition hover:bg-indigo-50',
  },
];

export function CleexsLegalDocument({
  embedded = false,
  onSectionJump,
}: {
  embedded?: boolean;
  /** En modal: scroll interno sin cambiar URL (evita salir del funnel). */
  onSectionJump?: (section: LegalDocumentSectionId) => void;
}) {
  return (
    <article
      className={cn(
        'mx-auto max-w-2xl scroll-smooth px-4 pt-6 sm:px-5 sm:pt-8',
        embedded ? 'pb-6' : 'pb-28'
      )}
    >
      <header className="mb-6 rounded-xl border border-violet-100/90 bg-gradient-to-br from-violet-50/80 via-white to-indigo-50/30 p-5 shadow-sm ring-1 ring-violet-100/50 sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-700">Cleexs · Documento legal</p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Términos y privacidad</h1>
        <p className={`mt-2 ${lead}`}>
          Texto completo para el flujo de diagnóstico y el uso de la plataforma.
        </p>
        <nav className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
          {SECTION_NAV.map(({ id, label, className }) =>
            onSectionJump ? (
              <button key={id} type="button" className={className} onClick={() => onSectionJump(id)}>
                {label}
              </button>
            ) : (
              <a key={id} href={`#${id}`} className={className}>
                {label}
              </a>
            )
          )}
        </nav>
      </header>

      <section
        id="terminos-de-servicio"
        className="scroll-mt-24 rounded-xl border border-slate-200/90 bg-white/85 p-5 shadow-sm ring-1 ring-slate-100/80 sm:p-6"
      >
        <h2 className={h2}>Términos de servicio de Cleexs</h2>
        <p className="text-xs font-medium text-slate-500">Última actualización: {docDate}</p>
        <p className={`mt-4 ${p}`}>
          Bienvenido a Cleexs. Estos Términos de Servicio regulan el acceso y uso de nuestra plataforma, sitio web,
          reportes, herramientas, análisis, recomendaciones y servicios relacionados con posicionamiento digital, SEO,
          visibilidad en buscadores, presencia en motores de búsqueda impulsados por inteligencia artificial y análisis
          competitivo.
        </p>
        <p className={p}>
          Al acceder o utilizar Cleexs, el usuario acepta estos Términos. Si no está de acuerdo con ellos, deberá
          abstenerse de utilizar la plataforma.
        </p>

        <h3 className={h3}>1. Identificación del servicio</h3>
        <p className={p}>
          Cleexs es una plataforma digital orientada al análisis de presencia online, visibilidad SEO, autoridad digital,
          capacidad de ser citado por buscadores, asistentes de inteligencia artificial y otros sistemas de descubrimiento
          de información.
        </p>
        <p className={p}>El servicio puede incluir, entre otras funcionalidades:</p>
        <ul className={ul}>
          <li>Análisis de sitios web.</li>
          <li>Generación de reportes de visibilidad.</li>
          <li>Evaluación de presencia en buscadores.</li>
          <li>Comparación con competidores.</li>
          <li>Recomendaciones de mejora.</li>
          <li>Generación de un indicador o score propietario.</li>
          <li>Historial de reportes.</li>
          <li>Funcionalidades gratuitas y premium.</li>
          <li>Herramientas de diagnóstico, auditoría y seguimiento.</li>
        </ul>
        <p className={p}>
          Cleexs no garantiza posiciones específicas en Google, Bing, ChatGPT, Perplexity, Gemini, Copilot u otros
          motores de búsqueda o plataformas de inteligencia artificial.
        </p>

        <h3 className={h3}>2. Aceptación de los términos</h3>
        <p className={p}>
          El uso de Cleexs implica la aceptación plena de estos Términos de Servicio, así como de nuestra Política de
          Privacidad.
        </p>
        <p className={p}>
          El usuario declara tener capacidad suficiente para contratar o utilizar el servicio. En caso de actuar en
          nombre de una empresa, organización o tercero, declara contar con autorización suficiente para hacerlo.
        </p>

        <h3 className={h3}>3. Uso permitido de la plataforma</h3>
        <p className={p}>
          El usuario se compromete a utilizar Cleexs de manera lícita, responsable y conforme a estos Términos. Podrá
          utilizar la plataforma para analizar sitios web propios, sitios de empresas que representa o sitios públicos
          respecto de los cuales tenga un interés legítimo de análisis.
        </p>
        <p className={p}>Queda prohibido utilizar Cleexs para:</p>
        <ul className={ul}>
          <li>Realizar actividades ilegales.</li>
          <li>Vulnerar derechos de terceros.</li>
          <li>Extraer, copiar o explotar indebidamente información de la plataforma.</li>
          <li>Intentar interferir con la seguridad, disponibilidad o funcionamiento del servicio.</li>
          <li>Utilizar los resultados para engañar, difamar o perjudicar a terceros.</li>
          <li>Revender el servicio sin autorización expresa.</li>
          <li>Realizar ingeniería inversa, scraping abusivo o uso automatizado no autorizado de la plataforma.</li>
        </ul>

        <h3 className={h3}>4. Cuentas de usuario</h3>
        <p className={p}>
          Algunas funcionalidades pueden requerir registro. El usuario es responsable de la confidencialidad de sus
          credenciales y de toda actividad realizada desde su cuenta. Cleexs podrá suspender o cancelar cuentas ante uso
          indebido, incumplimiento de estos Términos, abuso, fraude, actividades sospechosas o riesgos de seguridad.
        </p>

        <h3 className={h3}>5. Información ingresada por el usuario</h3>
        <p className={p}>
          El usuario puede ingresar datos como nombre, correo electrónico, empresa, sitio web, competidores, industria,
          país, preferencias de análisis u otra información necesaria. Declara que la información es verdadera y
          actualizada y que cuenta con autorización cuando corresponda. Cleexs podrá utilizarla para prestar el
          servicio, generar reportes, mejorar la plataforma y personalizar la experiencia, conforme a la Política de
          Privacidad.
        </p>

        <h3 className={h3}>6. Reportes, análisis y recomendaciones</h3>
        <p className={p}>
          Los reportes tienen carácter informativo, orientativo y estratégico. Pueden basarse en información pública,
          datos técnicos del sitio, referencias en internet, señales SEO, estructura de contenido, presencia digital y
          criterios propios de evaluación.
        </p>
        <p className={p}>
          Cleexs no garantiza resultados específicos: incrementos de tráfico, posicionamiento, ventas, aparición en
          respuestas de IA o mayor conversión. Los resultados dependen de algoritmos, competencia, contenido, autoridad,
          inversión, reputación, mercado y decisiones de terceros.
        </p>

        <h3 className={h3}>7. Cleexs Score y métricas propietarias</h3>
        <p className={p}>
          Cleexs puede generar indicadores propios (p. ej. Cleexs Score). No constituyen certificaciones oficiales ni
          rankings universales ni garantías de rendimiento. Cleexs puede modificar metodologías, criterios y modelos sin
          aviso previo obligatorio.
        </p>

        <h3 className={h3}>8. Planes gratuitos y pagos</h3>
        <p className={p}>
          Pueden existir funcionalidades gratuitas, pruebas limitadas, reportes parciales, planes premium, suscripciones,
          pagos únicos o servicios personalizados. Las condiciones comerciales se informarán en el sitio, propuesta,
          pantalla de contratación o documentación. Cleexs podrá modificar precios, límites o condiciones, notificando
          cuando corresponda.
        </p>

        <h3 className={h3}>9. Pagos, facturación y cancelaciones</h3>
        <p className={p}>
          Los importes se abonarán según el plan elegido. Los pagos pueden procesarse mediante proveedores externos.
          Cleexs no almacena datos completos de tarjetas salvo indicación expresa. Salvo disposición específica, los pagos
          por servicios ya prestados, reportes generados o períodos iniciados no serán reembolsables. En suscripciones,
          el usuario podrá cancelar la renovación según el mecanismo disponible o contactando a Cleexs.
        </p>

        <h3 className={h3}>10. Servicios beta o experimentales</h3>
        <p className={p}>
          Algunas funciones pueden estar en beta o experimento: pueden contener errores, modificarse o discontinuarse. El
          uso se realiza bajo criterio propio del usuario; no se garantiza estabilidad, disponibilidad ni exactitud
          absoluta.
        </p>

        <h3 className={h3}>11. Propiedad intelectual</h3>
        <p className={p}>
          Cleexs, su marca, diseño, metodologías, interfaces, código, modelos de scoring y demás elementos propios son
          titularidad de Cleexs o de terceros licenciantes. El usuario no adquiere derechos salvo el uso limitado
          conforme a estos Términos. Conserva derechos sobre la información de su titularidad que ingrese.
        </p>

        <h3 className={h3}>12. Uso de terceros y fuentes externas</h3>
        <p className={p}>
          Cleexs puede utilizar APIs, hosting, IA, analítica, email, pagos u otros terceros. No controla por completo su
          disponibilidad o exactitud. Los resultados pueden depender de fuentes externas o públicas.
        </p>

        <h3 className={h3}>13. Disponibilidad del servicio</h3>
        <p className={p}>
          Cleexs procurará la operatividad, sin garantizar disponibilidad ininterrumpida o libre de errores. Pueden
          afectar mantenimiento, fallas, proveedores, conectividad, fuerza mayor u otras causas ajenas al control
          razonable de Cleexs.
        </p>

        <h3 className={h3}>14. Limitación de responsabilidad</h3>
        <p className={p}>
          Cleexs no será responsable por daños indirectos, lucro cesante, pérdida de oportunidades, datos, posicionamiento
          o decisiones comerciales basadas en la información de la plataforma. El usuario debe validar e implementar
          recomendaciones con criterio profesional propio.
        </p>

        <h3 className={h3}>15. Suspensión o terminación del servicio</h3>
        <p className={p}>
          Cleexs podrá suspender o limitar el acceso ante incumplimiento, abuso, fraude, falta de pago o riesgo a la
          seguridad. El usuario puede dejar de utilizar Cleexs en cualquier momento.
        </p>

        <h3 className={h3}>16. Modificaciones de los términos</h3>
        <p className={p}>
          Cleexs podrá actualizar estos Términos. Cuando los cambios sean relevantes, podrá notificar por el sitio,
          correo o avisos en la plataforma. El uso continuado tras la actualización implica aceptación de los nuevos
          términos.
        </p>

        <h3 className={h3}>17. Legislación aplicable y jurisdicción</h3>
        <p className={p}>
          Estos Términos se regirán por las leyes de la República Argentina, salvo normativa imperativa en contrario. Las
          partes procurarán resolver controversias de buena fe; si no fuera posible, se someterán a los tribunales
          competentes según la legislación aplicable.
        </p>

        <h3 className={h3}>18. Contacto</h3>
        <p className={p}>
          Consultas sobre estos Términos:{' '}
          <a className="font-medium text-violet-700 underline underline-offset-2" href="mailto:contacto@cleexs.net">
            contacto@cleexs.net
          </a>
          {' · '}
          <a className="font-medium text-violet-700 underline underline-offset-2" href="https://cleexs.net">
            https://cleexs.net
          </a>
        </p>
      </section>

      <section
        id="politica-de-privacidad"
        className="mt-6 scroll-mt-24 rounded-xl border border-slate-200/90 bg-white/85 p-5 shadow-sm ring-1 ring-slate-100/80 sm:p-6"
      >
        <h2 className={h2}>Política de privacidad de Cleexs</h2>
        <p className="text-xs font-medium text-slate-500">Última actualización: {docDate}</p>
        <p className={`mt-4 ${p}`}>
          En Cleexs valoramos la privacidad. Esta Política explica qué información recopilamos, cómo la utilizamos, con
          quién podemos compartirla, cuánto tiempo la conservamos y qué derechos tienen los usuarios. Al utilizar Cleexs,
          el usuario acepta el tratamiento conforme a esta Política.
        </p>

        <h3 className={h3}>1. Responsable del tratamiento</h3>
        <p className={p}>
          Responsable: <strong>Cleexs</strong>. Razón social y datos fiscales/domicilio completos disponibles a
          solicitud vía{' '}
          <a className="font-medium text-violet-700 underline underline-offset-2" href="mailto:privacidad@cleexs.net">
            privacidad@cleexs.net
          </a>
          . Correo de contacto general:{' '}
          <a className="font-medium text-violet-700 underline underline-offset-2" href="mailto:soporte@cleexs.net">
            soporte@cleexs.net
          </a>
          .
        </p>

        <h3 className={h3}>2. Datos que podemos recopilar</h3>
        <p className={`${p} font-semibold text-slate-900`}>a. Datos de registro y contacto</p>
        <ul className={ul}>
          <li>Nombre y apellido.</li>
          <li>Correo electrónico.</li>
          <li>Teléfono, si el usuario lo proporciona.</li>
          <li>Empresa u organización.</li>
          <li>Cargo o rol.</li>
          <li>País o ciudad.</li>
          <li>Datos de facturación, cuando corresponda.</li>
        </ul>
        <p className={`${p} font-semibold text-slate-900`}>b. Datos de uso de la plataforma</p>
        <ul className={ul}>
          <li>Fecha y hora de acceso.</li>
          <li>Funcionalidades utilizadas.</li>
          <li>Reportes generados.</li>
          <li>Historial de análisis.</li>
          <li>Preferencias de usuario.</li>
          <li>Plan contratado.</li>
          <li>Interacciones dentro de la plataforma.</li>
        </ul>
        <p className={`${p} font-semibold text-slate-900`}>c. Datos técnicos</p>
        <ul className={ul}>
          <li>Dirección IP.</li>
          <li>Tipo de navegador.</li>
          <li>Sistema operativo.</li>
          <li>Dispositivo utilizado.</li>
          <li>Identificadores técnicos.</li>
          <li>Cookies y tecnologías similares.</li>
          <li>Logs de seguridad y actividad.</li>
        </ul>
        <p className={`${p} font-semibold text-slate-900`}>d. Datos vinculados al análisis SEO</p>
        <ul className={ul}>
          <li>URL ingresada por el usuario.</li>
          <li>Sitio web analizado.</li>
          <li>Competidores sugeridos o ingresados.</li>
          <li>Industria o categoría del negocio.</li>
          <li>Información pública del sitio web.</li>
          <li>Contenido visible públicamente en internet.</li>
          <li>Señales técnicas o estructurales del dominio analizado.</li>
        </ul>
        <p className={`${p} font-semibold text-slate-900`}>e. Datos de comunicaciones</p>
        <ul className={ul}>
          <li>Consultas enviadas por formularios.</li>
          <li>Emails enviados a Cleexs.</li>
          <li>Solicitudes de soporte.</li>
          <li>Respuestas a encuestas, formularios o comunicaciones comerciales.</li>
        </ul>

        <h3 className={h3}>3. Finalidades del tratamiento</h3>
        <p className={p}>Cleexs podrá utilizar los datos personales para las siguientes finalidades:</p>
        <ul className={ul}>
          <li>Crear y administrar cuentas de usuario.</li>
          <li>Permitir el acceso a la plataforma.</li>
          <li>Generar reportes de análisis SEO y visibilidad digital.</li>
          <li>Calcular métricas, indicadores o scores propios.</li>
          <li>Sugerir acciones de mejora.</li>
          <li>Comparar sitios web con competidores.</li>
          <li>Gestionar planes gratuitos, premium o pagos.</li>
          <li>Procesar pagos y facturación.</li>
          <li>Brindar soporte técnico o comercial.</li>
          <li>Enviar comunicaciones operativas.</li>
          <li>Enviar novedades, recomendaciones o comunicaciones comerciales, cuando corresponda.</li>
          <li>Mejorar la calidad, seguridad y funcionamiento del servicio.</li>
          <li>Prevenir fraude, abuso o usos indebidos.</li>
          <li>Cumplir obligaciones legales, contables, fiscales o regulatorias.</li>
        </ul>

        <h3 className={h3}>4. Base legal para el tratamiento</h3>
        <p className={p}>
          Consentimiento; ejecución del servicio o relación contractual/precontractual; obligaciones legales; interés
          legítimo para mejorar y proteger la plataforma; atención de consultas o reclamos.
        </p>

        <h3 className={h3}>5. Información pública y sitios analizados</h3>
        <p className={p}>
          Cleexs puede analizar información pública en internet vinculada a sitios, dominios, marcas o presencia
          digital. Al solicitar un análisis, el usuario declara derecho, autorización o interés legítimo. Cleexs no se
          compromete a verificar titularidad en todos los casos.
        </p>

        <h3 className={h3}>6. Uso de inteligencia artificial y automatización</h3>
        <p className={p}>
          Puede usarse IA y automatización para reportes, clasificaciones y scores, con finalidad informativa; pueden
          existir errores o imprecisiones. El usuario debe revisar antes de decisiones comerciales, legales o
          estratégicas. Pueden usarse datos agregados o anonimizados para mejorar modelos, procurando no identificar
          directamente a personas.
        </p>

        <h3 className={h3}>7. Cookies y tecnologías similares</h3>
        <p className={p}>
          Para sesión, preferencias, medición, rendimiento, experiencia, seguridad y conversiones. El usuario puede
          configurar el navegador; algunas funciones podrían verse afectadas.
        </p>

        <h3 className={h3}>8. Servicios de terceros</h3>
        <p className={p}>
          Proveedores de hosting, analítica, email, pagos, soporte, IA, APIs y seguridad solo acceden a lo necesario y
          deben tratar la información conforme a sus obligaciones.
        </p>

        <h3 className={h3}>9. Transferencias internacionales</h3>
        <p className={p}>
          Algunos proveedores pueden estar fuera del país de residencia del usuario. Cleexs procurará medidas razonables
          de protección conforme a la normativa aplicable.
        </p>

        <h3 className={h3}>10. Conservación de los datos</h3>
        <p className={p}>
          Durante el tiempo necesario para las finalidades, obligaciones legales, disputas o protección de derechos.
          Luego podrán eliminarse o anonimizarse salvo obligación legal de conservación.
        </p>

        <h3 className={h3}>11. Seguridad de la información</h3>
        <p className={p}>
          Medidas razonables técnicas, organizativas y administrativas. No existe seguridad absoluta en internet. El
          usuario debe proteger credenciales y dispositivos.
        </p>

        <h3 className={h3}>12. Derechos del usuario</h3>
        <p className={p}>
          Acceso, rectificación, actualización, supresión u oposición cuando corresponda según la ley aplicable. Solicitudes
          a{' '}
          <a className="font-medium text-violet-700 underline underline-offset-2" href="mailto:privacidad@cleexs.net">
            privacidad@cleexs.net
          </a>
          . Podrá solicitarse información adicional para verificar identidad.
        </p>

        <h3 className={h3}>13. Comunicaciones comerciales</h3>
        <p className={p}>
          Cleexs puede enviar novedades o promociones; el usuario puede darse de baja según instrucciones del mensaje o
          escribiendo a privacidad@cleexs.net. Las comunicaciones operativas necesarias para el servicio pueden
          continuar.
        </p>

        <h3 className={h3}>14. Menores de edad</h3>
        <p className={p}>
          Cleexs no está dirigido a menores. Si se detectara recopilación sin autorización válida de tutores, podrá
          eliminarse la información.
        </p>

        <h3 className={h3}>15. Datos de pago</h3>
        <p className={p}>
          Los pagos pueden procesarse por terceros. Cleexs no almacena datos completos de tarjeta o códigos sensibles,
          salvo indicación expresa. Los proveedores aplican sus propias políticas.
        </p>

        <h3 className={h3}>16. Enlaces a terceros</h3>
        <p className={p}>
          Pueden existir enlaces externos; Cleexs no es responsable por sus prácticas de privacidad o contenido. Se
          recomienda revisar sus políticas.
        </p>

        <h3 className={h3}>17. Cambios en esta política</h3>
        <p className={p}>
          Cleexs podrá actualizar esta Política. Si los cambios son relevantes, podrá notificar por el sitio, correo o la
          plataforma. El uso continuado implica aceptación de la nueva versión.
        </p>

        <h3 className={h3}>18. Contacto</h3>
        <p className={p}>
          Consultas o reclamos sobre privacidad:{' '}
          <a className="font-medium text-violet-700 underline underline-offset-2" href="mailto:privacidad@cleexs.net">
            privacidad@cleexs.net
          </a>
          {' · '}
          <a className="font-medium text-violet-700 underline underline-offset-2" href="https://cleexs.net">
            https://cleexs.net
          </a>
        </p>
      </section>
    </article>
  );
}
