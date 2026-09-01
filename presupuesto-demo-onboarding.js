(() => {
  'use strict';

  const API_URL = 'https://lfdmbkzghnwvsapxypvt.supabase.co/functions/v1/presupuesto-demo-onboarding';
  const XLSX_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  const STORAGE_KEY = 'movida_demo_onboarding_v1';
  const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
  const MAX_PARTICIPANTS = 20;
  const HEADERS = ['Nombres','Apellidos','Tipo_documento','Documento','Correo','Telefono','Pais_ISO2','Cargo','Area'];
  const $ = id => document.getElementById(id);
  let state = null;
  let previewRows = [];
  let previewErrors = [];
  let previewWarnings = [];
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
    return normalizeText(value, 80).toUpperCase().replace(/[.\s-]+/g, '').replace(/^([VEJGP])(?=\d)/, '$1');
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

  function saveState(next) {
    state = next ? { ...next, saved_at: Date.now() } : null;
    try {
      if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!raw || !raw.reference || !raw.upload_token || !raw.saved_at) return null;
      if (Date.now() - Number(raw.saved_at) > MAX_AGE_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return raw;
    } catch (_) {
      return null;
    }
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
      .demo-upload-actions{display:grid;gap:9px}.demo-onboarding .demo-action{min-height:48px;border-radius:13px;border:1px solid var(--line);padding:0 13px;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:850;font-size:.76rem;cursor:pointer;background:#fff;color:var(--navy)}.demo-onboarding .demo-action--primary{background:var(--brand);border-color:var(--brand);color:#fff}.demo-onboarding .demo-action--soft{background:#f4faf9;border-color:#cae6e2;color:#0b5d57}.demo-onboarding .demo-action:disabled{opacity:.55;cursor:not-allowed}
      .demo-dropzone{position:relative;border:1.5px dashed #9ccbc5;border-radius:16px;background:#f8fcfb;padding:18px;text-align:center;color:#486f73;transition:.15s ease}.demo-dropzone.is-dragover{border-color:var(--brand);background:#eaf7f5;transform:translateY(-1px)}.demo-dropzone i{font-size:1.35rem;color:var(--brand)}.demo-dropzone strong{display:block;margin-top:6px;color:var(--navy);font-size:.8rem}.demo-dropzone small{display:block;margin-top:3px;font-size:.65rem}.demo-dropzone input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
      .demo-file-state{margin-top:10px;padding:10px 12px;border-radius:12px;background:#f6f8fa;color:#526779;font-size:.7rem;line-height:1.45}.demo-file-state.is-error{background:#fff1f0;color:#9b2c21}.demo-file-state.is-ok{background:#eef9f2;color:#296840}.demo-file-state.is-warn{background:#fff8e7;color:#7b5a16}
      .demo-preview{margin-top:12px;border:1px solid #e1e8ed;border-radius:14px;overflow:hidden;background:#fff}.demo-preview__summary{padding:10px 12px;background:#f6f9fb;border-bottom:1px solid #e1e8ed;display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:.69rem}.demo-preview__summary strong{color:var(--navy)}.demo-preview__scroll{overflow:auto;max-height:260px}.demo-preview table{width:100%;border-collapse:collapse;font-size:.65rem;min-width:660px}.demo-preview th,.demo-preview td{padding:8px 9px;border-bottom:1px solid #edf1f4;text-align:left;vertical-align:top}.demo-preview th{position:sticky;top:0;background:#fff;color:#506477;font-size:.58rem;text-transform:uppercase;letter-spacing:.04em;z-index:1}.demo-preview tr.is-error td{background:#fff7f6}.demo-preview__errors,.demo-preview__warnings{padding:10px 12px;font-size:.68rem;line-height:1.5}.demo-preview__errors{background:#fff5f4;color:#8c3028}.demo-preview__warnings{background:#fff9e9;color:#755a18;border-top:1px solid #f0dfad}.demo-preview__errors ul,.demo-preview__warnings ul{margin:5px 0 0;padding-left:18px}
      .demo-onboarding__receipt{padding:16px;border-radius:16px;background:#edf9f1;border:1px solid #cde8d6;color:#2d6643}.demo-onboarding__receipt h4{margin:0 0 6px;color:#184c2e;font-size:1rem}.demo-onboarding__receipt p{margin:0;font-size:.74rem;line-height:1.55}.demo-onboarding__receipt .receipt-status{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:12px}.demo-onboarding__receipt .receipt-status div{padding:9px;border-radius:11px;background:rgba(255,255,255,.7)}.demo-onboarding__receipt .receipt-status span{display:block;font-size:.55rem;text-transform:uppercase;color:#5b7c67}.demo-onboarding__receipt .receipt-status strong{display:block;margin-top:2px;font-size:.72rem;color:#1e5435}
      @media(min-width:700px){.demo-onboarding__hero{padding:24px}.demo-onboarding__facts{grid-template-columns:repeat(4,minmax(0,1fr))}.demo-onboarding__body{padding:22px}.demo-onboarding__steps{grid-template-columns:repeat(3,minmax(0,1fr))}.demo-upload-actions{grid-template-columns:1fr 1fr}.demo-onboarding__receipt .receipt-status{grid-template-columns:repeat(4,minmax(0,1fr))}}
      @media(max-width:480px){.demo-onboarding{border-radius:18px}.demo-onboarding__hero,.demo-onboarding__body{padding:15px}.demo-onboarding__facts{grid-template-columns:1fr 1fr}.demo-upload-panel__head{align-items:flex-start}.demo-progress{font-size:.68rem}.demo-onboarding__receipt .receipt-status{grid-template-columns:1fr 1fr}}
      @media print{.demo-onboarding{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureCard() {
    injectStyles();
    let card = $('demoOnboarding');
    if (card) return card;
    card = document.createElement('section');
    card.id = 'demoOnboarding';
    card.className = 'demo-onboarding no-print';
    card.setAttribute('aria-labelledby', 'demoOnboardingTitle');
    const anchor = $('leadSuccess') || $('leadForm') || document.querySelector('#leadCapture');
    if (anchor?.parentNode) anchor.parentNode.insertBefore(card, anchor.nextSibling);
    return card;
  }

  function statusLabel(value) {
    const labels = {
      participantes_pendientes: 'Lista pendiente', participantes_parciales: 'Lista parcial', participantes_recibidos: 'Participantes recibidos',
      revision: 'En revisión', aprobado: 'Demo aprobado', matriculando: 'Preparando matrículas', activo: 'Demo activo',
      rechazado: 'No aprobado', cancelado: 'Cancelado'
    };
    return labels[value] || 'Pendiente de confirmación';
  }

  function renderCard() {
    if (!state) return;
    const card = ensureCard();
    const expected = Math.max(1, Math.min(MAX_PARTICIPANTS, Number(state.expected_participants || state.expected || 1)));
    const received = Math.max(0, Math.min(expected, Number(state.received_participants || state.received || 0)));
    const company = state.company || state.prospect?.empresa || '';
    const course = state.course_name || state.course || state.prospect?.selected_courses?.[0]?.name || '';
    const portalEmail = state.portal_email || state.prospect?.correo || '';
    card.innerHTML = `
      <div class="demo-onboarding__hero">
        <div class="demo-onboarding__badge"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Solicitud recibida</div>
        <div><h3 id="demoOnboardingTitle">Información recibida correctamente</h3><p>Hemos creado la solicitud corporativa y preparado el registro de la empresa para el proceso de activación. Completa ahora la lista de participantes para dejar el Demo listo para revisión.</p></div>
        <div class="demo-onboarding__facts">
          <div class="demo-onboarding__fact"><span>Referencia</span><strong>${escapeHtml(state.reference)}</strong></div>
          <div class="demo-onboarding__fact"><span>Estado</span><strong id="demoOnboardingStatusLabel">${escapeHtml(statusLabel(state.status))}</strong></div>
          <div class="demo-onboarding__fact"><span>Participantes</span><strong id="demoOnboardingFactCount">${received} de ${expected}</strong></div>
          <div class="demo-onboarding__fact"><span>Costo Demo</span><strong>USD 0</strong></div>
        </div>
      </div>
      <div class="demo-onboarding__body">
        <div class="demo-onboarding__notice"><i class="fa-solid fa-user-shield" aria-hidden="true"></i><strong>Tablero Corporativo de Seguimiento:</strong> una vez aprobado el Demo, al responsable de <strong>${escapeHtml(company || 'la empresa')}</strong> se le enviarán las instrucciones y credenciales al correo <strong>${escapeHtml(portalEmail)}</strong> para acceder al tablero y consultar participantes, matrícula, fechas, avance y resultados disponibles.</div>
        <div class="demo-onboarding__steps">
          <div class="demo-onboarding__step"><div class="demo-onboarding__stepno">1</div><div><strong>Carga tu equipo</strong><p>Descarga la plantilla y completa hasta ${expected} participantes.</p></div></div>
          <div class="demo-onboarding__step"><div class="demo-onboarding__stepno">2</div><div><strong>Revisión Movida SST</strong><p>Validaremos datos, curso y fechas antes de habilitar accesos.</p></div></div>
          <div class="demo-onboarding__step"><div class="demo-onboarding__stepno">3</div><div><strong>Activación</strong><p>Tras la aprobación se confirmarán matrículas y credenciales del tablero.</p></div></div>
        </div>
        <div class="demo-upload-panel">
          <div class="demo-upload-panel__head"><div><h4>Participantes del Demo</h4><p>${escapeHtml(course || 'Curso seleccionado')} · máximo ${expected}</p></div><span class="demo-progress" id="demoParticipantProgress">${received} / ${expected}</span></div>
          <div class="demo-upload-actions">
            <button type="button" class="demo-action demo-action--soft" id="demoDownloadTemplate"><i class="fa-solid fa-file-excel" aria-hidden="true"></i> Descargar plantilla Excel</button>
            <label class="demo-dropzone" id="demoDropzone"><i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i><strong>Subir plantilla completada</strong><small>Excel .xlsx / .xls o CSV · hasta ${expected} personas</small><input id="demoParticipantFile" type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"></label>
          </div>
          <div class="demo-file-state" id="demoFileState">Aún no has seleccionado una plantilla. El sistema revisará también si los datos parecen estar en la columna correcta.</div>
          <div id="demoPreviewHost"></div>
          <button type="button" class="demo-action demo-action--primary" id="demoSubmitParticipants" disabled style="width:100%;margin-top:12px"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Enviar participantes para revisión</button>
        </div>
        <div class="demo-onboarding__notice"><i class="fa-solid fa-circle-info" aria-hidden="true"></i><strong>Importante:</strong> cargar la lista no crea usuarios ni matricula automáticamente en Moodle. La Academia Movida SST debe confirmar primero la solicitud, las fechas y la activación del Demo.</div>
        <div id="demoReceiptHost"></div>
      </div>`;
    wireCard();
  }

  function setFileState(message, type = '') {
    const el = $('demoFileState');
    if (!el) return;
    el.textContent = message;
    el.className = `demo-file-state${type ? ` is-${type}` : ''}`;
  }

  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (xlsxPromise) return xlsxPromise;
    xlsxPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-movida-sheetjs]');
      if (existing) {
        existing.addEventListener('load', () => window.XLSX ? resolve(window.XLSX) : reject(new Error('No se pudo iniciar el lector de Excel.')), { once: true });
        existing.addEventListener('error', () => reject(new Error('No se pudo cargar el lector de Excel.')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = XLSX_URL;
      script.async = true;
      script.dataset.movidaSheetjs = '1';
      script.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error('No se pudo iniciar el lector de Excel.'));
      script.onerror = () => reject(new Error('No se pudo cargar el lector de Excel. Revisa tu conexión.'));
      document.head.appendChild(script);
    });
    return xlsxPromise;
  }

  async function downloadTemplate() {
    if (!state) return;
    const button = $('demoDownloadTemplate');
    const original = button?.innerHTML || '';
    if (button) { button.disabled = true; button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparando Excel…'; }
    try {
      const XLSX = await loadXlsx();
      const expected = Math.max(1, Math.min(MAX_PARTICIPANTS, Number(state.expected_participants || state.expected || 1)));
      const rows = Array.from({ length: expected }, () => Object.fromEntries(HEADERS.map(header => [header, ''])));
      const ws = XLSX.utils.json_to_sheet(rows, { header: HEADERS });
      ws['!cols'] = [18,18,16,18,28,16,12,18,18].map(wch => ({ wch }));
      const instructions = [
        ['PLANTILLA DE PARTICIPANTES · DEMO CORPORATIVO'],
        ['Referencia', state.reference],
        ['Curso', state.course_name || state.course || ''],
        ['Cantidad prevista', expected],
        ['Obligatorios', 'Nombres, Apellidos y Correo. Documento es recomendable pero puede dejarse vacío si no corresponde.'],
        ['Documento / Cédula', 'Puede escribir 12.345.678; el sistema elimina puntos cuando corresponde. Para RUT chileno puede usar 12.345.678-5.'],
        ['País ISO2', 'Use dos letras: CL, VE, CO, PE, AR, etc.'],
        ['Validación', 'Antes de enviar se detectan correos inválidos, duplicados, nombres en Documento/Cédula, columnas desplazadas y otros errores comunes.'],
        ['Importante', 'La carga NO matricula automáticamente en Moodle. La lista queda pendiente de revisión y aprobación.']
      ];
      const wi = XLSX.utils.aoa_to_sheet(instructions);
      wi['!cols'] = [{ wch: 23 }, { wch: 92 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Participantes');
      XLSX.utils.book_append_sheet(wb, wi, 'Instrucciones');
      const safeRef = String(state.reference || 'DEMO').replace(/[^A-Z0-9-]/gi, '_');
      XLSX.writeFile(wb, `Plantilla_Participantes_${safeRef}.xlsx`, { compression: true });
      setFileState('Plantilla descargada. Completa la hoja “Participantes” y súbela aquí para validarla.', 'ok');
    } catch (error) {
      setFileState(error.message || 'No fue posible preparar la plantilla Excel.', 'error');
    } finally {
      if (button) { button.disabled = false; button.innerHTML = original; }
    }
  }

  function validateRows(rows) {
    const expected = Math.max(1, Math.min(MAX_PARTICIPANTS, Number(state?.expected_participants || state?.expected || 1)));
    const errors = [];
    const warnings = [];
    const emailSeen = new Map();
    const documentSeen = new Map();
    if (!rows.length) errors.push('La plantilla no contiene participantes.');
    if (rows.length > expected) errors.push(`La solicitud contempla ${expected} participantes y la plantilla contiene ${rows.length}.`);
    if (rows.length > MAX_PARTICIPANTS) errors.push(`El Demo permite un máximo de ${MAX_PARTICIPANTS} participantes.`);

    rows.forEach((row, index) => {
      const line = index + 2;
      validateNameField(row.nombres, 'Nombres', line, errors);
      validateNameField(row.apellidos, 'Apellidos', line, errors);

      if (!validEmail(row.correo)) {
        if (looksLikeDocument(row.correo) && looksLikePersonName(row.documento)) {
          errors.push(`Fila ${line}: parece que Documento y Correo están desplazados: Documento contiene un nombre y Correo contiene “${row.correo}”.`);
        } else {
          errors.push(`Fila ${line}: Correo no es válido.`);
        }
      }
      if (row.pais_iso2 && !/^[A-Z]{2}$/.test(row.pais_iso2)) errors.push(`Fila ${line}: Pais_ISO2 debe tener 2 letras (ej.: CL o VE).`);
      validateDocument(row, line, errors, warnings);

      if (row.correo) {
        if (emailSeen.has(row.correo)) errors.push(`Filas ${emailSeen.get(row.correo)} y ${line}: correo duplicado (${row.correo}).`);
        else emailSeen.set(row.correo, line);
      }
      if (row.documento) {
        const key = row.documento.toUpperCase();
        if (documentSeen.has(key)) errors.push(`Filas ${documentSeen.get(key)} y ${line}: documento duplicado (${row.documento}).`);
        else documentSeen.set(key, line);
      }
    });
    return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
  }

  function renderPreview() {
    const host = $('demoPreviewHost');
    const submit = $('demoSubmitParticipants');
    if (!host) return;
    if (!previewRows.length && !previewErrors.length && !previewWarnings.length) {
      host.innerHTML = '';
      if (submit) submit.disabled = true;
      return;
    }
    const expected = Math.max(1, Math.min(MAX_PARTICIPANTS, Number(state?.expected_participants || state?.expected || 1)));
    const rowHasError = (row, index) => {
      const line = index + 2;
      return previewErrors.some(error => error.includes(`Fila ${line}:`) || error.includes(`y ${line}:`) || error.includes(`Filas ${line} y`));
    };
    const rowsHtml = previewRows.map((row, index) => `<tr class="${rowHasError(row,index) ? 'is-error' : ''}"><td>${index + 1}</td><td>${escapeHtml(row.nombres)}</td><td>${escapeHtml(row.apellidos)}</td><td>${escapeHtml(row.correo)}</td><td>${escapeHtml(row.documento || '—')}</td><td>${escapeHtml(row.cargo || '—')}</td><td>${escapeHtml(row.area || '—')}</td></tr>`).join('');
    const errorsHtml = previewErrors.length ? `<div class="demo-preview__errors"><strong><i class="fa-solid fa-circle-xmark"></i> Errores que debes corregir:</strong><ul>${previewErrors.slice(0,14).map(error => `<li>${escapeHtml(error)}</li>`).join('')}${previewErrors.length > 14 ? `<li>…y ${previewErrors.length - 14} observaciones más.</li>` : ''}</ul></div>` : '';
    const warningsHtml = previewWarnings.length ? `<div class="demo-preview__warnings"><strong><i class="fa-solid fa-triangle-exclamation"></i> Ajustes automáticos / advertencias:</strong><ul>${previewWarnings.slice(0,10).map(warning => `<li>${escapeHtml(warning)}</li>`).join('')}${previewWarnings.length > 10 ? `<li>…y ${previewWarnings.length - 10} advertencias más.</li>` : ''}</ul></div>` : '';
    host.innerHTML = `<div class="demo-preview"><div class="demo-preview__summary"><strong>Vista previa validada</strong><span>${previewRows.length} de ${expected} · ${previewErrors.length ? `${previewErrors.length} errores` : 'sin errores'}${previewWarnings.length ? ` · ${previewWarnings.length} advertencias` : ''}</span></div><div class="demo-preview__scroll"><table><thead><tr><th>#</th><th>Nombres</th><th>Apellidos</th><th>Correo</th><th>Documento</th><th>Cargo</th><th>Área</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>${errorsHtml}${warningsHtml}</div>`;
    if (submit) submit.disabled = !previewRows.length || previewErrors.length > 0 || previewRows.length > expected;
  }

  async function readFile(file) {
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name || '')) {
      previewRows = []; previewErrors = ['El archivo debe ser Excel (.xlsx/.xls) o CSV.']; previewWarnings = [];
      setFileState(previewErrors[0], 'error'); renderPreview(); return;
    }
    setFileState(`Leyendo y validando ${file.name}…`);
    try {
      const XLSX = await loadXlsx();
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: false, raw: false });
      const sheetName = wb.SheetNames.includes('Participantes') ? 'Participantes' : wb.SheetNames[0];
      if (!sheetName) throw new Error('El archivo no contiene hojas legibles.');
      const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '', raw: false });
      previewRows = rawRows.map(normalizeParticipant).filter(row => Object.values(row).some(value => value != null && String(value).trim() !== ''));
      const validation = validateRows(previewRows);
      previewErrors = validation.errors;
      previewWarnings = validation.warnings;
      if (previewErrors.length) {
        setFileState(`${file.name}: encontramos ${previewErrors.length} error${previewErrors.length === 1 ? '' : 'es'} que debes corregir antes de enviar.`, 'error');
      } else if (previewWarnings.length) {
        setFileState(`${file.name}: los datos son utilizables, pero aplicaremos ${previewWarnings.length} ajuste${previewWarnings.length === 1 ? '' : 's'} de formato. Revisa la vista previa.`, 'warn');
      } else {
        setFileState(`${file.name}: ${previewRows.length} participante${previewRows.length === 1 ? '' : 's'} validado${previewRows.length === 1 ? '' : 's'} y listo${previewRows.length === 1 ? '' : 's'} para enviar.`, 'ok');
      }
      renderPreview();
    } catch (error) {
      previewRows = []; previewErrors = [error.message || 'No fue posible leer la plantilla.']; previewWarnings = [];
      setFileState(previewErrors[0], 'error'); renderPreview();
    }
  }

  async function submitParticipants() {
    if (!state || !previewRows.length || previewErrors.length) return;
    const button = $('demoSubmitParticipants');
    const original = button?.innerHTML || '';
    if (button) { button.disabled = true; button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Validando y guardando…'; }
    setFileState('Enviando la lista para una segunda validación segura…');
    try {
      const response = await fetch(API_URL, {
        method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ action: 'upload_participants', reference: state.reference, upload_token: state.upload_token, participants: previewRows })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok !== true) throw new Error(data.error || 'No fue posible guardar los participantes.');
      saveState({ ...state, expected_participants: data.expected || state.expected_participants, received_participants: data.received, status: data.status, company: data.company || state.company, course_name: data.course || state.course_name, portal_email: data.portal_email || state.portal_email });
      updateReceipt(data);
      const progress = $('demoParticipantProgress');
      const fact = $('demoOnboardingFactCount');
      const status = $('demoOnboardingStatusLabel');
      if (progress) progress.textContent = `${data.received} / ${data.expected}`;
      if (fact) fact.textContent = `${data.received} de ${data.expected}`;
      if (status) status.textContent = statusLabel(data.status);
      setFileState(data.message || 'Información recibida correctamente.', 'ok');
      if (button) button.innerHTML = '<i class="fa-solid fa-circle-check"></i> Participantes recibidos';
      $('demoReceiptHost')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      setFileState(error.message || 'No fue posible guardar la lista. Intenta nuevamente.', 'error');
      if (button) { button.disabled = false; button.innerHTML = original; }
    }
  }

  function updateReceipt(data = {}) {
    const host = $('demoReceiptHost');
    if (!host || !state) return;
    const expected = Number(data.expected || state.expected_participants || 0);
    const received = Number(data.received ?? state.received_participants ?? 0);
    if (!received) { host.innerHTML = ''; return; }
    const complete = data.complete === true || received === expected;
    host.innerHTML = `<div class="demo-onboarding__receipt" role="status"><h4><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Información de participantes recibida</h4><p>${complete ? 'La lista quedó validada y lista para revisión administrativa.' : `Recibimos ${received} de ${expected} participantes. Puedes reemplazar la plantilla antes de la aprobación.`} Estamos confirmando la solicitud, las fechas y la activación. Cuando el Demo sea aprobado, el responsable recibirá las credenciales e instrucciones del Tablero Corporativo de Seguimiento.</p><div class="receipt-status"><div><span>Referencia</span><strong>${escapeHtml(state.reference)}</strong></div><div><span>Participantes</span><strong>${received} de ${expected}</strong></div><div><span>Estado</span><strong>${escapeHtml(statusLabel(data.status || state.status))}</strong></div><div><span>Matrícula Moodle</span><strong>Pendiente de aprobación</strong></div></div></div>`;
  }

  function wireCard() {
    $('demoDownloadTemplate')?.addEventListener('click', downloadTemplate);
    $('demoParticipantFile')?.addEventListener('change', event => readFile(event.target.files?.[0]));
    $('demoSubmitParticipants')?.addEventListener('click', submitParticipants);
    const zone = $('demoDropzone');
    ['dragenter','dragover'].forEach(name => zone?.addEventListener(name, event => { event.preventDefault(); zone.classList.add('is-dragover'); }));
    ['dragleave','drop'].forEach(name => zone?.addEventListener(name, event => { event.preventDefault(); zone.classList.remove('is-dragover'); }));
    zone?.addEventListener('drop', event => { const file = event.dataTransfer?.files?.[0]; if (file) readFile(file); });
    updateReceipt();
  }

  async function refreshStatus() {
    if (!state) return;
    try {
      const response = await fetch(API_URL, {
        method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ action: 'status', reference: state.reference, upload_token: state.upload_token })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok !== true || !data.demo) return;
      saveState({ ...state, company: data.demo.company || state.company, course_name: data.demo.course || state.course_name, expected_participants: data.demo.expected || state.expected_participants, received_participants: data.demo.received ?? state.received_participants, status: data.demo.status || state.status, credentials_status: data.demo.credentials_status || state.credentials_status, portal_email: data.demo.portal_email || state.portal_email, start_date: data.demo.start_date || null, end_date: data.demo.end_date || null });
      renderCard();
    } catch (_) {}
  }

  function start(detail) {
    const onboarding = detail?.demo_onboarding || detail || {};
    const reference = normalizeText(detail?.reference || onboarding.reference, 40).toUpperCase();
    const uploadToken = normalizeText(onboarding.upload_token, 200);
    if (!reference || !uploadToken) return;
    saveState({
      reference,
      upload_token: uploadToken,
      expected_participants: Number(onboarding.expected_participants || detail?.prospect?.participants || 1),
      received_participants: Number(onboarding.received_participants || 0),
      status: onboarding.status || 'participantes_pendientes',
      credentials_status: onboarding.credentials_status || 'pendientes',
      portal_email: onboarding.portal_email || detail?.prospect?.correo || '',
      company: onboarding.company || detail?.prospect?.empresa || '',
      course_name: onboarding.course_name || detail?.prospect?.selected_courses?.[0]?.name || '',
      prospect: detail?.prospect || null,
    });
    previewRows = []; previewErrors = []; previewWarnings = [];
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
  }

  window.PresupuestoDemoOnboarding = { start, refreshStatus, getState: () => state };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
