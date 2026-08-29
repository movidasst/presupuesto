/**
 * Corporate quote module for the existing La Movida SST email Apps Script.
 * Add these two routes to the existing doPost(e) dispatcher BEFORE the generic fallback:
 *
 *   if (action === 'corporate_quote_ping') return corporateQuotePing_(e);
 *   if (action === 'send_corporate_quote') return handleCorporateQuoteRequest_(e);
 *
 * This module is intentionally isolated: it does not modify registration/campaign handlers.
 */

const CORPORATE_QUOTE = Object.freeze({
  CRM_SPREADSHEET_ID: '1N5TcSS3LozVAUzHV0w7ZWgq4W19ofsc_-RySFbshCNU',
  CRM_SHEET_NAME: 'Prospectos',
  TEMPLATE_DOC_ID: '1nwYCCmToNVqhd7UQVVb9BH4vWje8Uz_5LnzIwsVFW8Y',
  PDF_ROOT_FOLDER_ID: '17usCjuTOrqkwczIVxtO4IFWBVh3ZfMAb',
  INTERNAL_EMAIL: 'info@movidasst.com',
  SENDER_NAME: 'Academia Movida SST',
  TIMEZONE: 'America/Santiago'
});

function corporateQuoteJson_(body) {
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function corporateQuoteSecret_() {
  var props = PropertiesService.getScriptProperties();
  var value = props.getProperty('MOODLE_EMAIL_SECRET') ||
    props.getProperty('EMAIL_SECRET') ||
    props.getProperty('ADMIN_EMAIL_SECRET') || '';
  try {
    if (!value && typeof EMAIL_SECRET !== 'undefined') value = String(EMAIL_SECRET || '');
  } catch (_) {}
  return String(value || '').trim();
}

function corporateQuoteAuthorized_(e) {
  var expected = corporateQuoteSecret_();
  var received = String((e && e.parameter && e.parameter.secret) || '').trim();
  return Boolean(expected && received && expected === received);
}

function corporateQuotePing_(e) {
  if (!corporateQuoteAuthorized_(e)) {
    return corporateQuoteJson_({ result: 'error', code: 'CORPORATE_UNAUTHORIZED', message: 'Unauthorized' });
  }
  return corporateQuoteJson_({ result: 'success', code: 'CORPORATE_QUOTE_READY', ok: true });
}

function corporateSafe_(value, maxLen) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen || 1000);
}

function corporateMoney_(value, decimals) {
  var n = Number(value || 0);
  return '$' + n.toLocaleString('en-US', {
    minimumFractionDigits: decimals == null ? (n % 1 ? 2 : 0) : decimals,
    maximumFractionDigits: decimals == null ? 2 : decimals
  }) + ' USD';
}

function corporateFolder_(parent, name) {
  var iter = parent.getFoldersByName(name);
  return iter.hasNext() ? iter.next() : parent.createFolder(name);
}

function corporateMonthFolder_(date) {
  var root = DriveApp.getFolderById(CORPORATE_QUOTE.PDF_ROOT_FOLDER_ID);
  var year = Utilities.formatDate(date, CORPORATE_QUOTE.TIMEZONE, 'yyyy');
  var monthNo = Utilities.formatDate(date, CORPORATE_QUOTE.TIMEZONE, 'MM');
  var monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var monthName = monthNames[Number(monthNo) - 1];
  return corporateFolder_(corporateFolder_(root, year), monthNo + ' - ' + monthName);
}

function corporateReplace_(body, key, value) {
  body.replaceText('\\{\\{' + key + '\\}\\}', String(value == null ? '' : value));
}

function corporateTariffText_(payload) {
  return (payload.ranges || []).map(function(r) {
    var range = r.to ? (r.from + '–' + r.to) : (r.from + '+');
    var unit = Number(r.from) === Number(payload.ranges[0].from) ? 'plaza / curso' : 'plaza adicional / curso';
    return '• ' + r.name + ' · ' + range + ': ' + corporateMoney_(r.rate) + ' por ' + unit + '.';
  }).join('\n');
}

function corporateDnfText_(payload) {
  if (payload.dnf_level === 'ampliada') {
    return 'DNF ampliada incluida. Contempla diagnóstico de necesidades, priorización, diseño del plan de capacitación, cronograma y lectura analítica según la escala contratada.';
  }
  if (payload.dnf_level === 'básica') {
    return 'DNF básica incluida. Contempla revisión inicial de necesidades y priorización de temas para orientar la formación.';
  }
  return 'La DNF no está incluida en esta escala y puede solicitarse como servicio complementario.';
}

function corporateCoursesText_(payload) {
  var items = Array.isArray(payload.selected_courses) ? payload.selected_courses.filter(Boolean) : [];
  if (payload.dnf_pending) items.push('Temas adicionales por definir mediante DNF');
  if (!items.length) return 'Por definir con la empresa.';
  return items.map(function(item) { return '• ' + corporateSafe_(item, 180); }).join('\n');
}

