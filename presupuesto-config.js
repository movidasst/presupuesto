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
      list_price: 15,
      tier1_name: 'Grupo menor',
      tier2_name: 'Grupo estándar',
      tier3_name: 'Grupo escala',
      tier4_name: 'Grupo masivo'
    },
    course: {
      hours: 4,
      enrollment_days: 45,
      approval_percent: 80,
      demo_days: 30,
      substitution_days: 7
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
        'Metodología práctica con estudios de caso, quizzes y retos',
        'Guías PDF y recursos de apoyo',
        'Encuesta de satisfacción al cierre',
        'Gamificación con puntos y ranking'
      ],
      standard: ['DNF incluida', 'Diseño del plan de capacitación'],
      scale: ['Cronograma de ejecución', 'Reporte analítico de la cohorte'],
      mass: ['Seguimiento ampliado de la cohorte', 'Consolidado ejecutivo de resultados']
    },
    commercial: {
      payment_methods: ['Binance Pay / USDT', 'PayPal', 'Transferencia bancaria / Pago Móvil'],
      chile_billing: 'Boleta Electrónica Fiscal conforme al esquema indicado.',
      venezuela_billing: 'Si se requiere factura fiscal local, el monto final podrá estar sujeto a los cargos fiscales, tributarios y administrativos que correspondan según el tipo de operación y la normativa vigente.',
      preliminary_note: 'Este documento es una estimación referencial generada por el cotizador y no constituye una factura, orden de compra ni aceptación contractual. La cotización formal puede variar por impuestos, personalización, alcance, facturación local u otros requerimientos específicos de la empresa.',
      technical_note: 'La formación asincrónica complementa la gestión de capacitación y no sustituye entrenamientos prácticos, inducciones específicas, demostraciones de competencia ni otras exigencias presenciales que correspondan al riesgo, tarea o normativa aplicable.'
    }
  };

  let currentConfig = structuredClone(DEFAULT_CONFIG);
  let client = null;
  let lastUpdatedAt = null;

  const clone = value => JSON.parse(JSON.stringify(value));
  const merge = (base, patch) => {
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
  };

  function getClient() {
    if (client) return client;
    if (!window.supabase?.createClient) return null;
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return client;
  }

  async function load() {
    const sb = getClient();
    if (!sb) return currentConfig;
    try {
      const { data, error } = await sb.rpc('presupuesto_config_publica');
      if (error) throw error;
      if (data?.config) currentConfig = merge(DEFAULT_CONFIG, data.config);
      lastUpdatedAt = data?.updated_at || null;
    } catch (error) {
      console.warn('No fue posible cargar la configuración remota del presupuesto. Se usarán los valores predeterminados.', error);
    }
    return currentConfig;
  }

  function get() { return currentConfig; }
  function getUpdatedAt() { return lastUpdatedAt; }

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
        name: p.tier4_name,
        price: Number(p.rate4),
        dnf: true,
        benefits: [...base, ...(b.standard || []), ...(b.scale || []), ...(b.mass || [])],
        planningScope: `Incluye todos los beneficios de las escalas anteriores, además de ${(b.mass || []).join(' y ').toLowerCase()}.`
      };
    }
    if (count >= p.tier2_max + 1) {
      return {
        name: p.tier3_name,
        price: Number(p.rate3),
        dnf: true,
        benefits: [...base, ...(b.standard || []), ...(b.scale || [])],
        planningScope: `Incluye todos los beneficios de la escala anterior, además de ${(b.scale || []).join(' y ').toLowerCase()}.`
      };
    }
    if (count >= p.tier1_max + 1) {
      return {
        name: p.tier2_name,
        price: Number(p.rate2),
        dnf: true,
        benefits: [...base, ...(b.standard || [])],
        planningScope: `Incluye todos los beneficios de la escala base, además de ${(b.standard || []).join(' y ').toLowerCase()}.`
      };
    }
    return {
      name: p.tier1_name,
      price: Number(p.rate1),
      dnf: false,
      benefits: base,
      planningScope: `Incluye ${base.join(', ').toLowerCase()}.`
    };
  }

  function calculate(count) {
    const p = currentConfig.pricing;
    const t1 = Math.min(count, p.tier1_max);
    const t2 = Math.max(0, Math.min(count, p.tier2_max) - p.tier1_max);
    const t3 = Math.max(0, Math.min(count, p.tier3_max) - p.tier2_max);
    const t4 = Math.max(0, count - p.tier3_max);
    const tranches = [
      { quantity: t1, rate: Number(p.rate1) },
      { quantity: t2, rate: Number(p.rate2) },
      { quantity: t3, rate: Number(p.rate3) },
      { quantity: t4, rate: Number(p.rate4) }
    ].filter(item => item.quantity > 0);
    const perCourse = tranches.reduce((sum, item) => sum + item.quantity * item.rate, 0);
    const marginalRate = count >= p.tier3_max + 1 ? Number(p.rate4)
      : count >= p.tier2_max + 1 ? Number(p.rate3)
      : count >= p.tier1_max + 1 ? Number(p.rate2)
      : Number(p.rate1);
    const averageRate = perCourse / count;
    const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
    const breakdown = tranches.map(item => `${item.quantity}×$${number.format(item.rate)}`).join(' + ');
    return { perCourse, marginalRate, averageRate, breakdown, tranches };
  }

  const setText = (selector, value) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  };

  function listHtml(items) {
    return (items || []).map(item => `<li>${String(item).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</li>`).join('');
  }

  function replaceTerm(containerSelector, label, value) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    const item = [...container.querySelectorAll('li')].find(li => li.querySelector('b')?.textContent.trim().startsWith(label));
    if (!item) return;
    const icon = item.querySelector('i')?.outerHTML || '';
    item.innerHTML = `${icon}<span><b>${label}:</b> ${value}</span>`;
  }

  function applyToDom() {
    const cfg = currentConfig;
    const p = cfg.pricing;
    const c = cfg.course;
    const b = cfg.benefits;
    const commercial = cfg.commercial;
    const ranges = rangeData();
    const priceCards = [...document.querySelectorAll('#planes .price-card')];

    ranges.forEach((range, index) => {
      const card = priceCards[index];
      if (!card) return;
      const rangeText = range.to ? `${range.from} a ${range.to} participantes` : `${range.from}+ participantes`;
      const trancheText = range.to ? (index === 0 ? `Tramo ${range.from}–${range.to}` : `Plazas ${range.from}–${range.to}`) : `Plazas ${range.from}+`;
      card.querySelector('.price-card__name') && (card.querySelector('.price-card__name').textContent = range.name);
      card.querySelector('.price-card__range') && (card.querySelector('.price-card__range').textContent = rangeText);
      card.querySelector('.price-card__list') && (card.querySelector('.price-card__list').textContent = trancheText);
      card.querySelector('.price-card__price') && (card.querySelector('.price-card__price').textContent = `$${range.rate}`);
      const ul = card.querySelector('.price-card__features');
      if (ul) ul.innerHTML = listHtml(b[range.benefitKey] || []);
    });

    const minHelp = document.getElementById('participantsHelp');
    if (minHelp) minHelp.textContent = `Mínimo de contratación: ${p.min_participants} participantes por cohorte.`;
    const partInput = document.getElementById('budgetParticipants');
    if (partInput) partInput.min = String(p.min_participants);
    const courseHelp = document.getElementById('coursesHelp');
    if (courseHelp) courseHelp.textContent = `Cada curso contempla ${c.hours} horas académicas y ${c.enrollment_days} días de matrícula.`;

    const proof = [...document.querySelectorAll('.hero__proof .proof strong')];
    if (proof[1]) proof[1].textContent = `${c.enrollment_days} días`;
    if (proof[2]) proof[2].textContent = `${c.approval_percent}%`;
    setText('.course-card__meta', `Microlearning · ${c.hours} horas académicas · evaluación final`);
    const noticeDemo = document.querySelector('.notice__inner > span:not(.notice__badge) strong');
    if (noticeDemo) noticeDemo.textContent = `${c.demo_days} días`;
    const demoTitle = document.getElementById('demo-title');
    if (demoTitle) demoTitle.textContent = `Demo Corporativo Gratuito por ${c.demo_days} Días`;

    const dnfStart = p.tier1_max + 1;
    const dnfEyebrow = document.querySelector('#dnf .eyebrow');
    if (dnfEyebrow) dnfEyebrow.innerHTML = `<i class="fa-solid fa-magnifying-glass-chart" aria-hidden="true"></i> Incluida desde ${dnfStart} participantes`;
    const dnfTag = document.querySelector('#dnf .dnf-side__tag');
    if (dnfTag) dnfTag.innerHTML = `<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Sin costo adicional en ${dnfStart}+`;
    const faqDetails = [...document.querySelectorAll('#faq details')];
    const dnfFaq = faqDetails.find(d => d.querySelector('summary')?.textContent.includes('DNF'));
    if (dnfFaq?.querySelector('p')) dnfFaq.querySelector('p').textContent = `Desde ${dnfStart} participantes la Detección de Necesidades de Formación se contempla sin costo adicional dentro de la propuesta descrita.`;

    replaceTerm('#condiciones .terms', 'Sustitución', `cambios de participantes sin costo durante los primeros ${c.substitution_days} días continuos de la cohorte.`);
    replaceTerm('#condiciones .terms', 'Aprobación', `evaluación automatizada con nota mínima del ${c.approval_percent}% para emisión del certificado.`);
    const webTechnical = document.querySelector('#condiciones .legal-note');
    if (webTechnical) webTechnical.innerHTML = `<b>Nota técnica:</b> ${commercial.technical_note}`;

    const paymentChips = document.querySelector('#condiciones .payment-chips');
    if (paymentChips) {
      paymentChips.innerHTML = (commercial.payment_methods || []).map((item, index) => `<span class="chip"><i class="fa-solid ${index === 0 ? 'fa-coins' : index === 1 ? 'fa-wallet' : 'fa-building-columns'}" aria-hidden="true"></i> ${item}</span>`).join('');
    }
    const taxBoxes = [...document.querySelectorAll('#condiciones .tax-box')];
    if (taxBoxes[0]) taxBoxes[0].innerHTML = `<b>Chile:</b> ${commercial.chile_billing}`;
    if (taxBoxes[1]) taxBoxes[1].innerHTML = `<b>Venezuela:</b> ${commercial.venezuela_billing}`;

    const example = document.querySelector('.pricing-cta__example');
    if (example) {
      const totalEl = example.querySelector('.pricing-cta__total strong');
      if (totalEl) totalEl.textContent = `$${Math.round(calculate(30).perCourse * 4).toLocaleString('en-US')}`;
    }

    const printIntro = document.querySelector('.print-proposal .print-intro');
    if (printIntro) printIntro.textContent = 'Estimación generada a partir del número de participantes y cursos seleccionados en el cotizador corporativo. El cálculo utiliza tarifas progresivas por tramos: cada tarifa se aplica únicamente a las plazas correspondientes a ese tramo.';

    const printIncludes = [...document.querySelectorAll('.print-proposal .print-includes .print-include')];
    if (printIncludes[1]) {
      const title = printIncludes[1].querySelector('b');
      const text = printIncludes[1].querySelector('span');
      if (title) title.textContent = `${c.hours} horas académicas por curso`;
      if (text) text.textContent = `Casos prácticos, guías PDF, quizzes, retos y gamificación; evaluación final y encuesta de satisfacción. ${c.enrollment_days} días de matrícula.`;
    }
    if (printIncludes[2]?.querySelector('span')) printIncludes[2].querySelector('span').textContent = `Criterio de aprobación mínimo del ${c.approval_percent}% para la emisión del certificado.`;

    const printDemo = document.querySelector('.print-page:first-of-type > .print-note');
    if (printDemo) printDemo.innerHTML = `<b>Demo corporativo:</b> la empresa puede solicitar una prueba piloto de ${c.demo_days} días para validar la experiencia de aprendizaje y la adopción antes de formalizar una contratación, de acuerdo con el alcance acordado.`;

    const rows = [
      document.getElementById('printTierSmall'),
      document.getElementById('printTierStandard'),
      document.getElementById('printTierScale'),
      document.getElementById('printTierMass')
    ];
    ranges.forEach((range, index) => {
      const row = rows[index];
      if (!row) return;
      const cells = row.querySelectorAll('td');
      if (cells[0]) cells[0].textContent = range.name;
      if (cells[1]) cells[1].textContent = range.to ? `${range.from} a ${range.to}` : `${range.from}+`;
      if (cells[2]) cells[2].textContent = index === 0 ? `$${range.rate} USD / plaza / curso` : `$${range.rate} USD / plaza adicional / curso`;
    });

    const printMuted = document.querySelector('.print-page:nth-of-type(2) .print-muted');
    if (printMuted) printMuted.textContent = `Mínimo de contratación: ${p.min_participants} participantes por cohorte. Modelo progresivo: cada tarifa se aplica solo a las plazas de su tramo; las plazas anteriores mantienen su tarifa al pasar de escala.`;

    const printBoxes = document.querySelectorAll('.print-page:nth-of-type(2) .print-two-col .print-box');
    if (printBoxes[0]) {
      const items = printBoxes[0].querySelectorAll('li');
      if (items[0]) items[0].textContent = `Incluida sin costo adicional desde ${dnfStart} participantes.`;
    }
    if (printBoxes[1]) {
      const list = printBoxes[1].querySelector('.print-list');
      if (list) list.innerHTML = `${(commercial.payment_methods || []).map(x => `<li>${x}.</li>`).join('')}<li><b>Chile:</b> ${commercial.chile_billing}</li><li><b>Venezuela:</b> ${commercial.venezuela_billing}</li>`;
    }

    replaceTerm('.print-page:nth-of-type(2) > .print-section.print-box .print-list', 'Sustitución', `cambios de participantes sin costo durante los primeros ${c.substitution_days} días continuos de la cohorte.`);
    replaceTerm('.print-page:nth-of-type(2) > .print-section.print-box .print-list', 'Período de matrícula', `${c.enrollment_days} días por curso, salvo un alcance distinto acordado expresamente.`);
    replaceTerm('.print-page:nth-of-type(2) > .print-section.print-box .print-list', 'Aprobación', `evaluación automatizada final con nota mínima del ${c.approval_percent}% para la emisión del certificado.`);

    const printNotes = [...document.querySelectorAll('.print-page:nth-of-type(2) .print-section .print-note')];
    if (printNotes[0]) printNotes[0].innerHTML = `<b>Carácter preliminar:</b> ${commercial.preliminary_note}`;
    if (printNotes[1]) printNotes[1].innerHTML = `<b>Nota técnica:</b> ${commercial.technical_note}`;
  }

  window.PresupuestoConfig = {
    DEFAULT_CONFIG: clone(DEFAULT_CONFIG),
    SUPABASE_URL,
    SUPABASE_KEY,
    getClient,
    load,
    get,
    getUpdatedAt,
    rangeData,
    getTier: tierFor,
    calculate,
    applyToDom
  };
})();
