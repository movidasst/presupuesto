from pathlib import Path
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
