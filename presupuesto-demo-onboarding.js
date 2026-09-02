(() => {
  'use strict';

  const API_URL = 'https://lfdmbkzghnwvsapxypvt.supabase.co/functions/v1/presupuesto-demo-onboarding';
  const XLSX_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  const STORAGE_KEY = 'movida_demo_onboarding_v2';
  const LEGACY_STORAGE_KEY = 'movida_demo_onboarding_v1';
  const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
  const MAX_PARTICIPANTS = 20;
  const HEADERS = ['Nombres','Apellidos','Tipo_documento','Documento','Correo','Telefono','Pais_ISO2','Cargo','Area'];
  const $ = id => document.getElementById(id);

  let state = null;
  let previewRows = [];
  let previewErrors = [];
  let previewWarnings = [];
  let manualRows = [];
  let xlsxPromise = null;

  const escapeHtml = value => window.PresupuestoConfig?.escapeHtml
    ? window.PresupuestoConfig.escapeHtml(value)
    : String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c]));

  function normalizeText(value, max = 500) {
    return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function canonicalHeader(value) {
    return normalizeText(value, 80)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function fieldValue(row, aliases) {
    const normalized = {};
    Object.keys(row || {}).forEach(key => { normalized[canonicalHeader(key)] = row[key]; });
    for (const alias of aliases) {
      const key = canonicalHeader(alias);
      if (normalized[key] != null && String(normalized[key]).trim() !== '') return normalized[key];
    }
    return '';
  }

  function normalizeParticipant(row) {
    return {
      nombres: normalizeText(fieldValue(row, ['Nombres','Nombre','First name','Firstname']), 120),
      apellidos: normalizeText(fieldValue(row, ['Apellidos','Apellido','Last name','Lastname']), 120),
      tipo_documento: normalizeText(fieldValue(row, ['Tipo_documento','Tipo documento','Tipo de documento']), 30),
      documento: normalizeText(fieldValue(row, ['Documento','Cedula','Cédula','ID','Identificacion','Identificación']), 80),
      correo: normalizeText(fieldValue(row, ['Correo','Email','E-mail','Correo electronico','Correo electrónico']), 254).toLowerCase(),
      telefono: normalizeText(fieldValue(row, ['Telefono','Teléfono','WhatsApp','Celular']), 40),
      pais_iso2: normalizeText(fieldValue(row, ['Pais_ISO2','Pais ISO2','País ISO2','Pais','País']), 2).toUpperCase(),
      cargo: normalizeText(fieldValue(row, ['Cargo','Puesto']), 120),
      area: normalizeText(fieldValue(row, ['Area','Área','Departamento','Gerencia']), 120),
    };
  }

  function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
  function removeAccents(value) { return normalizeText(value, 120).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function looksLikePersonName(value) {
    const v = removeAccents(value);
    if (!v || /\d|@/.test(v)) return false;
    const words = v.split(/[\s,]+/).filter(Boolean);
    return words.length >= 2 && words.every(word => /^[A-Za-z'-]{2,}$/.test(word));
  }
  function looksLikeEmail(value) { return /@/.test(String(value || '')); }
  function looksLikeDocument(value) {
    const v = normalizeText(value, 80);
    if (!v) return false;
    return /\d/.test(v) && !/@/.test(v) && /^[A-Za-z0-9.\-_/\s]+$/.test(v);
  }
  function normalizeGenericDocument(value) {
    return normalizeText(value, 80).toUpperCase().replace(/[\s.]+/g, '');
  }
  function normalizeVenezuelanDocument(value) {
    return normalizeText(value, 80).toUpperCase().replace(/[.\s-]+/g, '');
  }
  function normalizeChileanRut(value) {
    const compact = normalizeText(value, 80).toUpperCase().replace(/[.\s]+/g, '');
    const raw = compact.replace(/-/g, '');
    if (raw.length < 2) return compact;
    return `${raw.slice(0, -1)}-${raw.slice(-1)}`;
  }
  function validChileanRut(value) {
    const normalized = normalizeChileanRut(value);
    const match = normalized.match(/^(\d{7,8})-([0-9K])$/);
    if (!match) return false;
    const body = match[1];
    const dv = match[2];
    let sum = 0;
    let multiplier = 2;
    for (let i = body.length - 1; i >= 0; i--) {
      sum += Number(body[i]) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }
    const remainder = 11 - (sum % 11);
    const expected = remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);
    return expected === dv;
  }

  function validateDocument(row, line, errors, warnings) {
    const raw = normalizeText(row.documento, 80);
    if (!raw) return;
    const type = removeAccents(row.tipo_documento).toLowerCase();
    const country = row.pais_iso2;

    if (looksLikeEmail(raw)) {
      errors.push(`Fila ${line}: Documento contiene un correo electrónico; revisa si las columnas están desplazadas.`);
      return;
    }
    if (looksLikePersonName(raw)) {
      errors.push(`Fila ${line}: “${raw}” parece un nombre, no un documento. Revisa la columna Documento/Cédula.`);
      return;
    }

    const isRut = type.includes('rut') || (country === 'CL' && /[-Kk.]/.test(raw));
    const isVenezuelanId = country === 'VE' && (!type || type.includes('cedula') || type.includes('ci') || type.includes('identidad'));

    if (isRut) {
      const normalized = normalizeChileanRut(raw);
      if (!validChileanRut(normalized)) {
        errors.push(`Fila ${line}: el RUT chileno “${raw}” no tiene un formato o dígito verificador válido.`);
        return;
      }
      if (normalized !== raw.toUpperCase()) warnings.push(`Fila ${line}: RUT “${raw}” se normalizará como “${normalized}”.`);
      row.documento = normalized;
      return;
    }

    if (isVenezuelanId) {
      const normalized = normalizeVenezuelanDocument(raw);
      if (!/^[VE]?[0-9]{5,9}$/.test(normalized)) {
        errors.push(`Fila ${line}: la cédula venezolana “${raw}” no parece válida. Puede usar solo números o prefijo V/E; los puntos son aceptados.`);
        return;
      }
      if (normalized !== raw.toUpperCase()) warnings.push(`Fila ${line}: cédula “${raw}” se guardará normalizada como “${normalized}”.`);
      row.documento = normalized;
      return;
    }

    if (!looksLikeDocument(raw)) {
      errors.push(`Fila ${line}: Documento contiene caracteres o texto que no parecen corresponder a una identificación.`);
      return;
    }
    const normalized = normalizeGenericDocument(raw);
    if (normalized.length < 4) warnings.push(`Fila ${line}: Documento “${raw}” parece demasiado corto; conviene revisarlo.`);
    if (normalized !== raw.toUpperCase()) warnings.push(`Fila ${line}: Documento “${raw}” se normalizará como “${normalized}”.`);
    row.documento = normalized;
  }

  function validateNameField(value, label, line, errors) {
    if (!value) {
      errors.push(`Fila ${line}: falta ${label}.`);
      return;
    }
    if (looksLikeEmail(value)) errors.push(`Fila ${line}: ${label} contiene un correo; revisa si las columnas están desplazadas.`);
    if (/\d{3,}/.test(value)) errors.push(`Fila ${line}: ${label} contiene demasiados números y no parece un nombre válido.`);
  }

  function validateRows(rows) {
    const errors = [];
    const warnings = [];
    const normalized = rows.map((raw, index) => {
      const row = normalizeParticipant(raw);
      const line = index + 2;
      validateNameField(row.nombres, 'Nombres', line, errors);
      validateNameField(row.apellidos, 'Apellidos', line, errors);
      if (!row.correo) errors.push(`Fila ${line}: falta Correo.`);
      else if (!validEmail(row.correo)) errors.push(`Fila ${line}: el correo “${row.correo}” no es válido.`);
      if (row.pais_iso2 && !/^[A-Z]{2}$/.test(row.pais_iso2)) errors.push(`Fila ${line}: País ISO2 debe tener 2 letras, por ejemplo CL o VE.`);
      validateDocument(row, line, errors, warnings);
      return row;
    });

    const emails = new Map();
    const documents = new Map();
    normalized.forEach((row, index) => {
      const line = index + 2;
      if (row.correo) {
        if (emails.has(row.correo)) errors.push(`Fila ${line}: el correo ${row.correo} está duplicado (también aparece en la fila ${emails.get(row.correo)}).`);
        else emails.set(row.correo, line);
      }
      if (row.documento) {
        if (documents.has(row.documento)) errors.push(`Fila ${line}: el documento ${row.documento} está duplicado (también aparece en la fila ${documents.get(row.documento)}).`);
        else documents.set(row.documento, line);
      }
    });

    return { rows: normalized, errors, warnings };
  }

  function persistState(next) {
    state = next ? { ...next, manual_rows: manualRows, saved_at: Date.now() } : null;
    try {
      if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      else localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (_) {}
  }

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || 'null');
      if (!raw || !raw.reference || !raw.upload_token || !raw.saved_at) return null;
      if (Date.now() - Number(raw.saved_at) > MAX_AGE_MS) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return null;
      }
      manualRows = Array.isArray(raw.manual_rows) ? raw.manual_rows.slice(0, MAX_PARTICIPANTS) : [];
      return raw;
    } catch (_) {
      return null;
    }
  }

  function expectedCount() {
    return Math.max(1, Math.min(MAX_PARTICIPANTS, Number(state?.expected_participants || state?.expected || MAX_PARTICIPANTS)));
  }

  function injectStyles() {
    if ($('demoOnboardingStyles')) return;
    const style = document.createElement('style');
    style.id = 'demoOnboardingStyles';
    style.textContent = `
      .demo-onboarding{margin:20px 0 0;border:1px solid #cce4e1;border-radius:22px;background:#fff;box-shadow:0 18px 48px rgba(8,24,47,.09);overflow:hidden;color:var(--ink)}
      .demo-onboarding__hero{padding:20px;background:linear-gradient(135deg,#073f3d,#0f766e 72%,#4d8b5b);color:#fff;display:grid;gap:15px}
      .demo-onboarding__badge{display:inline-flex;width:max-content;align-items:center;gap:7px;padding:6px 9px;border-radius:999px;background:rgba(255,255,255,.14);font-size:.68rem;font-weight:900;letter-spacing:.06em;text-transform:uppercase}
      .demo-onboarding__hero h3{margin:0;font-size:clamp(1.35rem,4vw,1.85rem);line-height:1.12;color:#fff}.demo-onboarding__hero p{margin:0;color:#e4f7f4;font-size:.84rem;line-height:1.6;max-width:72ch}
      .demo-onboarding__facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.demo-onboarding__fact{padding:10px;border-radius:13px;background:rgba(255,255,255,.10);min-width:0}.demo-onboarding__fact span{display:block;font-size:.58rem;text-transform:uppercase;letter-spacing:.05em;color:#bfe9e4;font-weight:850}.demo-onboarding__fact strong{display:block;margin-top:3px;font-size:.78rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .demo-onboarding__body{padding:18px;display:grid;gap:16px}.demo-onboarding__notice{padding:14px;border-radius:15px;background:#f4faf9;border:1px solid #d8ebe8;color:#355b61;font-size:.76rem;line-height:1.55}.demo-onboarding__notice strong{color:#173e47}.demo-onboarding__notice i{color:var(--brand);margin-right:6px}
      .demo-onboarding__steps{display:grid;gap:10px}.demo-onboarding__step{display:grid;grid-template-columns:38px 1fr;gap:10px;align-items:start;padding:13px;border:1px solid #e1e9ee;border-radius:15px;background:#fff}.demo-onboarding__stepno{width:38px;height:38px;border-radius:12px;background:#eaf7f5;color:var(--brand);display:grid;place-items:center;font-weight:900}.demo-onboarding__step strong{display:block;color:var(--navy);font-size:.82rem}.demo-onboarding__step p{margin:3px 0 0;color:var(--muted);font-size:.7rem;line-height:1.45}
      .demo-upload-panel{border-top:1px solid #e5ecef;padding-top:16px}.demo-upload-panel__head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:12px}.demo-upload-panel__head h4{margin:0;color:var(--navy);font-size:1rem}.demo-upload-panel__head p{margin:3px 0 0;color:var(--muted);font-size:.69rem}.demo-progress{flex:0 0 auto;font-weight:900;color:var(--brand);font-size:.78rem;background:#eef9f7;padding:6px 9px;border-radius:999px}
      .demo-methods{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}.demo-method{min-height:50px;border:1px solid #dbe6ea;border-radius:14px;background:#fff;color:#526779;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:850;font-size:.74rem;cursor:pointer}.demo-method.is-active{border-color:#95cbc4;background:#ecf8f6;color:#0b5d57;box-shadow:0 0 0 2px rgba(15,118,110,.05)}
      .demo-method-panel[hidden]{display:none!important}.demo-upload-actions{display:grid;gap:9px}.demo-onboarding .demo-action{min-height:48px;border-radius:13px;border:1px solid var(--line);padding:0 13px;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:850;font-size:.76rem;cursor:pointer;background:#fff;color:var(--navy)}.demo-onboarding .demo-action--primary{background:var(--brand);border-color:var(--brand);color:#fff}.demo-onboarding .demo-action--soft{background:#f4faf9;border-color:#cae6e2;color:#0b5d57}.demo-onboarding .demo-action--danger{background:#fff5f4;border-color:#f1cac5;color:#9b2c21}.demo-onboarding .demo-action:disabled{opacity:.55;cursor:not-allowed}
      .demo-manual-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:14px;border:1px solid #dce8ec;border-radius:16px;background:#f9fbfc}.demo-field{display:grid;gap:5px;min-width:0}.demo-field--full{grid-column:1/-1}.demo-field label{font-size:.62rem;font-weight:850;color:#526779}.demo-field input,.demo-field select{width:100%;min-height:43px;border:1px solid #cedbe2;border-radius:11px;background:#fff;padding:9px 10px;color:var(--ink);font-size:.76rem}.demo-field input:focus,.demo-field select:focus{border-color:#78bdb5;outline:3px solid rgba(15,118,110,.09)}
      .demo-manual-actions{grid-column:1/-1;display:grid;grid-template-columns:1fr auto;gap:8px}.demo-manual-feedback{grid-column:1/-1;padding:10px 12px;border-radius:12px;background:#f3f7fa;color:#526779;font-size:.69rem;line-height:1.45}.demo-manual-feedback.is-error{background:#fff1f0;color:#9b2c21}.demo-manual-feedback.is-ok{background:#eef9f2;color:#296840}.demo-manual-list{display:grid;gap:8px;margin-top:12px}.demo-person{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px;border:1px solid #e0e8ed;border-radius:14px;background:#fff}.demo-person__no{width:42px;height:42px;border-radius:12px;background:#edf7f5;color:var(--brand);display:grid;place-items:center;font-weight:900;font-size:.78rem}.demo-person__main{min-width:0}.demo-person__main strong{display:block;color:var(--navy);font-size:.76rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.demo-person__main span{display:block;margin-top:2px;color:var(--muted);font-size:.64rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.demo-person__remove{width:40px;height:40px;border:1px solid #eed0cc;border-radius:11px;background:#fff7f6;color:#a23b31;cursor:pointer}
      .demo-dropzone{position:relative;border:1.5px dashed #9ccbc5;border-radius:16px;background:#f8fcfb;padding:18px;text-align:center;color:#486f73;transition:.15s ease}.demo-dropzone.is-dragover{border-color:var(--brand);background:#eaf7f5;transform:translateY(-1px)}.demo-dropzone i{font-size:1.35rem;color:var(--brand)}.demo-dropzone strong{display:block;margin-top:6px;color:var(--navy);font-size:.8rem}.demo-dropzone small{display:block;margin-top:3px;font-size:.65rem}.demo-dropzone input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
      .demo-file-state{margin-top:10px;padding:10px 12px;border-radius:12px;background:#f6f8fa;color:#526779;font-size:.7rem;line-height:1.45}.demo-file-state.is-error{background:#fff1f0;color:#9b2c21}.demo-file-state.is-ok{background:#eef9f2;color:#296840}.demo-file-state.is-warn{background:#fff8e7;color:#7b5a16}
      .demo-preview{margin-top:12px;border:1px solid #e1e8ed;border-radius:14px;overflow:hidden;background:#fff}.demo-preview__summary{padding:10px 12px;background:#f6f9fb;border-bottom:1px solid #e1e8ed;display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:.69rem}.demo-preview__summary strong{color:var(--navy)}.demo-preview__scroll{overflow:auto;max-height:260px}.demo-preview table{width:100%;border-collapse:collapse;font-size:.65rem;min-width:660px}.demo-preview th,.demo-preview td{padding:8px 9px;border-bottom:1px solid #edf1f4;text-align:left;vertical-align:top}.demo-preview th{position:sticky;top:0;background:#fff;color:#506477;font-size:.58rem;text-transform:uppercase;letter-spacing:.04em;z-index:1}.demo-preview tr.is-error td{background:#fff7f6}.demo-preview__errors,.demo-preview__warnings{padding:10px 12px;font-size:.68rem;line-height:1.5}.demo-preview__errors{background:#fff5f4;color:#8c3028}.demo-preview__warnings{background:#fff9e9;color:#755a18;border-top:1px solid #f0dfad}
      .demo-final-message{padding:16px;border-radius:16px;background:#eef9f2;border:1px solid #cce5d3;color:#285c3a;font-size:.76rem;line-height:1.62}.demo-final-message strong{color:#174b2c}.demo-final-message ul{margin:8px 0 0;padding-left:18px}.demo-final-message[hidden]{display:none!important}
      @media(min-width:720px){.demo-onboarding__facts{grid-template-columns:repeat(4,minmax(0,1fr))}.demo-onboarding__steps{grid-template-columns:repeat(3,minmax(0,1fr))}.demo-upload-actions{grid-template-columns:1fr 1fr}.demo-manual-form{grid-template-columns:repeat(3,minmax(0,1fr))}.demo-field--full{grid-column:auto}.demo-field--wide{grid-column:span 2}.demo-manual-actions{grid-column:1/-1}}
      @media(max-width:540px){.demo-onboarding__body{padding:14px}.demo-onboarding__hero{padding:17px}.demo-methods{grid-template-columns:1fr}.demo-manual-form{grid-template-columns:1fr}.demo-field--full,.demo-field--wide{grid-column:1}.demo-manual-actions{grid-template-columns:1fr}.demo-person{grid-template-columns:38px minmax(0,1fr) 38px}.demo-person__no{width:38px;height:38px}.demo-person__remove{width:38px;height:38px}}
    `;
    document.head.appendChild(style);
  }

  function statusLabel(value) {
    const labels = {
      participantes_pendientes: 'Lista pendiente',
      participantes_parciales: 'Lista parcial',
      participantes_recibidos: 'Participantes recibidos',
      revision: 'En revisión',
      aprobado: 'Demo aprobado',
      matriculando: 'Preparando matrículas',
      activo: 'Demo activo',
      rechazado: 'No aprobado',
      cancelado: 'Cancelado'
    };
    return labels[value] || 'Pendiente de confirmación';
  }

  function ensureCard() {
    injectStyles();
    let card = $('demoOnboardingCard');
    if (card) return card;
    card = document.createElement('section');
    card.id = 'demoOnboardingCard';
    card.className = 'demo-onboarding no-print';
    const anchor = $('leadSuccess') || $('leadCapture') || document.querySelector('#presupuesto .container') || document.querySelector('#presupuesto');
    if (anchor) anchor.insertAdjacentElement('afterend', card);
    return card;
  }

  function renderCard() {
    if (!state) return;
    const card = ensureCard();
    const expected = expectedCount();
    const received = Number(state.received_participants ?? state.received ?? 0);
    const selectedMethod = state.entry_method === 'excel' ? 'excel' : 'manual';
    card.innerHTML = `
      <div class="demo-onboarding__hero">
        <span class="demo-onboarding__badge"><i class="fa-solid fa-circle-check"></i> Solicitud Demo recibida</span>
        <div>
          <h3>Ahora agrega a tu equipo</h3>
          <p>Puedes ingresar los participantes uno por uno o cargar la plantilla Excel. En ambos casos validaremos los datos antes de dejarlos pendientes de aprobación.</p>
        </div>
        <div class="demo-onboarding__facts">
          <div class="demo-onboarding__fact"><span>Referencia</span><strong>${escapeHtml(state.reference)}</strong></div>
          <div class="demo-onboarding__fact"><span>Curso</span><strong>${escapeHtml(state.course_name || 'Curso seleccionado')}</strong></div>
          <div class="demo-onboarding__fact"><span>Participantes</span><strong>${received} / ${expected}</strong></div>
          <div class="demo-onboarding__fact"><span>Estado</span><strong>${escapeHtml(statusLabel(state.status))}</strong></div>
        </div>
      </div>
      <div class="demo-onboarding__body">
        <div class="demo-onboarding__notice"><i class="fa-solid fa-shield-halved"></i><strong>No se matricula automáticamente en Moodle.</strong> La información queda en pre-matrícula y Academia Movida SST confirma el Demo antes de crear o matricular usuarios.</div>
        <div class="demo-onboarding__steps">
          <div class="demo-onboarding__step"><span class="demo-onboarding__stepno">1</span><div><strong>Agrega participantes</strong><p>Manual o Excel, hasta ${expected} personas.</p></div></div>
          <div class="demo-onboarding__step"><span class="demo-onboarding__stepno">2</span><div><strong>Validamos la lista</strong><p>Correos, duplicados y documentos se revisan antes de guardar.</p></div></div>
          <div class="demo-onboarding__step"><span class="demo-onboarding__stepno">3</span><div><strong>Confirmamos el Demo</strong><p>Luego se coordinan fechas, accesos al tablero y matrícula.</p></div></div>
        </div>
        <div class="demo-upload-panel">
          <div class="demo-upload-panel__head"><div><h4>¿Cómo quieres agregar a los participantes?</h4><p>Elige la opción más cómoda para tu empresa.</p></div><span class="demo-progress">${received} / ${expected}</span></div>
          <div class="demo-methods" role="tablist" aria-label="Forma de agregar participantes">
            <button type="button" class="demo-method${selectedMethod === 'manual' ? ' is-active' : ''}" data-demo-method="manual"><i class="fa-solid fa-user-plus"></i> Agregar manualmente</button>
            <button type="button" class="demo-method${selectedMethod === 'excel' ? ' is-active' : ''}" data-demo-method="excel"><i class="fa-solid fa-file-excel"></i> Subir Excel</button>
          </div>
          <div id="demoManualPanel" class="demo-method-panel"${selectedMethod === 'manual' ? '' : ' hidden'}></div>
          <div id="demoExcelPanel" class="demo-method-panel"${selectedMethod === 'excel' ? '' : ' hidden'}></div>
        </div>
        <div id="demoFinalMessage" class="demo-final-message"${received ? '' : ' hidden'}></div>
      </div>`;

    card.querySelectorAll('[data-demo-method]').forEach(button => button.addEventListener('click', () => switchMethod(button.dataset.demoMethod)));
    renderManualPanel();
    renderExcelPanel();
    renderFinalMessage();
  }

  function switchMethod(method) {
    if (!state) return;
    state.entry_method = method === 'excel' ? 'excel' : 'manual';
    persistState(state);
    document.querySelectorAll('[data-demo-method]').forEach(button => button.classList.toggle('is-active', button.dataset.demoMethod === state.entry_method));
    const manual = $('demoManualPanel');
    const excel = $('demoExcelPanel');
    if (manual) manual.hidden = state.entry_method !== 'manual';
    if (excel) excel.hidden = state.entry_method !== 'excel';
  }

  function manualInputRow() {
    return {
      nombres: normalizeText($('demoManualNombres')?.value, 120),
      apellidos: normalizeText($('demoManualApellidos')?.value, 120),
      tipo_documento: normalizeText($('demoManualTipoDocumento')?.value, 30),
      documento: normalizeText($('demoManualDocumento')?.value, 80),
      correo: normalizeText($('demoManualCorreo')?.value, 254).toLowerCase(),
      telefono: normalizeText($('demoManualTelefono')?.value, 40),
      pais_iso2: normalizeText($('demoManualPais')?.value, 2).toUpperCase(),
      cargo: normalizeText($('demoManualCargo')?.value, 120),
      area: normalizeText($('demoManualArea')?.value, 120),
    };
  }

  function renderManualPanel() {
    const panel = $('demoManualPanel');
    if (!panel || !state) return;
    const expected = expectedCount();
    const remaining = Math.max(0, expected - manualRows.length);
    panel.innerHTML = `
      <div class="demo-manual-form">
        <div class="demo-field"><label for="demoManualNombres">Nombres *</label><input id="demoManualNombres" autocomplete="given-name" maxlength="120"></div>
        <div class="demo-field"><label for="demoManualApellidos">Apellidos *</label><input id="demoManualApellidos" autocomplete="family-name" maxlength="120"></div>
        <div class="demo-field"><label for="demoManualCorreo">Correo *</label><input id="demoManualCorreo" type="email" autocomplete="email" maxlength="254"></div>
        <div class="demo-field"><label for="demoManualTipoDocumento">Tipo de documento</label><select id="demoManualTipoDocumento"><option value="">Seleccionar</option><option>Cédula</option><option>RUT</option><option>DNI</option><option>Pasaporte</option><option>Otro</option></select></div>
        <div class="demo-field"><label for="demoManualDocumento">Documento / Cédula</label><input id="demoManualDocumento" maxlength="80" placeholder="Ej. 12.345.678"></div>
        <div class="demo-field"><label for="demoManualPais">País ISO2</label><input id="demoManualPais" maxlength="2" placeholder="VE, CL, CO…" autocapitalize="characters"></div>
        <div class="demo-field"><label for="demoManualTelefono">Teléfono</label><input id="demoManualTelefono" maxlength="40" inputmode="tel"></div>
        <div class="demo-field"><label for="demoManualCargo">Cargo</label><input id="demoManualCargo" maxlength="120"></div>
        <div class="demo-field"><label for="demoManualArea">Área / Departamento</label><input id="demoManualArea" maxlength="120"></div>
        <div id="demoManualFeedback" class="demo-manual-feedback">${remaining ? `Puedes agregar ${remaining} participante${remaining === 1 ? '' : 's'} más.` : 'Ya completaste la cantidad prevista.'}</div>
        <div class="demo-manual-actions">
          <button type="button" id="demoManualAddBtn" class="demo-action demo-action--soft"${remaining ? '' : ' disabled'}><i class="fa-solid fa-user-plus"></i> Agregar participante</button>
          <button type="button" id="demoManualSendBtn" class="demo-action demo-action--primary"${manualRows.length ? '' : ' disabled'}><i class="fa-solid fa-paper-plane"></i> Enviar ${manualRows.length || ''} participante${manualRows.length === 1 ? '' : 's'}</button>
        </div>
      </div>
      <div id="demoManualList" class="demo-manual-list"></div>`;

    $('demoManualAddBtn')?.addEventListener('click', addManualParticipant);
    $('demoManualSendBtn')?.addEventListener('click', () => sendParticipants(manualRows, 'manual'));
    renderManualList();
  }

  function setManualFeedback(message, type = '') {
    const el = $('demoManualFeedback');
    if (!el) return;
    el.className = `demo-manual-feedback${type ? ` is-${type}` : ''}`;
    el.textContent = message;
  }

  function clearManualInputs() {
    ['demoManualNombres','demoManualApellidos','demoManualCorreo','demoManualDocumento','demoManualPais','demoManualTelefono','demoManualCargo','demoManualArea'].forEach(id => { const el = $(id); if (el) el.value = ''; });
    const type = $('demoManualTipoDocumento');
    if (type) type.value = '';
    $('demoManualNombres')?.focus();
  }

  function addManualParticipant() {
    if (manualRows.length >= expectedCount()) {
      setManualFeedback('Ya alcanzaste la cantidad de participantes prevista para este Demo.', 'error');
      return;
    }
    const candidate = manualInputRow();
    const combined = [...manualRows, candidate];
    const result = validateRows(combined);
    const newLine = combined.length + 1;
    const relevantErrors = result.errors.filter(message => message.startsWith(`Fila ${newLine}:`));
    if (relevantErrors.length) {
      setManualFeedback(relevantErrors[0].replace(`Fila ${newLine}: `, ''), 'error');
      return;
    }
    if (result.errors.length) {
      setManualFeedback(result.errors[0], 'error');
      return;
    }
    manualRows = result.rows;
    persistState(state);
    renderManualPanel();
    const warning = result.warnings.find(message => message.startsWith(`Fila ${newLine}:`));
    setManualFeedback(warning ? warning.replace(`Fila ${newLine}: `, '') : 'Participante agregado correctamente.', warning ? '' : 'ok');
    clearManualInputs();
  }

  function removeManualParticipant(index) {
    manualRows.splice(index, 1);
    persistState(state);
    renderManualPanel();
    setManualFeedback('Participante eliminado de la lista.');
  }

  function renderManualList() {
    const list = $('demoManualList');
    if (!list) return;
    if (!manualRows.length) {
      list.innerHTML = '<div class="demo-file-state">Aún no has agregado participantes manualmente.</div>';
      return;
    }
    list.innerHTML = manualRows.map((row, index) => `
      <div class="demo-person">
        <span class="demo-person__no">${index + 1}</span>
        <div class="demo-person__main"><strong>${escapeHtml(`${row.nombres} ${row.apellidos}`)}</strong><span>${escapeHtml(row.correo)}${row.documento ? ` · ${escapeHtml(row.documento)}` : ''}</span></div>
        <button type="button" class="demo-person__remove" data-remove-manual="${index}" aria-label="Eliminar ${escapeHtml(row.nombres)}"><i class="fa-solid fa-trash"></i></button>
      </div>`).join('');
    list.querySelectorAll('[data-remove-manual]').forEach(button => button.addEventListener('click', () => removeManualParticipant(Number(button.dataset.removeManual))));
  }

  function renderExcelPanel() {
    const panel = $('demoExcelPanel');
    if (!panel || !state) return;
    panel.innerHTML = `
      <div class="demo-upload-actions">
        <button type="button" id="demoDownloadTemplate" class="demo-action demo-action--soft"><i class="fa-solid fa-download"></i> Descargar plantilla Excel</button>
        <button type="button" id="demoClearExcel" class="demo-action"><i class="fa-solid fa-rotate-left"></i> Limpiar archivo</button>
      </div>
      <div id="demoDropzone" class="demo-dropzone" style="margin-top:10px">
        <i class="fa-solid fa-file-arrow-up"></i><strong>Selecciona o arrastra el Excel completado</strong><small>.xlsx o .xls · máximo ${expectedCount()} participantes</small>
        <input id="demoExcelInput" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel">
      </div>
      <div id="demoFileState" class="demo-file-state">La plantilla se valida antes de enviar. Los errores bloqueantes deberán corregirse.</div>
      <div id="demoPreview"></div>
      <button type="button" id="demoExcelSendBtn" class="demo-action demo-action--primary" style="width:100%;margin-top:10px" disabled><i class="fa-solid fa-paper-plane"></i> Enviar participantes validados</button>`;

    $('demoDownloadTemplate')?.addEventListener('click', downloadTemplate);
    $('demoClearExcel')?.addEventListener('click', clearExcel);
    $('demoExcelInput')?.addEventListener('change', event => readExcel(event.target.files?.[0]));
    $('demoExcelSendBtn')?.addEventListener('click', () => sendParticipants(previewRows, 'excel'));
    const drop = $('demoDropzone');
    if (drop) {
      ['dragenter','dragover'].forEach(name => drop.addEventListener(name, event => { event.preventDefault(); drop.classList.add('is-dragover'); }));
      ['dragleave','drop'].forEach(name => drop.addEventListener(name, event => { event.preventDefault(); drop.classList.remove('is-dragover'); }));
      drop.addEventListener('drop', event => readExcel(event.dataTransfer?.files?.[0]));
    }
    if (previewRows.length || previewErrors.length || previewWarnings.length) renderPreview();
  }

  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (xlsxPromise) return xlsxPromise;
    xlsxPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = XLSX_URL;
      script.async = true;
      script.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error('No se pudo cargar el lector de Excel.'));
      script.onerror = () => reject(new Error('No se pudo cargar el lector de Excel.'));
      document.head.appendChild(script);
    });
    return xlsxPromise;
  }

  async function downloadTemplate() {
    const info = $('demoFileState');
    try {
      const XLSX = await loadXlsx();
      const rows = [HEADERS, ['María','González','Cédula','12.345.678','maria@empresa.com','+56 9 0000 0000','CL','Supervisora','Operaciones']];
      const sheet = XLSX.utils.aoa_to_sheet(rows);
      sheet['!cols'] = [{wch:18},{wch:18},{wch:18},{wch:18},{wch:28},{wch:18},{wch:12},{wch:20},{wch:20}];
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, 'Participantes');
      XLSX.writeFile(book, `Plantilla_Demo_${state.reference}.xlsx`);
      if (info) { info.className = 'demo-file-state is-ok'; info.textContent = 'Plantilla descargada. Puedes completarla sin cambiar los encabezados.'; }
    } catch (error) {
      if (info) { info.className = 'demo-file-state is-error'; info.textContent = error?.message || 'No fue posible generar la plantilla.'; }
    }
  }

  function clearExcel() {
    previewRows = [];
    previewErrors = [];
    previewWarnings = [];
    const input = $('demoExcelInput');
    if (input) input.value = '';
    const stateEl = $('demoFileState');
    if (stateEl) { stateEl.className = 'demo-file-state'; stateEl.textContent = 'La plantilla se valida antes de enviar. Los errores bloqueantes deberán corregirse.'; }
    const preview = $('demoPreview');
    if (preview) preview.innerHTML = '';
    const send = $('demoExcelSendBtn');
    if (send) send.disabled = true;
  }

  async function readExcel(file) {
    if (!file) return;
    const info = $('demoFileState');
    try {
      if (!/\.xlsx?$/i.test(file.name)) throw new Error('Selecciona un archivo Excel .xlsx o .xls.');
      if (file.size > 4 * 1024 * 1024) throw new Error('El archivo es demasiado grande. Usa únicamente la plantilla de participantes.');
      if (info) { info.className = 'demo-file-state'; info.textContent = 'Leyendo y validando la plantilla…'; }
      const XLSX = await loadXlsx();
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const nonEmpty = raw.filter(row => Object.values(row).some(value => String(value ?? '').trim() !== ''));
      if (!nonEmpty.length) throw new Error('La plantilla no contiene participantes.');
      if (nonEmpty.length > expectedCount()) throw new Error(`Esta solicitud contempla ${expectedCount()} participantes y el archivo contiene ${nonEmpty.length}.`);
      const result = validateRows(nonEmpty);
      previewRows = result.rows;
      previewErrors = result.errors;
      previewWarnings = result.warnings;
      renderPreview();
      if (info) {
        if (previewErrors.length) { info.className = 'demo-file-state is-error'; info.textContent = `Encontramos ${previewErrors.length} error${previewErrors.length === 1 ? '' : 'es'} que debes corregir antes de enviar.`; }
        else if (previewWarnings.length) { info.className = 'demo-file-state is-warn'; info.textContent = `${previewRows.length} participantes válidos. Hay ${previewWarnings.length} ajuste${previewWarnings.length === 1 ? '' : 's'} de formato que se normalizarán automáticamente.`; }
        else { info.className = 'demo-file-state is-ok'; info.textContent = `${previewRows.length} participantes válidos. Puedes enviarlos.`; }
      }
    } catch (error) {
      previewRows = [];
      previewErrors = [error?.message || 'No fue posible leer el archivo.'];
      previewWarnings = [];
      renderPreview();
      if (info) { info.className = 'demo-file-state is-error'; info.textContent = previewErrors[0]; }
    }
  }

  function renderPreview() {
    const root = $('demoPreview');
    if (!root) return;
    const send = $('demoExcelSendBtn');
    if (send) send.disabled = !previewRows.length || previewErrors.length > 0;
    if (!previewRows.length && !previewErrors.length) { root.innerHTML = ''; return; }
    root.innerHTML = `
      <div class="demo-preview">
        <div class="demo-preview__summary"><strong>${previewRows.length} participante${previewRows.length === 1 ? '' : 's'} leído${previewRows.length === 1 ? '' : 's'}</strong><span>${previewErrors.length ? `${previewErrors.length} error(es)` : 'Sin errores bloqueantes'}</span></div>
        ${previewRows.length ? `<div class="demo-preview__scroll"><table><thead><tr><th>#</th><th>Nombre</th><th>Documento</th><th>Correo</th><th>País</th><th>Cargo / Área</th></tr></thead><tbody>${previewRows.map((row,index) => `<tr><td>${index + 1}</td><td>${escapeHtml(`${row.nombres} ${row.apellidos}`)}</td><td>${escapeHtml(row.documento || '—')}</td><td>${escapeHtml(row.correo)}</td><td>${escapeHtml(row.pais_iso2 || '—')}</td><td>${escapeHtml([row.cargo,row.area].filter(Boolean).join(' · ') || '—')}</td></tr>`).join('')}</tbody></table></div>` : ''}
        ${previewErrors.length ? `<div class="demo-preview__errors"><strong>Corrige antes de enviar:</strong><br>${previewErrors.map(escapeHtml).join('<br>')}</div>` : ''}
        ${previewWarnings.length ? `<div class="demo-preview__warnings"><strong>Ajustes automáticos:</strong><br>${previewWarnings.map(escapeHtml).join('<br>')}</div>` : ''}
      </div>`;
  }

  async function api(action, extra = {}) {
    if (!state?.reference || !state?.upload_token) throw new Error('La sesión de carga del Demo no está disponible. Vuelve a solicitar el Demo.');
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ action, reference: state.reference, upload_token: state.upload_token, ...extra })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok !== true) {
      const message = typeof data.error === 'string' ? data.error : (typeof data.message === 'string' ? data.message : 'No fue posible procesar la lista de participantes.');
      throw new Error(message);
    }
    return data;
  }

  async function sendParticipants(rows, source) {
    const result = validateRows(rows);
    if (!result.rows.length) {
      if (source === 'manual') setManualFeedback('Agrega al menos un participante.', 'error');
      return;
    }
    if (result.rows.length > expectedCount()) {
      const message = `La solicitud contempla ${expectedCount()} participantes y la lista contiene ${result.rows.length}.`;
      if (source === 'manual') setManualFeedback(message, 'error');
      return;
    }
    if (result.errors.length) {
      if (source === 'manual') setManualFeedback(result.errors[0], 'error');
      else { previewErrors = result.errors; previewWarnings = result.warnings; previewRows = result.rows; renderPreview(); }
      return;
    }

    const button = source === 'manual' ? $('demoManualSendBtn') : $('demoExcelSendBtn');
    const original = button?.innerHTML || '';
    if (button) { button.disabled = true; button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando…'; }
    try {
      const data = await api('upload_participants', { participants: result.rows, source });
      state.received_participants = Number(data.received || result.rows.length);
      state.status = data.status || state.status;
      state.portal_email = data.portal_email || state.portal_email;
      state.entry_method = source;
      if (source === 'manual') manualRows = result.rows;
      persistState(state);
      renderCard();
      const final = $('demoFinalMessage');
      final?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      if (source === 'manual') setManualFeedback(error?.message || 'No fue posible guardar los participantes.', 'error');
      else {
        const info = $('demoFileState');
        if (info) { info.className = 'demo-file-state is-error'; info.textContent = error?.message || 'No fue posible guardar los participantes.'; }
      }
    } finally {
      if (button && document.body.contains(button)) { button.disabled = false; button.innerHTML = original; }
    }
  }

  function renderFinalMessage() {
    const box = $('demoFinalMessage');
    if (!box || !state) return;
    const received = Number(state.received_participants ?? state.received ?? 0);
    if (!received) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `
      <strong><i class="fa-solid fa-circle-check"></i> Información recibida correctamente</strong><br>
      Hemos recibido ${received} participante${received === 1 ? '' : 's'} para el Demo Corporativo <strong>${escapeHtml(state.reference)}</strong>.
      <ul>
        <li>Estado: <strong>${escapeHtml(statusLabel(state.status))}</strong>.</li>
        <li>La matrícula en Moodle sigue pendiente de aprobación administrativa.</li>
        <li>El responsable recibirá por correo las instrucciones para activar su acceso al Tablero Corporativo de Seguimiento cuando el Demo sea confirmado.</li>
        <li>Las fechas y accesos se confirmarán antes del inicio.</li>
      </ul>`;
  }

  async function refreshStatus() {
    if (!state) return;
    try {
      const data = await api('status');
      if (!data.demo) return;
      state.company = data.demo.company || state.company;
      state.course_name = data.demo.course || state.course_name;
      state.expected_participants = data.demo.expected || state.expected_participants;
      state.received_participants = data.demo.received ?? state.received_participants;
      state.status = data.demo.status || state.status;
      state.credentials_status = data.demo.credentials_status || state.credentials_status;
      state.portal_email = data.demo.portal_email || state.portal_email;
      state.start_date = data.demo.start_date || null;
      state.end_date = data.demo.end_date || null;
      persistState(state);
      renderCard();
    } catch (_) {}
  }

  function start(detail) {
    const onboarding = detail?.demo_onboarding || detail || {};
    const reference = normalizeText(detail?.reference || onboarding.reference, 40).toUpperCase();
    const uploadToken = normalizeText(onboarding.upload_token, 200);
    if (!reference || !uploadToken) return;
    manualRows = [];
    state = {
      reference,
      upload_token: uploadToken,
      company: normalizeText(detail?.prospect?.empresa || onboarding.company, 180),
      course_name: normalizeText(onboarding.course_name || detail?.prospect?.selected_courses?.[0]?.name, 180),
      expected_participants: Math.max(1, Math.min(MAX_PARTICIPANTS, Number(onboarding.expected_participants || detail?.prospect?.participants || MAX_PARTICIPANTS))),
      received_participants: Number(onboarding.received_participants || 0),
      status: normalizeText(onboarding.status || 'participantes_pendientes', 50),
      credentials_status: normalizeText(onboarding.credentials_status || 'pendientes', 50),
      portal_email: normalizeText(onboarding.portal_email || detail?.prospect?.correo, 254),
      entry_method: 'manual'
    };
    persistState(state);
    renderCard();
    ensureCard().scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function setup() {
    window.addEventListener('presupuesto:demo-created', event => start(event.detail || {}));
    state = loadState();
    if (state) {
      renderCard();
      window.setTimeout(refreshStatus, 350);
    }
    if (window.__PRESUPUESTO_PENDING_DEMO__) {
      const pending = window.__PRESUPUESTO_PENDING_DEMO__;
      delete window.__PRESUPUESTO_PENDING_DEMO__;
      start(pending);
    }
    window.PresupuestoDemoOnboarding = { start, refreshStatus };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})();