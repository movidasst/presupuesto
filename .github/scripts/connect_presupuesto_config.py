from pathlib import Path
import re

ROOT = Path('.')


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, content):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f'No se encontró el bloque esperado: {label}')
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# index.html — mobile SPA, accesibilidad y copy B2B
# ---------------------------------------------------------------------------
index = read('index.html')

if "document.getElementById('para-quien')" not in index[index.find('const mobileManagedSections'):index.find('const mobileManagedSections') + 1800]:
    index = re.sub(
        r"(const mobileManagedSections\s*=\s*\[\s*document\.querySelector\('\.hero'\),\s*document\.querySelector\('\.trust'\),)",
        r"\1\n        document.getElementById('para-quien'),",
        index,
        count=1,
    )

index = index.replace(
    "if (view === 'home') return [document.querySelector('.hero'), document.querySelector('.trust')].filter(Boolean);",
    "if (view === 'home') return [document.querySelector('.hero'), document.querySelector('.trust'), document.getElementById('para-quien')].filter(Boolean);",
    1,
)

index = index.replace(
    "'#top': ['home', null], '#contenido': ['home', null], '#demo': ['demo', null]",
    "'#top': ['home', null], '#contenido': ['home', null], '#para-quien': ['home', null], '#demo': ['demo', null]",
    1,
)

# Dedicated live region already exists; remove the obsolete large live region if present.
index = index.replace('class="budget-summary" aria-live="polite" aria-atomic="true"', 'class="budget-summary"')
index = index.replace('class="budget-summary" aria-live="polite"', 'class="budget-summary"')

# Avoid promises that sound instant/manual and remove hard-coded Demo duration from primary CTA/SEO.
index = index.replace('> Activar Demo 30 días</a>', '> Solicitar Demo Corporativo</a>')
index = index.replace(
    'content="Capacitación corporativa en Seguridad y Salud en el Trabajo con microlearning asincrónico, seguimiento de avance, certificados e informes para empresas. Demo corporativo gratuito por 30 días."',
    'content="Capacitación corporativa en Seguridad y Salud en el Trabajo con microlearning asincrónico, seguimiento, certificados, informes y Demo Corporativo para empresas."'
)
index = index.replace(
    'content="Capacitación Corporativa en SST | Demo 30 días"',
    'content="Capacitación Corporativa en SST | Academia Movida SST"'
)
index = index.replace('De la reacción a la prevención.', 'De la Reacción a la Prevención.')
index = index.replace('De la reacción a la prevención', 'De la Reacción a la Prevención')

# Remove public Admin discovery link if present; direct URL remains available to administrators.
index = re.sub(r'\s*<a[^>]+href=["\']admin\.html["\'][^>]*>.*?</a>', '', index, flags=re.I | re.S)

write('index.html', index)


# ---------------------------------------------------------------------------
# presupuesto-config.js — synchronized fallback + dynamic metadata
# ---------------------------------------------------------------------------
config = read('presupuesto-config.js')
old_payments = """      payment_methods: [
        'Transferencia bancaria / Pago Móvil',
        'PayPal',
        'Binance Pay / USDT'
      ],"""
new_payments = """      payment_methods: [
        'Transferencia Venezuela: Banco de Venezuela · Corriente · 0102-0236-1500-0033-6732 · Ezequiel Linares · C.I. 30.407.087 · https://www.bcv.org.ve/',
        'Venezuela · Pago Móvil: Banco de Venezuela · Ezequiel Linares · C.I. V-30.407.087 · 0412-6372223',
        'Binance USDT: BEP20 (BSC) · ID 176067584 · david.linaresb@gmail.com',
        'PayPal: https://www.paypal.com/paypalme/movidasst · movidasst@gmail.com'
      ],"""
if old_payments in config:
    config = config.replace(old_payments, new_payments, 1)

# Keep public metadata consistent with current admin configuration after load.
needle = """    const ranges = rangeData();
    const priceCards = [...document.querySelectorAll('#planes .price-card')];"""
