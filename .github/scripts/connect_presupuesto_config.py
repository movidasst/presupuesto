from pathlib import Path
import re

path = Path('index.html')
text = path.read_text(encoding='utf-8')

# Load Supabase and the shared configuration client before the page application script.
font_anchor = '  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">\n'
config_scripts = font_anchor + '  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n  <script src="presupuesto-config.js"></script>\n'
if 'src="presupuesto-config.js"' not in text:
    if font_anchor not in text:
        raise SystemExit('Font Awesome anchor not found')
    text = text.replace(font_anchor, config_scripts, 1)

# Correct the canonical public URL while touching the document head.
text = text.replace('https://movidasst.org/propuesta-corporativa', 'https://presupuesto.movidasst.com/')

# Currency display must support decimal tariffs configured from admin.
text = text.replace(
    "const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });",
    "const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 });"
)

# Delegate tier benefits and progressive math to the protected configuration model.
pattern = re.compile(r"      function getTier\(count\) \{.*?\n      function inputBounds\(input\) \{", re.S)
replacement = """      function getTier(count) {
        return window.PresupuestoConfig.getTier(count);
      }

      function calculateProgressivePricing(count) {
        return window.PresupuestoConfig.calculate(count);
      }

      function inputBounds(input) {"""
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit(f'Could not replace pricing functions: {count}')

# List-price comparison is also configurable.
text = text.replace(
    'const listTotal = participants * courses * 15;',
    'const listTotal = participants * courses * Number(window.PresupuestoConfig.get().pricing.list_price || 15);'
)

# Dynamic DNF threshold in the live calculator.
text = text.replace(
    "dnfDisplay.textContent = tier.dnf ? 'Incluida' : 'Desde 12 participantes';",
    "dnfDisplay.textContent = tier.dnf ? 'Incluida' : `Desde ${window.PresupuestoConfig.get().pricing.tier1_max + 1} participantes`;"
)

# Print synchronization: derive thresholds from the saved configuration.
sync_anchor = "        const reference = makeReference(participants, courses);\n"
if 'const liveConfig = window.PresupuestoConfig.get();' not in text:
    if sync_anchor not in text:
        raise SystemExit('sync print anchor not found')
    text = text.replace(sync_anchor, sync_anchor + "        const liveConfig = window.PresupuestoConfig.get();\n        const dnfStart = Number(liveConfig.pricing.tier1_max) + 1;\n", 1)

text = text.replace(
    "if (printEls.dnf) printEls.dnf.textContent = tier.dnf ? 'Incluida sin costo adicional' : 'No incluida (disponible desde 12 participantes)';",
    "if (printEls.dnf) printEls.dnf.textContent = tier.dnf ? 'Incluida sin costo adicional' : `No incluida (disponible desde ${dnfStart} participantes)`;"
)
text = text.replace(
    "          : 'No incluida en esta escala. Se incorpora sin costo adicional a partir de 12 participantes.';",
    "          : `No incluida en esta escala. Se incorpora sin costo adicional a partir de ${dnfStart} participantes.`;"
)
text = text.replace(
    "const activeId = participants >= 100 ? 'printTierMass' : participants >= 50 ? 'printTierScale' : participants >= 12 ? 'printTierStandard' : 'printTierSmall';",
    "const activeId = participants >= Number(liveConfig.pricing.tier3_max) + 1 ? 'printTierMass' : participants >= Number(liveConfig.pricing.tier2_max) + 1 ? 'printTierScale' : participants >= Number(liveConfig.pricing.tier1_max) + 1 ? 'printTierStandard' : 'printTierSmall';"
)

# Add a discrete administration entry to the existing footer.
footer_anchor = '<a href="#top">Volver arriba ↑</a>'
if 'href="admin.html"' not in text:
    if footer_anchor not in text:
        raise SystemExit('footer anchor not found')
    text = text.replace(footer_anchor, footer_anchor + '<a href="admin.html" rel="nofollow"><i class="fa-solid fa-lock" aria-hidden="true"></i> Administración</a>', 1)

# Load current published settings after the existing app has initialized with safe defaults.
startup_anchor = '      updateBudget({ normalize: true });\n    })();'
startup_replacement = """      updateBudget({ normalize: true });
      window.PresupuestoConfig.load().then(() => {
        window.PresupuestoConfig.applyToDom();
        updateBudget({ normalize: true });
      }).catch((error) => console.warn('Configuración remota no disponible', error));
    })();"""
if 'window.PresupuestoConfig.load().then' not in text:
    if startup_anchor not in text:
        raise SystemExit('startup anchor not found')
    text = text.replace(startup_anchor, startup_replacement, 1)

path.write_text(text, encoding='utf-8')
print('index.html connected to dynamic presupuesto configuration')
