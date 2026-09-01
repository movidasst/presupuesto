(() => {
  const CATALOG_URL = 'https://lfdmbkzghnwvsapxypvt.supabase.co/functions/v1/presupuesto-catalogo-corporativo';
  const QUOTE_URL = 'https://lfdmbkzghnwvsapxypvt.supabase.co/functions/v1/presupuesto-propuesta-corporativa';
  const DEMO_MAX_PARTICIPANTS = 20;
  const formStartedAt = Date.now();
  const $ = id => document.getElementById(id);
  let currentReference = '';
  let currentProspect = null;
  let backendReady = false;
  let catalogRows = [];
  let requestMode = 'quote';
  let requestId = sessionStorage.getItem('movida_quote_request_id') || crypto.randomUUID();
  sessionStorage.setItem('movida_quote_request_id', requestId);

  const escapeHtml = value => window.PresupuestoConfig?.escapeHtml
    ? window.PresupuestoConfig.escapeHtml(value)
    : String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;' }[c]));

  function isDemoMode() { return requestMode === 'demo'; }

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
    if (isDemoMode()) {
      const participants = Math.max(1, Math.min(DEMO_MAX_PARTICIPANTS, Math.trunc(Number(participantsInput?.value) || DEMO_MAX_PARTICIPANTS)));
      return { participants, courses: 1 };
    }
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
    if (!isDemoMode()) {
      const custom = $('leadCustomTopic')?.value.trim();
      if (custom) names.push(custom);
    }
    return [...new Set(names)];
  }

  function updateCourseSelectionState() {
    const counter = $('courseSelectionCounter');
    if (!counter) return true;
    const { courses } = getBudgetNumbers();
    const selected = selectedTopicNames().length;
    if (isDemoMode()) {
      const ok = selected === 1 && selectedCourseRows().length === 1;
      counter.textContent = selected === 1
        ? '1 curso seleccionado para el Demo Corporativo.'
        : 'Selecciona exactamente 1 curso para solicitar el Demo Corporativo.';
      counter.className = `course-selection-counter${ok ? '' : ' is-error'}`;
      return ok;
    }
    const ok = selected <= courses;
    counter.textContent = selected
      ? `${selected} tema${selected === 1 ? '' : 's'} seleccionado${selected === 1 ? '' : 's'} de ${courses} curso${courses === 1 ? '' : 's'} cotizado${courses === 1 ? '' : 's'}.`
      : `Puedes indicar hasta ${courses} tema${courses === 1 ? '' : 's'} o dejarlo por definir.`;
    counter.className = `course-selection-counter${ok ? '' : ' is-error'}`;
    return ok;
  }

  function handleCatalogSelection(event) {
    if (isDemoMode() && event.target.checked) {
      document.querySelectorAll('#courseCatalog input[type="checkbox"]').forEach(input => {
        if (input !== event.target) input.checked = false;
      });
    }
    updateCourseSelectionState();
    syncPersonalizedPrint();
  }

  function renderCatalog(rows, fallback = false) {
    catalogRows = rows;
    const container = $('courseCatalog');
    if (!container) return;
    if (!rows.length) {
      container.innerHTML = '<p class="catalog-empty">No hay cursos corporativos publicados en este momento.</p>';
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
    container.querySelectorAll('input').forEach(input => input.addEventListener('change', handleCatalogSelection));
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
        warning.textContent = 'La configuración comercial vigente no pudo validarse. Puedes explorar el cotizador, pero el envío está temporalmente deshabilitado.';
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
      if (!backendReady) warning.textContent = 'El envío automático está terminando de configurarse. Intenta nuevamente más tarde.';
    }
    if (submit) submit.disabled = !backendReady;
  }

  function formData() {
    const { participants, courses } = getBudgetNumbers();
    const attribution = queryAttribution();
    return {
      request_type: isDemoMode() ? 'demo' : 'quote',
      empresa: $('leadCompany')?.value.trim() || '',
      contacto: $('leadContact')?.value.trim() || '',
      cargo: $('leadPosition')?.value.trim() || '',
      pais: $('leadCountry')?.value || '',
      whatsapp: $('leadWhatsapp')?.value.trim() || '',
      correo: $('leadEmail')?.value.trim() || '',
      participants,
      courses,
      selected_courses: selectedCourseRows(),
      custom_topic: isDemoMode() ? '' : ($('leadCustomTopic')?.value.trim() || ''),
      dnf_pending: isDemoMode() ? false : $('leadDnfPending')?.checked === true,
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
    if (text) text.textContent = message || (isDemoMode()
      ? 'Recibimos tu solicitud de Demo Corporativo. La referencia quedó registrada para seguimiento.'
      : 'Revisa tu correo. También puedes imprimir una copia local con la misma referencia.');
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function submitLead(event) {
    event.preventDefault();
    const form = $('leadForm');
    if (!form) return;
    if (!form.reportValidity()) return;
    const { participants } = getBudgetNumbers();
    if (isDemoMode() && (participants < 1 || participants > DEMO_MAX_PARTICIPANTS)) {
      setStatus(`El Demo admite entre 1 y ${DEMO_MAX_PARTICIPANTS} participantes.`, 'error');
      return;
    }
    if (!updateCourseSelectionState()) {
      setStatus(isDemoMode()
        ? 'Para el Demo debes seleccionar exactamente 1 curso del catálogo.'
        : 'Seleccionaste más temas que cursos. Ajusta la selección o aumenta la cantidad de cursos.', 'error');
      return;
    }
    if (!window.PresupuestoConfig.isRemoteReady() || !backendReady) {
      setStatus('El envío automático todavía no está disponible. Intenta nuevamente más tarde.', 'error');
      return;
    }
    const payload = formData();
    currentProspect = payload;
    syncPersonalizedPrint(payload);
    const button = $('leadSubmitBtn');
    const original = button?.innerHTML || '';
    if (button) {
      button.disabled = true;
      button.innerHTML = isDemoMode()
        ? '<i class="fa-solid fa-spinner fa-spin"></i> Registrando solicitud…'
        : '<i class="fa-solid fa-spinner fa-spin"></i> Generando propuesta…';
    }
    setStatus(isDemoMode()
      ? 'Registrando la solicitud de Demo Corporativo…'
      : 'Validando precios, preparando el PDF y enviando el correo…', 'info');
    try {
      const response = await fetch(QUOTE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok !== true) throw new Error(data.error || 'No fue posible procesar la solicitud.');
      currentReference = data.reference || '';
      syncPersonalizedPrint(payload);
      setStatus(isDemoMode()
        ? 'Solicitud de Demo registrada correctamente.'
        : 'Propuesta generada correctamente. Te enviamos una copia al correo indicado.', 'success');
      showSuccess(currentReference, data.message);
      requestId = crypto.randomUUID();
      sessionStorage.setItem('movida_quote_request_id', requestId);
    } catch (error) {
      setStatus(error.message || 'No fue posible procesar la solicitud. Intenta nuevamente.', 'error');
    } finally {
      if (button) { button.disabled = !backendReady; button.innerHTML = original; }
    }
  }

  function openLeadForm() {
    if (window.PresupuestoTabs?.navigate) window.PresupuestoTabs.navigate('presupuesto', { scroll: false });
    else {
      const quoteTab = document.querySelector('[data-mobile-view-target="quote"]');
      if (window.matchMedia('(max-width: 639px)').matches && quoteTab) quoteTab.click();
    }
    const target = $('leadCapture');
    window.setTimeout(() => {
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      $('leadCompany')?.focus({ preventScroll: true });
    }, 80);
  }

  function rememberInputDefaults(input) {
    if (!input || input.dataset.demoDefaultsSaved) return;
    input.dataset.demoDefaultsSaved = '1';
    input.dataset.demoMin = input.min || '';
    input.dataset.demoMax = input.max || '';
    input.dataset.demoDisabled = input.disabled ? '1' : '0';
  }

  function restoreInputDefaults(input) {
    if (!input?.dataset.demoDefaultsSaved) return;
    input.min = input.dataset.demoMin;
    input.max = input.dataset.demoMax;
    input.disabled = input.dataset.demoDisabled === '1';
  }

  function injectModeSwitch() {
    if ($('requestModeSwitch')) return;
    const builder = document.querySelector('.budget-builder');
    if (!builder) return;
    const wrap = document.createElement('div');
    wrap.id = 'requestModeSwitch';
    wrap.className = 'request-mode-switch no-print';
    wrap.innerHTML = `
      <div class="request-mode-switch__copy">
        <strong>¿Qué quieres solicitar?</strong>
        <span>Elige una cotización normal o prueba un curso con tu equipo sin costo.</span>
      </div>
      <div class="request-mode-switch__buttons" role="group" aria-label="Tipo de solicitud">
        <button type="button" class="request-mode-btn is-active" data-request-mode="quote"><i class="fa-solid fa-calculator"></i><span>Cotización</span></button>
        <button type="button" class="request-mode-btn" data-request-mode="demo"><i class="fa-solid fa-flask"></i><span>Demo gratuito</span><small>$0</small></button>
      </div>`;
    builder.prepend(wrap);

    const style = document.createElement('style');
    style.id = 'requestModeStyles';
    style.textContent = `
      .request-mode-switch{grid-column:1/-1;margin:0 0 14px;padding:14px;border:1px solid #cfe4e4;border-radius:18px;background:linear-gradient(145deg,#f5fbfa,#fff);display:grid;gap:12px;box-shadow:0 8px 24px rgba(8,24,47,.05)}
      .request-mode-switch__copy strong{display:block;color:var(--navy);font-size:.82rem}.request-mode-switch__copy span{display:block;margin-top:3px;color:var(--muted);font-size:.69rem;line-height:1.4}
      .request-mode-switch__buttons{display:grid;grid-template-columns:1fr 1fr;gap:8px}.request-mode-btn{position:relative;min-height:48px;border:1px solid var(--line);border-radius:13px;background:#fff;color:var(--navy);font-weight:850;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer}.request-mode-btn i{color:var(--brand)}.request-mode-btn small{position:absolute;right:7px;top:6px;padding:2px 5px;border-radius:999px;background:#e9f8ef;color:#287a48;font-size:.55rem}.request-mode-btn.is-active{border-color:var(--brand);background:var(--soft-brand);box-shadow:0 0 0 3px rgba(15,118,110,.08)}
      body.demo-request-mode .budget-section{background:linear-gradient(180deg,#f7fbfa,#f3f7fa)}
      body.demo-request-mode .budget-primary-total{background:linear-gradient(135deg,#083c3b,#0f766e 72%,#3f8c63)}
      body.demo-request-mode #leadCustomTopic,body.demo-request-mode #leadCustomTopic+*{display:none}
      .demo-mode-note{margin:0 0 14px;padding:13px 14px;border-radius:14px;background:#eaf8ef;border:1px solid #c8e6d2;color:#286640;font-size:.75rem;line-height:1.5}.demo-mode-note strong{color:#164f31}
      @media(min-width:760px){.request-mode-switch{grid-template-columns:1fr auto;align-items:center}.request-mode-switch__buttons{min-width:370px}}
    `;
    document.head.appendChild(style);

    wrap.querySelectorAll('[data-request-mode]').forEach(button => button.addEventListener('click', () => setRequestMode(button.dataset.requestMode)));
  }

  function applyDemoPresentation() {
    if (!isDemoMode()) return;
    const { participants } = getBudgetNumbers();
    const set = (id, value) => { const el = $(id); if (el) el.textContent = value; };
    set('budgetTotal', '$0 USD');
    set('budgetParticipantDisplay', String(participants));
    set('budgetCourseDisplay', '1');
    set('budgetAveragePrice', '$0.00 USD');
    set('budgetTier', 'Demo Corporativo');
    set('budgetUnitPrice', '$0 USD');
    set('budgetSeats', String(participants));
    set('budgetDnf', 'No aplica');
    set('budgetPerCourse', '$0 USD');
    set('budgetProgressiveNote', `Demo gratuito: 1 curso · hasta ${DEMO_MAX_PARTICIPANTS} participantes · 30 días.`);
    const live = $('budgetLiveStatus');
    if (live) live.textContent = `Demo Corporativo sin costo para ${participants} participantes y 1 curso.`;
    const benefits = $('budgetBenefits');
    if (benefits) benefits.innerHTML = [
      '1 curso corporativo a elección',
      `Hasta ${DEMO_MAX_PARTICIPANTS} participantes`,
      '30 días de acceso',
      'Seguimiento, evaluación e informe final'
    ].map(item => `<span class="budget-benefit"><i class="fa-solid fa-check" aria-hidden="true"></i>${item}</span>`).join('');
    const totalBox = document.querySelector('.budget-primary-total');
    const totalLabel = totalBox?.querySelector('span');
    const totalSmall = totalBox?.querySelector('small');
    if (totalLabel) totalLabel.textContent = 'Costo del Demo Corporativo';
    if (totalSmall) totalSmall.textContent = `Piloto sin costo · 1 curso · máximo ${DEMO_MAX_PARTICIPANTS} participantes`;
    const summaryTitle = document.querySelector('.budget-summary__top h3');
    const summaryKicker = document.querySelector('.budget-summary__kicker');
    if (summaryTitle) summaryTitle.textContent = 'Demo Corporativo';
    if (summaryKicker) summaryKicker.textContent = 'Tu piloto';
  }

  function restoreQuotePresentation() {
    const totalBox = document.querySelector('.budget-primary-total');
    const totalLabel = totalBox?.querySelector('span');
    const totalSmall = totalBox?.querySelector('small');
    if (totalLabel) totalLabel.textContent = 'Inversión total estimada';
    if (totalSmall) totalSmall.textContent = 'Presupuesto preliminar · sin monto mínimo por orden';
    const summaryTitle = document.querySelector('.budget-summary__top h3');
    const summaryKicker = document.querySelector('.budget-summary__kicker');
    if (summaryTitle) summaryTitle.textContent = 'Presupuesto preliminar';
    if (summaryKicker) summaryKicker.textContent = 'Tu estimación';
    window.PresupuestoApp?.updateBudget?.({ normalize: true });
  }

  function updateLeadCopy() {
    const title = $('lead-title');
    const intro = document.querySelector('.lead-capture__intro p');
    const eyebrow = document.querySelector('.lead-capture__intro .eyebrow');
    const fieldset = document.querySelector('.course-interest');
    const legend = fieldset?.querySelector('legend');
    const help = fieldset?.querySelector(':scope > p');
    const customWrap = $('leadCustomTopic')?.closest('.lead-field');
    const dnfWrap = $('leadDnfPending')?.closest('.lead-check');
    const submit = $('leadSubmitBtn');
    const successLabel = $('leadSuccess')?.querySelector('span');
    const secondaryWhatsapp = document.querySelector('.lead-actions a.btn--whatsapp');
    const printCopy = $('leadPrintCopyBtn');
    const budgetContact = $('budgetWhatsappBtn');
    let note = $('demoModeNote');

    if (isDemoMode()) {
      if (eyebrow) eyebrow.innerHTML = '<i class="fa-solid fa-flask" aria-hidden="true"></i> Solicitud de Demo Corporativo';
      if (title) title.textContent = 'Solicita tu Demo Corporativo gratuito';
      if (intro) intro.textContent = `Completa los datos de la empresa, indica cuántas personas participarán y selecciona 1 curso. El Demo tiene costo USD 0 y admite un máximo de ${DEMO_MAX_PARTICIPANTS} participantes.`;
      if (legend) legend.innerHTML = 'Curso para el Demo <span style="color:#b42318">*</span>';
      if (help) help.textContent = 'Selecciona exactamente un curso del catálogo corporativo para el piloto.';
      if (customWrap) customWrap.hidden = true;
      if (dnfWrap) dnfWrap.hidden = true;
      if (submit) submit.innerHTML = '<i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Solicitar Demo gratuito';
      if (successLabel) successLabel.textContent = 'Demo solicitado';
      if (secondaryWhatsapp) secondaryWhatsapp.hidden = true;
      if (printCopy) printCopy.hidden = true;
      if (budgetContact) {
        budgetContact.classList.remove('btn--whatsapp');
        budgetContact.classList.add('btn--outline');
        budgetContact.removeAttribute('target');
        budgetContact.removeAttribute('rel');
        budgetContact.href = '#leadCapture';
        budgetContact.innerHTML = '<i class="fa-solid fa-arrow-right" aria-hidden="true"></i> Continuar solicitud Demo';
      }
      if (!note) {
        note = document.createElement('div');
        note.id = 'demoModeNote';
        note.className = 'demo-mode-note';
        $('leadForm')?.prepend(note);
      }
      note.hidden = false;
      note.innerHTML = `<strong>Demo Corporativo · USD 0</strong><br>1 curso · máximo ${DEMO_MAX_PARTICIPANTS} participantes · 30 días. La solicitud quedará registrada en el CRM para seguimiento.`;
    } else {
      if (eyebrow) eyebrow.innerHTML = '<i class="fa-solid fa-file-signature" aria-hidden="true"></i> Tu propuesta personalizada';
      if (title) title.textContent = 'Recibe el presupuesto con los datos de tu empresa';
      if (intro) intro.textContent = 'Ya hiciste el cálculo. Completa tus datos para generar una referencia única, guardar la propuesta y recibir el PDF por correo.';
      if (legend) legend.innerHTML = 'Cursos o temas de interés <small>Opcional</small>';
      if (help) help.textContent = 'Selecciona hasta la cantidad de cursos que cotizaste. El catálogo se sincroniza con Moodle; también puedes escribir otro tema o dejar parte del plan por definir mediante DNF.';
      if (customWrap) customWrap.hidden = false;
      if (dnfWrap) dnfWrap.hidden = false;
      if (submit) submit.innerHTML = '<i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Generar y enviarme mi propuesta';
      if (successLabel) successLabel.textContent = 'Propuesta enviada';
      if (secondaryWhatsapp) secondaryWhatsapp.hidden = false;
      if (printCopy) printCopy.hidden = false;
      if (budgetContact) {
        budgetContact.classList.remove('btn--outline');
        budgetContact.classList.add('btn--whatsapp');
        budgetContact.setAttribute('target', '_blank');
        budgetContact.setAttribute('rel', 'noopener');
        budgetContact.innerHTML = '<i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Solicitar cotización formal';
      }
      if (note) note.hidden = true;
    }
  }

  function setRequestMode(mode, options = {}) {
    const next = mode === 'demo' ? 'demo' : 'quote';
    requestMode = next;
    document.body.classList.toggle('demo-request-mode', isDemoMode());
    document.querySelectorAll('[data-request-mode]').forEach(button => button.classList.toggle('is-active', button.dataset.requestMode === next));

    const participantsInput = $('budgetParticipants');
    const coursesInput = $('budgetCourses');
    rememberInputDefaults(participantsInput);
    rememberInputDefaults(coursesInput);

    if (isDemoMode()) {
      if (participantsInput) {
        participantsInput.min = '1';
        participantsInput.max = String(DEMO_MAX_PARTICIPANTS);
        const current = Number(participantsInput.value);
        participantsInput.value = String(Number.isFinite(current) ? Math.max(1, Math.min(DEMO_MAX_PARTICIPANTS, Math.trunc(current))) : DEMO_MAX_PARTICIPANTS);
      }
      if (coursesInput) {
        coursesInput.min = '1';
        coursesInput.max = '1';
        coursesInput.value = '1';
      }
      const participantsHelp = $('participantsHelp');
      const coursesHelp = $('coursesHelp');
      if (participantsHelp) participantsHelp.textContent = `Demo: máximo ${DEMO_MAX_PARTICIPANTS} participantes.`;
      if (coursesHelp) coursesHelp.textContent = 'Demo: exactamente 1 curso.';
      $('leadCustomTopic') && ($('leadCustomTopic').value = '');
      $('leadDnfPending') && ($('leadDnfPending').checked = false);
      const checked = selectedCourseRows();
      if (checked.length > 1) checked.slice(1).forEach(row => {
        const input = [...document.querySelectorAll('#courseCatalog input[type="checkbox"]')].find(el => el.value === row.name);
        if (input) input.checked = false;
      });
      window.PresupuestoApp?.updateBudget?.({ normalize: true });
      window.setTimeout(applyDemoPresentation, 0);
    } else {
      restoreInputDefaults(participantsInput);
      restoreInputDefaults(coursesInput);
      const cfg = window.PresupuestoConfig.get();
      if (participantsInput && Number(participantsInput.value) < Number(cfg.pricing.min_participants || 3)) participantsInput.value = String(cfg.pricing.min_participants || 3);
      const participantsHelp = $('participantsHelp');
      const coursesHelp = $('coursesHelp');
      if (participantsHelp) participantsHelp.textContent = `Mínimo de contratación: ${cfg.pricing.min_participants || 3} participantes por cohorte.`;
      if (coursesHelp) coursesHelp.textContent = 'Cada curso contempla 4 horas académicas y 45 días de matrícula.';
      restoreQuotePresentation();
    }

    updateLeadCopy();
    updateCourseSelectionState();
    setStatus('', 'info');
    if (options.openForm) openLeadForm();
  }

  function wireDemoEntryPoints() {
    const demoButton = $('demoWhatsappBtn');
    if (demoButton) {
      demoButton.removeAttribute('target');
      demoButton.removeAttribute('rel');
      demoButton.href = '#presupuesto';
      demoButton.dataset.demoRequestEntry = '1';
      demoButton.innerHTML = '<i class="fa-solid fa-flask" aria-hidden="true"></i> Solicitar Demo';
    }

    const heroDemo = [...document.querySelectorAll('.hero__actions a')].find(a => /solicitar demo/i.test(a.textContent || ''));
    if (heroDemo) heroDemo.dataset.demoRequestEntry = '1';

    const budgetWhatsapp = $('budgetWhatsappBtn');
    budgetWhatsapp?.addEventListener('click', event => {
      if (!isDemoMode()) return;
      event.preventDefault();
      openLeadForm();
    });
  }

  function refreshModeAfterBudgetChange() {
    if (!isDemoMode()) return;
    const participants = $('budgetParticipants');
    const courses = $('budgetCourses');
    if (participants) {
      let value = Math.trunc(Number(participants.value));
      if (!Number.isFinite(value)) value = 1;
      value = Math.max(1, Math.min(DEMO_MAX_PARTICIPANTS, value));
      participants.value = String(value);
    }
    if (courses) courses.value = '1';
    window.setTimeout(applyDemoPresentation, 0);
    updateCourseSelectionState();
  }

  function printOfficialCopy() {
    if (isDemoMode()) {
      setStatus('La solicitud de Demo queda registrada en el CRM; no es necesario generar una propuesta comercial para el piloto.', 'info');
      return;
    }
    if (!currentReference) {
      setStatus('Primero genera y envía la propuesta para obtener una referencia oficial.', 'error');
      openLeadForm();
      return;
    }
    syncPersonalizedPrint(currentProspect || formData());
    window.PresupuestoApp?.printBudgetProposal?.();
  }

  function loadTabNavigation() {
    if (document.querySelector('script[data-presupuesto-tabs]')) return;
    const script = document.createElement('script');
    script.src = 'presupuesto-tabs.js?v=20260901-2';
    script.dataset.presupuestoTabs = '1';
    script.async = false;
    document.head.appendChild(script);
  }

  function setup() {
    injectModeSwitch();
    wireDemoEntryPoints();
    loadTabNavigation();
    const form = $('leadForm');
    form?.addEventListener('submit', submitLead);
    $('leadCustomTopic')?.addEventListener('input', () => { updateCourseSelectionState(); syncPersonalizedPrint(); });
    $('leadDnfPending')?.addEventListener('change', () => syncPersonalizedPrint());
    ['leadCompany','leadContact','leadPosition','leadCountry','leadWhatsapp','leadEmail'].forEach(id => $(id)?.addEventListener('input', () => syncPersonalizedPrint()));
    document.querySelectorAll('.stepper-btn').forEach(button => button.addEventListener('click', refreshModeAfterBudgetChange));
    ['budgetParticipants','budgetCourses'].forEach(id => {
      $(id)?.addEventListener('input', refreshModeAfterBudgetChange);
      $(id)?.addEventListener('change', refreshModeAfterBudgetChange);
      $(id)?.addEventListener('blur', refreshModeAfterBudgetChange);
    });
    $('leadPrintCopyBtn')?.addEventListener('click', printOfficialCopy);
    loadCatalog();
    window.addEventListener('presupuesto:config-ready', () => {
      checkBackendReadiness();
      if (isDemoMode()) setRequestMode('demo');
    });
    window.setTimeout(checkBackendReadiness, 300);
  }

  window.PresupuestoLead = {
    openLeadForm,
    getReference: () => currentReference,
    getProspectData: () => currentProspect || formData(),
    syncPersonalizedPrint,
    printOfficialCopy,
    refreshReadiness: checkBackendReadiness,
    setRequestMode,
    getRequestMode: () => requestMode
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