replacement = """    const ranges = rangeData();
    const priceCards = [...document.querySelectorAll('#planes .price-card')];

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) metaDescription.content = `Capacitación corporativa en SST con microlearning asincrónico, seguimiento, certificados e informes. Demo Corporativo de ${d.days} días para hasta ${d.max_participants} participantes.`;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = `Capacitación Corporativa en SST | Demo ${d.days} días`;
    const heroDemoCta = document.querySelector('.hero__actions a[href="#demo"]');
    if (heroDemoCta) heroDemoCta.innerHTML = '<i class="fa-solid fa-rocket" aria-hidden="true"></i> Solicitar Demo Corporativo';"""
if needle in config and 'const metaDescription = document.querySelector' not in config:
    config = config.replace(needle, replacement, 1)

write('presupuesto-config.js', config)


# ---------------------------------------------------------------------------
# admin.html — payment-line guard mirrors PDF/server limits
# ---------------------------------------------------------------------------
admin = read('admin.html')
admin = admin.replace(
    '<label for="paymentMethods">Medios de pago</label><small>Uno por línea · máx. 8</small>',
    '<label for="paymentMethods">Medios de pago</label><small>Uno por línea · máx. 8 · 150 caracteres c/u</small>',
    1,
)
admin = admin.replace('id="paymentMethods" maxlength="800"', 'id="paymentMethods" maxlength="1200"', 1)

validate_needle = "if(!x.payment_methods.length||x.payment_methods.length>8)return'Debe existir entre 1 y 8 medios de pago.';"
validate_replacement = validate_needle + "\n        if(x.payment_methods.some(item=>item.length>150))return'Cada medio de pago debe tener como máximo 150 caracteres para proteger el PDF.';"
if validate_needle in admin and 'Cada medio de pago debe tener como máximo 150 caracteres' not in admin:
    admin = admin.replace(validate_needle, validate_replacement, 1)

safety_needle = """        const counts=[cfg.benefits.base.length,cfg.benefits.standard.length,cfg.benefits.scale.length,cfg.benefits.mass.length,cfg.demo.topics.length,cfg.commercial.payment_methods.length];
        const chars=cfg.commercial.chile_billing.length+cfg.commercial.venezuela_billing.length+cfg.commercial.preliminary_note.length+cfg.commercial.technical_note.length;
        const el=$('pdfSafety');
        if(counts.some((n,i)=>n>[14,8,8,8,20,8][i])||chars>3900){"""
safety_replacement = """        const counts=[cfg.benefits.base.length,cfg.benefits.standard.length,cfg.benefits.scale.length,cfg.benefits.mass.length,cfg.demo.topics.length,cfg.commercial.payment_methods.length];
        const chars=cfg.commercial.chile_billing.length+cfg.commercial.venezuela_billing.length+cfg.commercial.preliminary_note.length+cfg.commercial.technical_note.length;
        const paymentLineMax=Math.max(0,...cfg.commercial.payment_methods.map(item=>item.length));
        const el=$('pdfSafety');
        if(counts.some((n,i)=>n>[14,8,8,8,20,8][i])||chars>3900||paymentLineMax>150){"""
if safety_needle in admin:
    admin = admin.replace(safety_needle, safety_replacement, 1)

write('admin.html', admin)


