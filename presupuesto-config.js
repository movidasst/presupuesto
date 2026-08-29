(() => {
  const SUPABASE_URL = 'https://lfdmbkzghnwvsapxypvt.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_bRnkA6PA8-v073nrw9zxiQ_8rVGiOn1';

  const DEFAULT_CONFIG = {
    pricing: {
      min_participants: 3,
      tier1_max: 11,
      tier2_max: 49,
      tier3_max: 99,
      rate1: 7,
      rate2: 5,
      rate3: 4,
      rate4: 3,
      tier1_name: 'Cohorte Base',
      tier2_name: 'Cohorte Corporativa',
      tier3_name: 'Cohorte Escala',
      tier4_name: 'Gran Cohorte'
    },
    course: {
      hours: 4,
      enrollment_days: 45,
      approval_percent: 80,
      substitution_days: 7
    },
    demo: {
      days: 30,
      max_participants: 20,
      topics: [
        'Seguridad contra incendios',
        'Manejo seguro de productos químicos',
        'Manipulación manual de cargas',
        'Primeros auxilios en el trabajo',
        'SST para supervisores',
        'Salud mental en el trabajo'
      ],
      bonus_course: 'Plan Familiar de Emergencias',
      bonus_note: 'Se incorpora como curso bonus del Demo y no modifica la cantidad de cursos cotizados.'
    },
    catalog: {
      moodle_category_id: 27,
      allow_other_topic: true,
      allow_dnf_pending: true
    },
    benefits: {
      base: [
        'Acceso multiplataforma',
        'Evaluación automatizada',
        'Certificados para aprobados',
        'Informe básico de participación y resultados',
        'Registro de asistencia y trazabilidad de participación',
        'Grupo de WhatsApp de soporte por curso',
        'Ayuda con IA para resumir y explicar contenidos',
        'Metodología propia MOVIDA 4A: aprendizaje activo inspirado en neuroeducación, ciencias del aprendizaje, microlearning, gamificación y escenarios prácticos',
        'Guías PDF y recursos de apoyo',
        'Encuesta de satisfacción al cierre',
        'Gamificación con progreso, puntos, retos y ranking de cohorte configurable'
      ],
      standard: [
        'DNF básica incluida',
        'Priorización inicial de necesidades y temas de formación'
      ],
      scale: [
        'DNF ampliada',
        'Diseño del plan de capacitación',
        'Cronograma de ejecución',
        'Reporte analítico de la cohorte'
      ],
      mass: [
        'Seguimiento ampliado de la cohorte',
        'Consolidado ejecutivo de resultados'
      ]
    },
    commercial: {
      payment_methods: [
        'Transferencia Venezuela: Banco de Venezuela · Corriente · 0102-0236-1500-0033-6732 · Ezequiel Linares · C.I. 30.407.087 · https://www.bcv.org.ve/',
        'Venezuela · Pago Móvil: Banco de Venezuela · Ezequiel Linares · C.I. V-30.407.087 · 0412-6372223',
        'Binance USDT: BEP20 (BSC) · ID 176067584 · david.linaresb@gmail.com',
        'PayPal: https://www.paypal.com/paypalme/movidasst · movidasst@gmail.com'
      ],
      chile_billing: 'Boleta Electrónica Fiscal conforme al esquema indicado.',
      venezuela_billing: 'Si se requiere factura fiscal local, el monto final podrá estar sujeto a los cargos fiscales, tributarios y administrativos que correspondan según el tipo de operación y la normativa vigente.',
      quote_validity_days: 15,
      preliminary_note: 'Este documento es una estimación referencial generada por el cotizador y no constituye una factura, orden de compra ni aceptación contractual. La cotización formal puede variar por impuestos, personalización, alcance, facturación local u otros requerimientos específicos de la empresa.',
      technical_note: 'La formación asincrónica complementa la gestión de capacitación y no sustituye entrenamientos prácticos, inducciones específicas, demostraciones de competencia ni otras exigencias presenciales que correspondan al riesgo, tarea o normativa aplicable.'
    }
  };

  let currentConfig = structuredClone(DEFAULT_CONFIG);
  let client = null;
  let lastUpdatedAt = null;
  let remoteReady = false;
  let lastLoadError = null;

  const clone = value => JSON.parse(JSON.stringify(value));
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[c]));
  const moneyNumber = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value || 0));

  function merge(base, patch) {
    if (Array.isArray(base)) return Array.isArray(patch) ? clone(patch) : clone(base);
    if (!base || typeof base !== 'object') return patch ?? base;
    const out = { ...base };
    Object.keys(base).forEach(key => {
      if (patch && Object.prototype.hasOwnProperty.call(patch, key)) out[key] = merge(base[key], patch[key]);
    });
    if (patch && typeof patch === 'object') {
      Object.keys(patch).forEach(key => {
        if (!Object.prototype.hasOwnProperty.call(out, key)) out[key] = clone(patch[key]);
      });
    }
    return out;
  }

  function getClient() {
    if (client) return client;
    if (!window.supabase?.createClient) return null;
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return client;
  }

  async function load() {
    const sb = getClient();
    if (!sb) {
      remoteReady = false;
      lastLoadError = new Error('Supabase no está disponible');
      return currentConfig;
    }
    try {
      const { data, error } = await sb.rpc('presupuesto_config_publica');
      if (error) throw error;
      if (!data?.config) throw new Error('La configuración comercial no contiene datos');
      currentConfig = merge(DEFAULT_CONFIG, data.config);
      lastUpdatedAt = data.updated_at || null;
      remoteReady = true;
      lastLoadError = null;
    } catch (error) {
      remoteReady = false;
      lastLoadError = error;
      console.warn('No fue posible cargar la configuración comercial vigente. Se muestran valores de referencia, pero la propuesta formal queda deshabilitada.', error);
    }
    return currentConfig;
  }

  function get() { return currentConfig; }
  function getUpdatedAt() { return lastUpdatedAt; }
  function isRemoteReady() { return remoteReady; }
  function getLoadError() { return lastLoadError; }

  function rangeData() {
    const p = currentConfig.pricing;
    return [
      { name: p.tier1_name, from: p.min_participants, to: p.tier1_max, rate: Number(p.rate1), benefitKey: 'base' },
      { name: p.tier2_name, from: p.tier1_max + 1, to: p.tier2_max, rate: Number(p.rate2), benefitKey: 'standard' },
      { name: p.tier3_name, from: p.tier2_max + 1, to: p.tier3_max, rate: Number(p.rate3), benefitKey: 'scale' },
      { name: p.tier4_name, from: p.tier3_max + 1, to: null, rate: Number(p.rate4), benefitKey: 'mass' }
    ];
  }

  function tierFor(count) {
    const p = currentConfig.pricing;
    const b = currentConfig.benefits;
    const base = [...(b.base || [])];
    if (count >= p.tier3_max + 1) {
      return {
        key: 'mass', name: p.tier4_name, price: Number(p.rate4), dnf: true, dnfLevel: 'ampliada',
        benefits: [...base, ...(b.standard || []), ...(b.scale || []), ...(b.mass || [])],
        planningScope: `Incluye DNF ampliada, planificación y todos los beneficios de escalas anteriores, además de ${(b.mass || []).join(' y ').toLowerCase()}.`
      };
    }
    if (count >= p.tier2_max + 1) {
      return {
        key: 'scale', name: p.tier3_name, price: Number(p.rate3), dnf: true, dnfLevel: 'ampliada',
        benefits: [...base, ...(b.standard || []), ...(b.scale || [])],
        planningScope: `Incluye DNF ampliada y ${(b.scale || []).join(', ').toLowerCase()}.`
      };
    }
    if (count >= p.tier1_max + 1) {
      return {
        key: 'standard', name: p.tier2_name, price: Number(p.rate2), dnf: true, dnfLevel: 'básica',
        benefits: [...base, ...(b.standard || [])],
        planningScope: `Incluye DNF básica y ${(b.standard || []).join(' y ').toLowerCase()}.`
      };
    }
    return {
      key: 'base', name: p.tier1_name, price: Number(p.rate1), dnf: false, dnfLevel: 'no incluida',
      benefits: base,
      planningScope: 'La DNF no está incluida en esta escala. Puede solicitarse como servicio complementario.'
    };
  }

  function calculate(count) {
    const p = currentConfig.pricing;
    const n = Math.max(0, Math.trunc(Number(count) || 0));
    const t1 = Math.min(n, p.tier1_max);
    const t2 = Math.max(0, Math.min(n, p.tier2_max) - p.tier1_max);
    const t3 = Math.max(0, Math.min(n, p.tier3_max) - p.tier2_max);
    const t4 = Math.max(0, n - p.tier3_max);
    const tranches = [
      { quantity: t1, rate: Number(p.rate1), from: 1, to: p.tier1_max },
      { quantity: t2, rate: Number(p.rate2), from: p.tier1_max + 1, to: p.tier2_max },
      { quantity: t3, rate: Number(p.rate3), from: p.tier2_max + 1, to: p.tier3_max },
      { quantity: t4, rate: Number(p.rate4), from: p.tier3_max + 1, to: null }
    ].filter(item => item.quantity > 0);
    const perCourse = tranches.reduce((sum, item) => sum + item.quantity * item.rate, 0);
    const marginalRate = n >= p.tier3_max + 1 ? Number(p.rate4)
      : n >= p.tier2_max + 1 ? Number(p.rate3)
      : n >= p.tier1_max + 1 ? Number(p.rate2)
      : Number(p.rate1);
    const averageRate = n > 0 ? perCourse / n : 0;
    const breakdown = tranches.map(item => `${item.quantity}×$${moneyNumber(item.rate)}`).join(' + ');
    return { perCourse, marginalRate, averageRate, breakdown, tranches };
  }

  function listHtml(items) {
    return (items || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
  }

  function renderPriceCardFeatures(card, range, index, benefits) {
    const ul = card.querySelector('.price-card__features');
    if (!ul) return;
    if (index === 0) {
      const pillars = [
        '<b>Metodología propia MOVIDA 4A:</b> aprendizaje activo inspirado en neuroeducación, ciencias del aprendizaje, microlearning, gamificación y escenarios prácticos.',
        '<b>Evaluación y entrega de certificado:</b> evaluación final, certificado para quienes aprueben y encuesta.',
        '<b>Trazabilidad:</b> asistencia, avance, resultados e informe básico.',
        '<b>Acompañamiento:</b> WhatsApp de soporte + ayuda con IA.',
        '<b>Gamificación:</b> progreso, puntos, retos y ranking de cohorte configurable.'
      ];
      ul.innerHTML = pillars.map(x => `<li>${x}</li>`).join('');
      let details = card.querySelector('.price-card__all-benefits');
      if (!details) {
        details = document.createElement('details');
        details.className = 'price-card__all-benefits';
        details.innerHTML = '<summary>Ver todo lo incluido</summary><ul></ul>';
        ul.insertAdjacentElement('afterend', details);
      }
      details.querySelector('ul').innerHTML = listHtml(benefits.base);
    } else {
      ul.innerHTML = listHtml(benefits[range.benefitKey] || []);
    }
  }

  function replaceTerm(containerSelector, label, value) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    const item = [...container.querySelectorAll('li')].find(li => li.querySelector('b')?.textContent.trim().startsWith(label));
    if (!item) return;
    const icon = item.querySelector('i')?.outerHTML || '';
    item.innerHTML = `${icon}<span><b>${escapeHtml(label)}:</b> ${escapeHtml(value)}</span>`;
  }

  function applyStructuredData() {
    const node = document.getElementById('structuredData');
    if (!node) return;
    const cfg = currentConfig;
    const p = cfg.pricing;
    const d = cfg.demo;
    const data = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'EducationalOrganization',
          '@id': 'https://movidasst.org/#organization',
          name: 'Academia Movida de Seguridad y Salud en el Trabajo',
          url: 'https://movidasst.org',
          logo: 'https://lh3.googleusercontent.com/d/1F1EETURi32f_QWBJSnrU7DOYJ_NeNLK7=s800',
          description: 'Ecosistema de aprendizaje digital y microlearning asincrónico para Seguridad y Salud en el Trabajo.',
          email: 'info@movidasst.com',
          telephone: '+56968615650'
        },
        {
          '@type': 'Service',
          '@id': 'https://presupuesto.movidasst.com/#service',
          name: 'Capacitación Corporativa en Seguridad y Salud en el Trabajo',
          provider: { '@id': 'https://movidasst.org/#organization' },
          serviceType: 'Capacitación corporativa en SST',
          areaServed: ['Chile', 'Venezuela', 'América Latina'],
          description: `Formación asincrónica corporativa con tarifas progresivas por volumen, desde ${p.min_participants} participantes.`
        },
        {
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: '¿Qué incluye el Demo Corporativo Gratuito?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: `Prueba piloto de ${d.days} días para hasta ${d.max_participants} participantes, con un tema corporativo disponible y el curso bonus ${d.bonus_course}.`
              }
            },
            {
              '@type': 'Question',
              name: '¿A partir de cuántos participantes se incluye la DNF?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: `La DNF básica se incluye desde ${p.tier1_max + 1} participantes y se amplía en escalas superiores.`
              }
            }
          ]
        }
      ]
    };
    node.textContent = JSON.stringify(data);
  }

  function applyToDom() {
    const cfg = currentConfig;
    const p = cfg.pricing, c = cfg.course, d = cfg.demo, b = cfg.benefits, commercial = cfg.commercial;
    const ranges = rangeData();
    const priceCards = [...document.querySelectorAll('#planes .price-card')];

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) metaDescription.content = `Capacitación corporativa en SST con microlearning asincrónico, seguimiento, certificados e informes. Demo Corporativo de ${d.days} días para hasta ${d.max_participants} participantes.`;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = `Capacitación Corporativa en SST | Demo ${d.days} días`;
    const heroDemoCta = document.querySelector('.hero__actions a[href="#demo"]');
    if (heroDemoCta) heroDemoCta.innerHTML = '<i class="fa-solid fa-rocket" aria-hidden="true"></i> Solicitar Demo Corporativo';

    ranges.forEach((range, index) => {
      const card = priceCards[index];
      if (!card) return;
      const rangeText = range.to ? `${range.from} a ${range.to} participantes` : `${range.from}+ participantes`;
      const trancheText = range.to ? (index === 0 ? `Tramo ${range.from}–${range.to}` : `Plazas ${range.from}–${range.to}`) : `Plazas ${range.from}+`;
      const name = card.querySelector('.price-card__name');
      const rg = card.querySelector('.price-card__range');
      const list = card.querySelector('.price-card__list');
      const price = card.querySelector('.price-card__price');
      if (name) name.textContent = range.name;
      if (rg) rg.textContent = rangeText;
      if (list) list.textContent = trancheText;
      if (price) price.textContent = `$${moneyNumber(range.rate)}`;
      renderPriceCardFeatures(card, range, index, b);
    });

    const methodFlow = document.querySelector('.course-experience-flow');
    if (methodFlow) {
      const methodTitle = methodFlow.querySelector('.course-experience-flow__title');
      const methodText = methodFlow.querySelector(':scope > p');
      if (methodTitle) methodTitle.innerHTML = '<i class="fa-solid fa-route" aria-hidden="true"></i> Metodología propia MOVIDA 4A';
      if (methodText) methodText.textContent = 'Modelo propio de aprendizaje activo inspirado en principios de neuroeducación y ciencias del aprendizaje, combinado con microlearning, gamificación y escenarios prácticos para favorecer la participación y la aplicación de lo aprendido al trabajo.';
    }

    const minHelp = document.getElementById('participantsHelp');
    if (minHelp) minHelp.textContent = `Mínimo de contratación: ${p.min_participants} participantes por cohorte. Sin monto mínimo por orden.`;
    const partInput = document.getElementById('budgetParticipants');
    if (partInput) partInput.min = String(p.min_participants);
    const courseHelp = document.getElementById('coursesHelp');
    if (courseHelp) courseHelp.textContent = `Cada curso contempla ${c.hours} horas académicas y ${c.enrollment_days} días de matrícula.`;

    const proof = [...document.querySelectorAll('.hero__proof .proof strong')];
    if (proof[1]) proof[1].textContent = `${c.enrollment_days} días`;
    if (proof[2]) proof[2].textContent = `${c.approval_percent}%`;
    const meta = document.querySelector('.course-card__meta');
    if (meta) meta.textContent = `Microlearning · ${c.hours} horas académicas · evaluación final`;

    const noticeDemo = document.querySelector('.notice__inner > span:not(.notice__badge) strong');
    if (noticeDemo) noticeDemo.textContent = `${d.days} días`;
    const demoTitle = document.getElementById('demo-title');
    if (demoTitle) demoTitle.textContent = `Demo Corporativo Gratuito por ${d.days} Días`;
    const demoMax = document.getElementById('demoMaxParticipants');
    if (demoMax) demoMax.textContent = `${d.max_participants} participantes`;
    const demoTopics = document.getElementById('demoTopics');
    if (demoTopics) demoTopics.innerHTML = d.topics.map(topic => `<li><i class="fa-solid fa-circle-check" aria-hidden="true"></i><span>${escapeHtml(topic)}</span></li>`).join('');
    const demoBonus = document.getElementById('demoBonusCourse');
    if (demoBonus) demoBonus.textContent = d.bonus_course;
    const demoBonusNote = document.getElementById('demoBonusNote');
    if (demoBonusNote) demoBonusNote.textContent = d.bonus_note;

    document.querySelectorAll('[data-demo-days]').forEach(el => el.textContent = String(d.days));
    document.querySelectorAll('[data-demo-max]').forEach(el => el.textContent = String(d.max_participants));

    const demoWhatsapp = document.getElementById('demoWhatsappBtn');
    if (demoWhatsapp) {
      const msg = `Hola David, quiero solicitar el Demo Corporativo Gratuito de ${d.days} días para una empresa.\
\
Empresa: \
Tema de interés: \
Cantidad de participantes (máx. ${d.max_participants}): `;
      demoWhatsapp.href = `https://wa.me/56968615650?text=${encodeURIComponent(msg)}`;
    }

    const dnfStart = p.tier1_max + 1;
    const dnfScaleStart = p.tier2_max + 1;
    const dnfEyebrow = document.querySelector('#dnf .eyebrow');
    if (dnfEyebrow) dnfEyebrow.innerHTML = `<i class="fa-solid fa-magnifying-glass-chart" aria-hidden="true"></i> DNF básica desde ${dnfStart} · ampliada desde ${dnfScaleStart}`;
    const dnfTag = document.querySelector('#dnf .dnf-side__tag');
    if (dnfTag) dnfTag.innerHTML = `<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Básica ${dnfStart}+ · ampliada ${dnfScaleStart}+`;

    const faqDetails = [...document.querySelectorAll('#faq details')];
    const dnfFaq = faqDetails.find(el => el.querySelector('summary')?.textContent.includes('DNF'));
    if (dnfFaq?.querySelector('p')) dnfFaq.querySelector('p').textContent =
      `Desde ${dnfStart} participantes se incluye una DNF básica sin costo adicional. Desde ${dnfScaleStart} participantes se amplía el diagnóstico y se incorpora planificación más profunda.`;
    const demoFaq = faqDetails.find(el => el.querySelector('summary')?.textContent.includes('Demo'));
    if (demoFaq?.querySelector('p')) demoFaq.querySelector('p').textContent =
      `Prueba por ${d.days} días para hasta ${d.max_participants} participantes con uno de los temas corporativos disponibles, evaluación, certificados para aprobados e informe final. Incluye como bonus ${d.bonus_course}.`;

    replaceTerm('#condiciones .terms', 'Sustitución', `cambios de participantes sin costo durante los primeros ${c.substitution_days} días continuos de la cohorte.`);
    replaceTerm('#condiciones .terms', 'Aprobación', `evaluación automatizada con nota mínima del ${c.approval_percent}% para emisión del certificado.`);
    const webTechnical = document.querySelector('#condiciones .legal-note');
    if (webTechnical) webTechnical.innerHTML = `<b>Nota técnica:</b> ${escapeHtml(commercial.technical_note)}`;

    const paymentChips = document.querySelector('#condiciones .payment-chips');
    if (paymentChips) {
      const icons = ['fa-building-columns','fa-wallet','fa-coins'];
      paymentChips.innerHTML = (commercial.payment_methods || []).map((item, i) => `<span class="chip"><i class="fa-solid ${icons[i] || 'fa-money-bill'}" aria-hidden="true"></i> ${escapeHtml(item)}</span>`).join('');
    }
    const taxBoxes = [...document.querySelectorAll('#condiciones .tax-box')];
    if (taxBoxes[0]) taxBoxes[0].innerHTML = `<b>Chile:</b> ${escapeHtml(commercial.chile_billing)}`;
    if (taxBoxes[1]) taxBoxes[1].innerHTML = `<b>Venezuela:</b> ${escapeHtml(commercial.venezuela_billing)}`;

    const example = document.querySelector('.pricing-cta__example');
    if (example) {
      const totalEl = example.querySelector('.pricing-cta__total strong');
      if (totalEl) totalEl.textContent = `$${Math.round(calculate(30).perCourse * 4).toLocaleString('en-US')}`;
    }

    const validity = document.getElementById('printValidity');
    if (validity) validity.textContent = `${commercial.quote_validity_days} días`;
    const printIntro = document.querySelector('.print-proposal .print-intro');
    if (printIntro) printIntro.textContent = 'Propuesta personalizada generada con tarifas progresivas por tramos: cada tarifa se aplica únicamente a las plazas correspondientes a ese tramo.';
    const printIncludes = [...document.querySelectorAll('.print-proposal .print-includes .print-include')];
    if (printIncludes[1]) {
      const title = printIncludes[1].querySelector('b');
      const text = printIncludes[1].querySelector('span');
      if (title) title.textContent = `${c.hours} horas · Metodología MOVIDA 4A`;
      if (text) text.textContent = `Modelo propio de aprendizaje activo inspirado en neuroeducación y ciencias del aprendizaje, con microlearning, gamificación y escenarios prácticos. ${c.enrollment_days} días de matrícula.`;
    }
    if (printIncludes[2]?.querySelector('span')) printIncludes[2].querySelector('span').textContent =
      `Criterio de aprobación mínimo del ${c.approval_percent}% para la emisión del certificado.`;

    const printDemo = document.querySelector('.print-page:first-of-type > .print-note');
    if (printDemo) printDemo.innerHTML = `<b>Demo corporativo:</b> prueba piloto de ${d.days} días para hasta ${d.max_participants} participantes. Bonus: ${escapeHtml(d.bonus_course)}.`;

    const rows = [
      document.getElementById('printTierSmall'), document.getElementById('printTierStandard'),
      document.getElementById('printTierScale'), document.getElementById('printTierMass')
    ];
    ranges.forEach((range, index) => {
      const row = rows[index];
      if (!row) return;
      const cells = row.querySelectorAll('td');
      if (cells[0]) cells[0].textContent = range.name;
      if (cells[1]) cells[1].textContent = range.to ? `${range.from} a ${range.to}` : `${range.from}+`;
      if (cells[2]) cells[2].textContent = index === 0 ? `$${moneyNumber(range.rate)} USD / plaza / curso` : `$${moneyNumber(range.rate)} USD / plaza adicional / curso`;
      if (cells[3]) {
        const additions = b[range.benefitKey] || [];
        cells[3].textContent = index === 0
          ? 'MOVIDA 4A + evaluación + certificados + trazabilidad + acompañamiento + gamificación'
          : `Todo lo anterior + ${additions.join(' + ')}`;
      }
    });

    const printMuted = document.querySelector('.print-page:nth-of-type(2) .print-muted');
    if (printMuted) printMuted.textContent =
      `Mínimo de contratación: ${p.min_participants} participantes por cohorte. Sin monto mínimo. Cada tarifa se aplica solo a las plazas de su tramo; las plazas anteriores mantienen su tarifa.`;

    const printBoxes = document.querySelectorAll('.print-page:nth-of-type(2) .print-two-col .print-box');
    if (printBoxes[0]) {
      const items = printBoxes[0].querySelectorAll('li');
      if (items[0]) items[0].textContent = `DNF básica incluida desde ${dnfStart} participantes y DNF ampliada desde ${dnfScaleStart}.`;
    }
    if (printBoxes[1]) {
      const list = printBoxes[1].querySelector('.print-list');
      if (list) list.innerHTML = `${(commercial.payment_methods || []).map(x => `<li>${escapeHtml(x)}.</li>`).join('')}<li><b>Chile:</b> ${escapeHtml(commercial.chile_billing)}</li><li><b>Venezuela:</b> ${escapeHtml(commercial.venezuela_billing)}</li>`;
    }

    replaceTerm('.print-page:nth-of-type(2) > .print-section.print-box .print-list', 'Sustitución', `cambios de participantes sin costo durante los primeros ${c.substitution_days} días continuos de la cohorte.`);
    replaceTerm('.print-page:nth-of-type(2) > .print-section.print-box .print-list', 'Período de matrícula', `${c.enrollment_days} días por curso, salvo alcance distinto acordado.`);
    replaceTerm('.print-page:nth-of-type(2) > .print-section.print-box .print-list', 'Aprobación', `evaluación final con nota mínima del ${c.approval_percent}% para la emisión del certificado.`);

    const printNotes = [...document.querySelectorAll('.print-page:nth-of-type(2) .print-section .print-note')];
    if (printNotes[0]) printNotes[0].innerHTML = `<b>Carácter preliminar:</b> ${escapeHtml(commercial.preliminary_note)}`;
    if (printNotes[1]) printNotes[1].innerHTML = `<b>Nota técnica:</b> ${escapeHtml(commercial.technical_note)}`;

    applyStructuredData();
  }

  window.PresupuestoConfig = {
    DEFAULT_CONFIG: clone(DEFAULT_CONFIG),
    SUPABASE_URL,
    SUPABASE_KEY,
    getClient,
    load,
    get,
    getUpdatedAt,
    isRemoteReady,
    getLoadError,
    rangeData,
    getTier: tierFor,
    calculate,
    applyToDom,
    escapeHtml
  };
})();