function corporatePaymentsText_(payload) {
  var methods = payload.commercial && Array.isArray(payload.commercial.payment_methods)
    ? payload.commercial.payment_methods : [];
  return methods.map(function(item) { return '• ' + corporateSafe_(item, 150); }).join('\n');
}

function corporateBuildPdf_(payload) {
  var now = new Date(payload.issued_at || Date.now());
  var monthFolder = corporateMonthFolder_(now);
  var companySlug = corporateSafe_(payload.company, 60).replace(/[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ -]/g, '').replace(/\s+/g, '_');
  var docName = 'Propuesta_' + payload.reference + '_' + companySlug;
  var template = DriveApp.getFileById(CORPORATE_QUOTE.TEMPLATE_DOC_ID);
  var copy = template.makeCopy(docName, monthFolder);
  var doc = DocumentApp.openById(copy.getId());
  var body = doc.getBody();
  var commercial = payload.commercial || {};
  var course = payload.course_config || {};
  var demo = payload.demo || {};
  var issued = Utilities.formatDate(now, CORPORATE_QUOTE.TIMEZONE, 'dd/MM/yyyy');
  var expiry = new Date(now.getTime() + Number(payload.validity_days || 15) * 86400000);
  var validity = Number(payload.validity_days || 15) + ' días · hasta ' + Utilities.formatDate(expiry, CORPORATE_QUOTE.TIMEZONE, 'dd/MM/yyyy');

  var replacements = {
    EMPRESA: payload.company,
    CONTACTO: payload.contact,
    CARGO_LINEA: payload.position ? ' · ' + payload.position : '',
    PAIS: payload.country,
    CORREO: payload.email,
    WHATSAPP: payload.whatsapp,
    REFERENCIA: payload.reference,
    FECHA: issued,
    VIGENCIA: validity,
    TOTAL: corporateMoney_(payload.total),
    PARTICIPANTES: payload.participants,
    CURSOS_CANT: payload.courses,
    PLAZAS: payload.seats,
    PROMEDIO: corporateMoney_(payload.average_rate, 2),
    MARGINAL: corporateMoney_(payload.marginal_rate),
    ESCALA: payload.tier,
    DESGLOSE: payload.breakdown + ' = ' + corporateMoney_(payload.per_course) + ' por curso',
    COSTO_CURSO: corporateMoney_(payload.per_course),
    CURSOS_LISTA: corporateCoursesText_(payload),
    DEMO_DIAS: demo.days || 30,
    DEMO_MAX: demo.max_participants || 20,
    BONUS: demo.bonus_course || 'Plan Familiar de Emergencias',
    TARIFAS: corporateTariffText_(payload),
    DNF_TEXTO: corporateDnfText_(payload),
    MATRICULA_DIAS: course.enrollment_days || 45,
    APROBACION: course.approval_percent || 80,
    SUSTITUCION_DIAS: course.substitution_days || 7,
    PAGOS: corporatePaymentsText_(payload),
    CHILE: corporateSafe_(commercial.chile_billing, 600),
    VENEZUELA: corporateSafe_(commercial.venezuela_billing, 900),
    PRELIMINAR: corporateSafe_(commercial.preliminary_note, 1200),
    NOTA_TECNICA: corporateSafe_(commercial.technical_note, 1200)
  };
  Object.keys(replacements).forEach(function(key) { corporateReplace_(body, key, replacements[key]); });
  doc.saveAndClose();
  Utilities.sleep(300);

  var pdfBlob = copy.getAs(MimeType.PDF).setName(docName + '.pdf');
  var pdfFile = monthFolder.createFile(pdfBlob);
  copy.setTrashed(true);
  return { pdfFile: pdfFile, pdfBlob: pdfBlob };
}

function corporateFindRequestRow_(sheet, requestId) {
  if (!requestId) return null;
  var finder = sheet.getRange('AC:AC').createTextFinder(requestId).matchEntireCell(true);
  var cell = finder.findNext();
  return cell ? cell.getRow() : null;
}