# ---------------------------------------------------------------------------
# README — operational documentation
# ---------------------------------------------------------------------------
readme = r'''# Presupuesto Corporativo · Academia Movida SST

Aplicación B2B para cotizar, personalizar, generar y enviar propuestas de capacitación corporativa en Seguridad y Salud en el Trabajo.

**Producción:** https://presupuesto.movidasst.com/

## Arquitectura

- **GitHub Pages:** landing B2B, cotizador, navegación mobile-first y panel administrativo.
- **Supabase:** fuente única de configuración comercial, validación de precios, catálogo corporativo, historial/rollback y endpoint de propuestas.
- **Moodle:** categoría `27 · Cursos corporativos`, consultada mediante endpoint de solo lectura.
- **Google Apps Script:** generación transaccional del PDF, registro CRM y correos.
- **Google Drive:** plantilla maestra, PDFs privados y CRM de prospectos.

## Flujo de una propuesta

1. El prospecto calcula participantes y cursos sin entregar datos personales.
2. Después del resultado completa empresa, contacto, país, WhatsApp y correo.
3. Puede escoger cursos desde Moodle, indicar otro tema o dejarlo por definir mediante DNF.
4. Supabase vuelve a calcular el importe usando la configuración vigente; el navegador nunca decide el precio oficial.
5. Apps Script copia la plantilla de Google Docs, reemplaza variables y genera el PDF.
6. El PDF se guarda de forma privada en Drive.
7. El CRM registra el prospecto y la referencia idempotente.
8. El cliente recibe el PDF adjunto y `info@movidasst.com` recibe el aviso interno.

## Pricing progresivo

Tarifa acumulativa por tramos, no tarifa plana para toda la cohorte:

- Cohorte Base: participantes 1–11 a USD 7 por plaza/curso.
- Cohorte Corporativa: plazas 12–49 adicionales a USD 5.
- Cohorte Escala: plazas 50–99 adicionales a USD 4.
- Gran Cohorte: plazas 100+ adicionales a USD 3.

Ejemplos de control: 11 = USD 77; 12 = USD 82; 49 = USD 267; 50 = USD 271; 99 = USD 467; 100 = USD 470 por curso.

No existe monto mínimo de contratación.

## DNF

- Desde 12 participantes: **DNF básica**.
- Desde 50 participantes: **DNF ampliada**, con planificación según escala.

## Demo Corporativo

- Duración administrable; valor actual: 30 días.
- Máximo actual: 20 participantes.
- Temas corporativos respaldados en configuración y sincronizados con Moodle cuando está disponible.
- Bonus: Plan Familiar de Emergencias, fuera del número de cursos facturados.

## Archivos principales

- `index.html`: experiencia pública, cotizador y PDF local de impresión.
- `presupuesto-config.js`: configuración pública, pricing y sincronización DOM.
- `presupuesto-leads.js`: catálogo, formulario, atribución, envío y estado del backend.
- `admin.html`: panel protegido para configuración, historial y rollback.
- `integrations/apps-script-corporate-quote.gs`: módulo Apps Script instalado en el proyecto de correo existente.
- `tests/validate_project.py`: pruebas de pricing, integridad y regresiones.

## Seguridad e integridad

- El Admin usa Supabase Auth y valida rol administrativo mediante RPC.
- La configuración pública es de solo lectura.
- La configuración formal debe estar disponible en Supabase antes de habilitar el envío.
- El servidor recalcula precios y no acepta totales calculados por el cliente.
- El endpoint de propuestas incluye honeypot, tiempo mínimo de formulario e idempotencia.
- El PDF de Drive no se publica; el cliente lo recibe adjunto.
- El Apps Script reserva cuota de correo para mensajes esenciales de registro.
- Cada medio de pago está limitado a 150 caracteres para proteger la maquetación del PDF.

## PDF

La propuesta canónica enviada por correo se genera desde Google Docs y se conserva en Drive. La impresión del navegador es una copia local complementaria.

La plantilla mantiene dos páginas lógicas. El panel Admin y el servidor aplican límites de longitud para evitar desbordamientos accidentales.

## Validación automática

Cada `push` o `pull_request` ejecuta `.github/workflows/validate.yml`, que comprueba:

- sintaxis de JavaScript;
- estructura básica de HTML;
- pricing en fronteras 11→12, 49→50 y 99→100;
- monotonía del precio acumulado;
- configuración de pagos segura para PDF;
- integración de `#para-quien` en la SPA móvil;
- ausencia de infraestructura temporal de parcheo.

## Operación

Para cambiar tarifas, Demo, beneficios, condiciones o medios de pago se utiliza `admin.html`; no se editan manualmente los precios en `index.html`.

La URL desplegada de Apps Script debe mantenerse estable. Cuando se modifica el módulo, se actualiza la **implementación web existente**, no se crea otra URL.

## Licencia

GNU Affero General Public License v3.0. Consulta `LICENSE`.
'''
write('README.md', readme)


