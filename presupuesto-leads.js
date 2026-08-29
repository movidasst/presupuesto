(() => {
  const CATALOG_URL = 'https://lfdmbkzghnwvsapxypvt.supabase.co/functions/v1/presupuesto-catalogo-corporativo';
  const QUOTE_URL = 'https://lfdmbkzghnwvsapxypvt.supabase.co/functions/v1/presupuesto-propuesta-corporativa';
  const formStartedAt = Date.now();
  const $ = id => document.getElementById(id);
  let currentReference = '';
  let currentProspect = null;
  let backendReady = false;
  let catalogRows = [];
  let requestId = sessionStorage.getItem('movida_quote_request_id') || crypto.randomUUID();
  sessionStorage.setItem('movida_quote_request_id', requestId);

  const escapeHtml = value => window.PresupuestoConfig?.escapeHtml
    ? window.PresupuestoConfig.escapeHtml(value)
    : String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c]));

  function setStatus(message, type = 'info') {
    const el = $('leadStatus');
    if (!el) return;
    el.hidden = !message;
    el.className = `lead-status lead-status--${type}`;
    el.textContent = message;
  }

  function getBudgetNumbers() {
    const participantsInput = $('budgetParticipants');
    const coursesInput = $('budgetCourses');
    const cfg = window.PresupuestoConfig.get();
    const min = Number(cfg.pricing.min_participants || 3);
    const participants = Math.max(min, Math.min(10000, Math.trunc(Number(participantsInput?.value) || min)));
    const courses = Math.max(1, Math.min(100, Math.trunc(Number(coursesInput?.value) || 1)));
    return { participants, courses };
  }

  function queryAttribution() {
    const params = new URLSearchParams(location.search);
    const utmKeys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
    const utm = utmKeys.filter(k => params.get(k)).map(k => `${k}=${params.get(k)}`).join('&');
    let source = params.get('utm_source') || '';
    if (!source && document.referrer) {
      try { source = new URL(document.referrer).hostname; } catch (_) {}
    }
    return { source: source || 'directo', utm };
  }

  function selectedCourseRows() {
    return [...document.querySelectorAll('#courseCatalog input[type="checkbox"]:checked')].map(input => ({
      id: input.dataset.courseId ? Number(input.dataset.courseId) : null,
      name: input.value
    }));
  }

  function selectedTopicNames() {
    const names = selectedCourseRows().map(x => x.name);
    const custom = $('leadCustomTopic')?.value.trim();
    if (custom) names.push(custom);
    return [...new Set(names)];
  }

  function updateCourseSelectionState() {
    const counter = $('courseSelectionCounter');
    if (!counter) return true;
    const { courses } = getBudgetNumbers();
    const selected = selectedTopicNames().length;
    const ok = selected <= courses;
    counter.textContent = selected
      ? `${selected} tema${selected === 1 ? '' : 's'} seleccionado${selected === 1 ? '' : 's'} de ${courses} curso${courses === 1 ? '' : 's'} cotizado${courses === 1 ? '' : 's'}.`
      : `Puedes indicar hasta ${courses} tema${courses === 1 ? '' : 's'} o dejarlo por definir.`;
    counter.className = `course-selection-counter${ok ? '' : ' is-error'}`;
    return ok;
  }

  function renderCatalog(rows, fallback = false) {
    catalogRows = rows;
    const container = $('courseCatalog');
    if (!container) return;
    if (!rows.length) {
      container.innerHTML = '<p class="catalog-empty">No hay cursos corporativos publicados en este momento. Puedes escribir un tema o dejarlo por definir mediante DNF.</p>';
      return;
    }
    container.innerHTML = rows.map((row, index) => {
      const id = `catalogCourse${index}`;
      const courseId = row.id == null ? '' : String(row.id);
      return `<label class="catalog-option" for="${id}">
        <input id="${id}" type="checkbox" value="${escapeHtml(row.fullname)}" data-course-id="${escapeHtml(courseId)}">
        <span class="catalog-option__check"><i class="fa-solid fa-check" aria-hidden="true"></i></span>
        <span><strong>${escapeHtml(row.fullname)}</strong>${row.shortname ? `<small>${escapeHtml(row.shortname)}</small>` : ''}</span>
      </label>`;
    }).join('');
    const note = $('catalogSourceNote');
    if (note) note.textContent = fallback
      ? 'Mostramos los temas corporativos de respaldo mientras Moodle no responde.'
      : 'Catálogo sincronizado con Moodle · categoría Cursos corporativos.';
    container.querySelectorAll('input').forEach(input => input.addEventListener('change', updateCourseSelectionState));
    updateCourseSelectionState();
  }

  async function loadCatalog() {
    const container = $('courseCatalog');
    if (!container) return;
    try {
      const response = await fetch(CATALOG_URL, { headers: { accept: 'application/json' } });
      const data = await response.json();
      if (!response.ok || data.ok !== true) throw new Error(data.error || 'Catálogo no disponible');
      renderCatalog(Array.isArray(data.courses) ? data.courses : [], data.fallback === true);
    } catch (error) {
      const fallback = window.PresupuestoConfig.get().demo.topics.map(fullname => ({ id: null, fullname, shortname: '' }));
      renderCatalog(fallback, true);
    }
  }

  async function checkBackendReadiness() {
    const submit = $('leadSubmitBtn');
    const warning = $('commercialConfigWarning');
    const configReady = window.PresupuestoConfig.isRemoteReady();
    if (!configReady) {
      backendReady = false;
      if (warning) {
        warning.hidden = false;
        warning.textContent = 'La configuración comercial vigente no pudo validarse. Puedes explorar el cotizador, pero la propuesta formal está temporalmente deshabilitada.';
      }
      if (submit) submit.disabled = true;
      return;
    }
    try {
      const response = await fetch(QUOTE_URL, { headers: { accept: 'application/json' } });
      const data = await response.json();
      backendReady = response.ok && data.ready === true;
    } catch (_) {
      backendReady = false;
    }
    if (warning) {
      warning.hidden = backendReady;
      if (!backendReady) warning.textContent = 'El envío automático de propuestas está terminando de configurarse. El cotizador sigue disponible y puedes solicitar atención por WhatsApp.';
    }
    if (submit) submit.disabled = !backendReady;
  }

  function formData() {
    const { participants, courses } = getBudgetNumbers();
    const attribution = queryAttribution();
    return {
      empresa: $('leadCompany')?.value.trim() || '',
      contacto: $('leadContact')?.value.trim() || '',
      cargo: $('leadPosition')?.value.trim() || '',
      pais: $('leadCountry')?.value || '',
      whatsapp: $('leadWhatsapp')?.value.trim() || '',
      correo: $('leadEmail')?.value.trim() || '',
      participants,
      courses,
      selected_courses: selectedCourseRows(),
      custom_topic: $('leadCustomTopic')?.value.trim() || '',
      dnf_pending: $('leadDnfPending')?.checked === true,
      consent: $('leadConsent')?.checked === true,
      website: $('leadWebsite')?.value || '',
      form_started_ms: formStartedAt,
      request_id: requestId,
      source: attribution.source,
      utm: attribution.utm
    };
  }

  function syncPersonalizedPrint(data = formData()) {
    const set = (id, value) => { const el = $(id); if (el) el.textContent = value || '—'; };
    set('printCompany', data.empresa);
    set('printContact', data.contacto + (data.cargo ? ` · ${data.cargo}` : ''));
    set('printCountry', data.pais);
    set('printEmail', data.correo);
    set('printWhatsapp', data.whatsapp);
    const topics = selectedTopicNames();
    set('printCourseInterests', topics.length ? topics.join(' · ') : (data.dnf_pending ? 'Por definir mediante DNF' : 'Por definir con la empresa'));
    if (currentReference) {
      set('printReference', currentReference);
      set('printReference2', currentReference);
    }
  }

  function showSuccess(reference, message) {
    const box = $('leadSuccess');
    if (!box) return;
    box.hidden = false;
    const ref = $('leadSuccessReference');
    if (ref) ref.textContent = reference;
    const text = $('leadSuccessMessage');
    if (text) text.textContent = message || 'Revisa tu correo. También puedes imprimir una copia local con la misma referencia.';
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function submitLead(event) {
    event.preventDefault();
    const form = $('leadForm');
    if (!form) return;
    if (!form.reportValidity()) return;
    if (!updateCourseSelectionState()) {
      setStatus('Seleccionaste más temas que cursos. Ajusta la selección o aumenta la cantidad de cursos.', 'error');
      return;
    }
    if (!window.PresupuestoConfig.isRemoteReady() || !backendReady) {
      setStatus('La propuesta formal todavía no está disponible. Puedes utilizar WhatsApp para atención inmediata.', 'error');
      return;
    }
    const payload = formData();
    currentProspect = payload;
    syncPersonalizedPrint(payload);
    const button = $('leadSubmitBtn');
    const original = button?.innerHTML || '';
    if (button) { button.disabled = true; button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando propuesta…'; }
    setStatus('Validando precios, preparando el PDF y enviando el correo…', 'info');
    try {
      const response = await fetch(QUOTE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok !== true) throw new Error(data.error || 'No fue posible generar la propuesta.');
      currentReference = data.reference || '';
      syncPersonalizedPrint(payload);
      setStatus('Propuesta generada correctamente. Te enviamos una copia al correo indicado.', 'success');
      showSuccess(currentReference, data.message);
      requestId = crypto.randomUUID();
      sessionStorage.setItem('movida_quote_request_id', requestId);
    } catch (error) {
      setStatus(error.message || 'No fue posible generar la propuesta. Intenta nuevamente o contáctanos por WhatsApp.', 'error');
    } finally {
      if (button) { button.disabled = !backendReady; button.innerHTML = original; }
    }
  }

  function openLeadForm() {
    const quoteTab = document.querySelector('[data-mobile-view-target="quote"]');
    if (window.matchMedia('(max-width: 639px)').matches && quoteTab) quoteTab.click();
    const target = $('leadCapture');
    window.setTimeout(() => {
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      $('leadCompany')?.focus({ preventScroll: true });
    }, 80);
  }

  function printOfficialCopy() {
    if (!currentReference) {
      setStatus('Primero genera y envía la propuesta para obtener una referencia oficial.', 'error');
      openLeadForm();
      return;
    }
    syncPersonalizedPrint(currentProspect || formData());
    window.PresupuestoApp?.printBudgetProposal?.();
  }

  function setup() {
    const form = $('leadForm');
    form?.addEventListener('submit', submitLead);
    $('leadCustomTopic')?.addEventListener('input', () => { updateCourseSelectionState(); syncPersonalizedPrint(); });
    $('leadDnfPending')?.addEventListener('change', () => syncPersonalizedPrint());
    ['leadCompany','leadContact','leadPosition','leadCountry','leadWhatsapp','leadEmail'].forEach(id => $(id)?.addEventListener('input', () => syncPersonalizedPrint()));
    $('budgetCourses')?.addEventListener('input', updateCourseSelectionState);
    $('budgetCourses')?.addEventListener('change', updateCourseSelectionState);
    $('leadPrintCopyBtn')?.addEventListener('click', printOfficialCopy);
    loadCatalog();
    window.addEventListener('presupuesto:config-ready', checkBackendReadiness);
    window.setTimeout(checkBackendReadiness, 300);
  }

  window.PresupuestoLead = {
    openLeadForm,
    getReference: () => currentReference,
    getProspectData: () => currentProspect || formData(),
    syncPersonalizedPrint,
    printOfficialCopy,
    refreshReadiness: checkBackendReadiness
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