function corporateAppendLead_(payload, driveUrl) {
  var ss = SpreadsheetApp.openById(CORPORATE_QUOTE.CRM_SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CORPORATE_QUOTE.CRM_SHEET_NAME);
  if (!sheet) throw new Error('No existe la hoja CRM "' + CORPORATE_QUOTE.CRM_SHEET_NAME + '".');
  var existingRow = corporateFindRequestRow_(sheet, payload.request_id);
  if (existingRow) return { sheet: sheet, row: existingRow, duplicate: true };
  var now = new Date();
  var coursesText = (payload.selected_courses || []).join(' | ') || (payload.dnf_pending ? 'Por definir mediante DNF' : 'Por definir');
  var row = [
    now, payload.reference, payload.company, payload.contact, payload.position || '', payload.country,
    payload.whatsapp, payload.email, payload.participants, payload.courses, coursesText, payload.dnf_pending ? 'Sí' : 'No',
    payload.tier, payload.marginal_rate, payload.average_rate, payload.total, 'Nuevo', driveUrl,
    'PENDIENTE', '', payload.source || 'directo', payload.utm || '', payload.consent ? 'Sí' : 'No',
    'Contactar prospecto', '', '', payload.version || 'v1', '', payload.request_id
  ];
  sheet.appendRow(row);
  return { sheet: sheet, row: sheet.getLastRow(), duplicate: false };
}

function corporateCustomerHtml_(payload) {
  var courseList = corporateCoursesText_(payload).replace(/\n/g, '<br>');
  return '<!doctype html><html><body style="margin:0;background:#f3f7f8;font-family:Arial,sans-serif;color:#29465a">' +
    '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:24px 10px;background:#f3f7f8"><tr><td align="center">' +
    '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:680px;background:#fff;border-radius:18px;overflow:hidden">' +
    '<tr><td style="height:5px;background:linear-gradient(90deg,#00205b,#0f766e,#70ad47)"></td></tr>' +
    '<tr><td style="padding:25px;text-align:center;border-bottom:1px solid #e5eef1"><img src="https://raw.githubusercontent.com/movidasst/gestion/main/assets/logo-movida-sst-plus.png" width="105" style="display:block;margin:auto"><div style="font-size:21px;font-weight:900;color:#00205b;margin-top:7px">La Movida SST Plus</div><div style="font-size:12px;font-weight:800;color:#0f766e;text-transform:uppercase;letter-spacing:.08em">De la Reacción a la Prevención</div></td></tr>' +
    '<tr><td style="padding:30px 34px"><div style="font-size:13px;font-weight:800;color:#0f766e;text-transform:uppercase">Propuesta corporativa · ' + corporateSafe_(payload.reference,40) + '</div>' +
    '<h1 style="margin:8px 0 18px;font-size:26px;color:#00205b">Hola ' + corporateSafe_(payload.contact,160) + ',</h1>' +
    '<p style="font-size:16px;line-height:1.7;color:#486478">Preparamos la propuesta de capacitación corporativa en SST para <strong>' + corporateSafe_(payload.company,180) + '</strong> con los datos de tu cotización.</p>' +
    '<div style="margin:24px 0;padding:22px;border-radius:16px;background:linear-gradient(135deg,#00205b,#0f766e);color:#fff"><div style="font-size:12px;text-transform:uppercase;color:#b6e6e2;font-weight:800">Inversión estimada</div><div style="font-size:34px;font-weight:900;color:#ffd65a;margin-top:5px">' + corporateMoney_(payload.total) + '</div><div style="font-size:13px;color:#dcebf0;margin-top:8px">' + payload.participants + ' participantes · ' + payload.courses + ' cursos · ' + payload.seats + ' plazas-curso</div></div>' +
    '<table width="100%" cellpadding="8" cellspacing="0" style="font-size:14px;border-collapse:collapse"><tr><td style="border-bottom:1px solid #e7edf1;color:#607589">Escala</td><td align="right" style="border-bottom:1px solid #e7edf1;font-weight:800;color:#00205b">' + corporateSafe_(payload.tier,80) + '</td></tr><tr><td style="border-bottom:1px solid #e7edf1;color:#607589">Promedio efectivo / persona / curso</td><td align="right" style="border-bottom:1px solid #e7edf1;font-weight:800;color:#00205b">' + corporateMoney_(payload.average_rate,2) + '</td></tr><tr><td style="color:#607589">Temas de interés</td><td align="right" style="font-weight:700;color:#29465a">' + courseList + '</td></tr></table>' +
    '<p style="font-size:15px;line-height:1.7;color:#486478;margin-top:24px">Adjuntamos el PDF para que puedas revisarlo o compartirlo internamente con RRHH, SST, Compras o Gerencia. La propuesta tiene una vigencia de <strong>' + Number(payload.validity_days || 15) + ' días</strong>.</p>' +
    '<div style="text-align:center;margin:28px 0"><a href="https://wa.me/56968615650?text=' + encodeURIComponent('Hola David, quiero conversar sobre la propuesta ' + payload.reference + ' para ' + payload.company) + '" style="display:inline-block;background:#138a4b;color:#fff;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:12px">Hablar por WhatsApp</a></div>' +
    '<p style="font-size:14px;line-height:1.6;color:#607589">Saludos,<br><strong style="color:#00205b">David Linares Brea</strong><br>Academia Movida de Seguridad y Salud en el Trabajo<br>info@movidasst.com · +56 9 6861 5650</p></td></tr>' +
    '<tr><td style="padding:18px;background:#00205b;color:#dcebf0;text-align:center;font-size:11px">www.movidasst.com · De la Reacción a la Prevención.</td></tr>' +
    '</table></td></tr></table></body></html>';
}