# ---------------------------------------------------------------------------
# Permanent tests
# ---------------------------------------------------------------------------
test = r'''from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
config = (ROOT / 'presupuesto-config.js').read_text(encoding='utf-8')
index = (ROOT / 'index.html').read_text(encoding='utf-8')
admin = (ROOT / 'admin.html').read_text(encoding='utf-8')
leads = (ROOT / 'presupuesto-leads.js').read_text(encoding='utf-8')


def grab(name):
    m = re.search(rf'\b{name}:\s*([0-9]+(?:\.[0-9]+)?)', config)
    assert m, f'No se encontró {name} en DEFAULT_CONFIG'
    return float(m.group(1))


t1, t2, t3 = int(grab('tier1_max')), int(grab('tier2_max')), int(grab('tier3_max'))
r1, r2, r3, r4 = grab('rate1'), grab('rate2'), grab('rate3'), grab('rate4')


def price(n):
    q1 = min(n, t1)
    q2 = max(0, min(n, t2) - t1)
    q3 = max(0, min(n, t3) - t2)
    q4 = max(0, n - t3)
    return q1*r1 + q2*r2 + q3*r3 + q4*r4


expected = {3:21, 11:77, 12:82, 49:267, 50:271, 99:467, 100:470, 200:770, 1000:3170}
for n, total in expected.items():
    assert abs(price(n) - total) < 1e-9, f'Precio incorrecto para {n}: {price(n)} != {total}'

for n in range(1, 2000):
    assert price(n + 1) >= price(n), f'El precio acumulado disminuye en {n}->{n+1}'

assert abs((price(12)-price(11))-r2) < 1e-9
assert abs((price(50)-price(49))-r3) < 1e-9
assert abs((price(100)-price(99))-r4) < 1e-9

assert "document.getElementById('para-quien')" in index, 'La sección para-quien no está gestionada por mobile SPA'
assert "document.getElementById('para-quien')].filter(Boolean)" in index, 'para-quien no está incluida en Inicio móvil'
assert '#para-quien' in index, 'Falta ruta móvil para para-quien'
assert 'Activar Demo 30 días' not in index, 'CTA Demo conserva duración rígida'
assert 'aria-live="polite" aria-atomic="true"' not in re.sub(r'id="budgetLiveStatus"[^>]*', '', index), 'Existe aria-live redundante'

assert 'Cada medio de pago debe tener como máximo 150 caracteres' in admin, 'Admin no protege longitud de pagos'
assert 'paymentLineMax>150' in admin, 'Indicador PDF no controla líneas de pago'

for marker in [
    '0102-0236-1500-0033-6732',
    '0412-6372223',
    '176067584',
    'paypal.com/paypalme/movidasst'
]:
    assert marker in config, f'Falta medio de pago en fallback: {marker}'

assert 'request_id' in leads and 'form_started_ms' in leads and 'leadWebsite' in leads, 'Faltan controles básicos anti-duplicado/anti-bot'
assert (ROOT / 'integrations/apps-script-corporate-quote.gs').exists(), 'Falta módulo Apps Script versionado'
assert not (ROOT / '.github/scripts/connect_presupuesto_config.py').exists(), 'Quedó script temporal de parcheo'
assert not (ROOT / '.github/workflows/connect-presupuesto-config.yml').exists(), 'Quedó workflow temporal de parcheo'

print('OK: pricing, mobile, pagos, leads e integridad del proyecto validados.')
'''
write('tests/validate_project.py', test)

validate_workflow = r'''name: Validate corporate quote app

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - name: JavaScript syntax
        run: |
          node --check presupuesto-config.js
          node --check presupuesto-leads.js
      - name: Extract and validate inline scripts
        run: |
          python - <<'PY'
          from pathlib import Path
          import re
          for name in ('index.html','admin.html'):
              text=Path(name).read_text(encoding='utf-8')
              scripts=re.findall(r'<script(?:\s[^>]*)?>([\s\S]*?)</script>',text,re.I)
              for i,code in enumerate(scripts):
                  if not code.strip() or code.lstrip().startswith('{'): continue
                  p=Path(f'/tmp/{name}-{i}.js'); p.write_text(code,encoding='utf-8')
                  print(p)
          PY
          for f in /tmp/index.html-*.js /tmp/admin.html-*.js; do
            [ -e "$f" ] && node --check "$f"
          done
      - name: Project regression tests
        run: python tests/validate_project.py
'''
write('.github/workflows/validate.yml', validate_workflow)

# Remove one-off patch infrastructure from final state.
for path in [
    ROOT / '.github/scripts/connect_presupuesto_config.py',
    ROOT / '.github/workflows/connect-presupuesto-config.yml',
]:
    if path.exists():
        path.unlink()

print('Final cleanup applied successfully.')