function corporateInternalHtml_(payload, driveUrl) {
  return '<div style="font-family:Arial,sans-serif;color:#29465a;line-height:1.6"><h2 style="color:#00205b">Nuevo prospecto corporativo</h2>' +
    '<p><strong>' + corporateSafe_(payload.company,180) + '</strong> generó la propuesta <strong>' + corporateSafe_(payload.reference,40) + '</strong>.</p>' +
    '<ul><li>Contacto: ' + corporateSafe_(payload.contact,160) + (payload.position ? ' · ' + corporateSafe_(payload.position,120) : '') + '</li><li>Correo: ' + corporateSafe_(payload.email,254) + '</li><li>WhatsApp: ' + corporateSafe_(payload.whatsapp,40) + '</li><li>País: ' + corporateSafe_(payload.country,80) + '</li><li>Participantes: ' + payload.participants + '</li><li>Cursos: ' + payload.courses + '</li><li>Total: ' + corporateMoney_(payload.total) + '</li></ul>' +
    '<p><a href="' + driveUrl + '" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;font-weight:800;padding:11px 16px;border-radius:10px">Abrir PDF en Drive</a></p></div>';
}

function handleCorporateQuoteRequest_(e) {
  if (!corporateQuoteAuthorized_(e)) {
    return corporateQuoteJson_({ result: 'error', code: 'CORPORATE_UNAUTHORIZED', message: 'Unauthorized' });
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return corporateQuoteJson_({ result: 'error', code: 'CORPORATE_BUSY', message: 'El generador está ocupado. Intenta nuevamente.' });
  try {
    var payload = JSON.parse(String((e.parameter && e.parameter.payload) || '{}'));
    if (!payload || !payload.request_id || !payload.reference || !payload.email || !payload.company) {
      throw new Error('La propuesta recibida está incompleta.');
    }
    var ss = SpreadsheetApp.openById(CORPORATE_QUOTE.CRM_SPREADSHEET_ID);
    var sheet = ss.getSheetByName(CORPORATE_QUOTE.CRM_SHEET_NAME);
    if (!sheet) throw new Error('No existe la hoja CRM de prospectos.');
    var existingRow = corporateFindRequestRow_(sheet, payload.request_id);
    if (existingRow) {
      var existing = sheet.getRange(existingRow, 1, 1, 29).getValues()[0];
      return corporateQuoteJson_({ result: 'success', code: 'CORPORATE_QUOTE_DUPLICATE', drive_url: String(existing[17] || ''), reference: String(existing[1] || payload.reference), duplicate: true });
    }

    var built = corporateBuildPdf_(payload);
    var driveUrl = built.pdfFile.getUrl();
    var lead = corporateAppendLead_(payload, driveUrl);
    var subject = 'Propuesta de Capacitación Corporativa en SST | ' + corporateSafe_(payload.company,120);
    var plain = 'Hola ' + payload.contact + ',\n\nAdjuntamos la propuesta ' + payload.reference + ' para ' + payload.company + '.\nInversión estimada: ' + corporateMoney_(payload.total) + '.\n\nSaludos,\nAcademia Movida SST';
    GmailApp.sendEmail(payload.email, subject, plain, {
      htmlBody: corporateCustomerHtml_(payload),
      attachments: [built.pdfBlob],
      name: CORPORATE_QUOTE.SENDER_NAME,
      replyTo: CORPORATE_QUOTE.INTERNAL_EMAIL
    });
    lead.sheet.getRange(lead.row, 19).setValue('Sí');
    lead.sheet.getRange(lead.row, 20).setValue(new Date());

    GmailApp.sendEmail(
      CORPORATE_QUOTE.INTERNAL_EMAIL,
      'Nuevo prospecto corporativo — ' + corporateSafe_(payload.company,120) + ' · ' + payload.participants + ' participantes · ' + corporateMoney_(payload.total),
      'Nuevo prospecto: ' + payload.company + '\nPropuesta: ' + payload.reference + '\nDrive: ' + driveUrl,
      { htmlBody: corporateInternalHtml_(payload, driveUrl), name: CORPORATE_QUOTE.SENDER_NAME }
    );

    return corporateQuoteJson_({ result: 'success', code: 'CORPORATE_QUOTE_SENT', drive_url: driveUrl, reference: payload.reference, email_sent: true });
  } catch (error) {
    return corporateQuoteJson_({ result: 'error', code: 'CORPORATE_QUOTE_ERROR', message: error && error.message ? error.message : String(error) });
  } finally {
    lock.releaseLock();
  }
}
