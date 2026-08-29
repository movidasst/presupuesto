from pathlib import Path

path = Path('index.html')
text = path.read_text(encoding='utf-8')

# --- Pricing section copy and cards ---
text = text.replace(
'''          <span class="eyebrow"><i class="fa-solid fa-tags" aria-hidden="true"></i> Inversión por volumen</span>
          <h2 id="pricing-title">Tarifas claras por participante</h2>
          <p>Valores netos por participante y por curso de 4 horas académicas, con 45 días de matrícula. Mínimo de contratación: 3 participantes.</p>''',
'''          <span class="eyebrow"><i class="fa-solid fa-layer-group" aria-hidden="true"></i> Tarifas progresivas por volumen</span>
          <h2 id="pricing-title">Mientras crece la cohorte, baja el costo de las plazas adicionales</h2>
          <p>El precio se calcula por tramos: cada tarifa se aplica únicamente a las plazas que caen dentro de ese tramo. Al pasar a una escala superior, las plazas anteriores conservan su tarifa. Mínimo de contratación: 3 participantes.</p>'''
)

text = text.replace(
'<div class="price-card__right"><span class="price-card__list">Lista $15</span><span class="price-card__price">$7</span><span class="price-card__unit">USD / persona</span></div>',
'<div class="price-card__right"><span class="price-card__list">Tramo 3–11</span><span class="price-card__price">$7</span><span class="price-card__unit">USD / plaza / curso</span></div>', 1
)
text = text.replace(
'<div class="price-card__right"><span class="price-card__list">Lista $15</span><span class="price-card__price">$5</span><span class="price-card__unit">USD / persona</span></div>',
'<div class="price-card__right"><span class="price-card__list">Plazas 12–49</span><span class="price-card__price">$5</span><span class="price-card__unit">USD / plaza adicional / curso</span></div>', 1
)
text = text.replace(
'<div class="price-card__right"><span class="price-card__list">Lista $15</span><span class="price-card__price">$4</span><span class="price-card__unit">USD / persona</span></div>',
'<div class="price-card__right"><span class="price-card__list">Plazas 50–99</span><span class="price-card__price">$4</span><span class="price-card__unit">USD / plaza adicional / curso</span></div>', 1
)
text = text.replace(
'<div class="price-card__right"><span class="price-card__list">Lista $15</span><span class="price-card__price">$3</span><span class="price-card__unit">USD / persona</span></div>',
'<div class="price-card__right"><span class="price-card__list">Plazas 100+</span><span class="price-card__price">$3</span><span class="price-card__unit">USD / plaza adicional / curso</span></div>', 1
)

old_note = '''            <p style="margin:14px 2px 0;color:var(--muted);font-size:.72rem;">* Valores expresados en USD. Impuestos y facturación dependen del país y del documento fiscal requerido.</p>'''
new_note = '''            <div style="margin:14px 2px 0;padding:12px 14px;border:1px solid #cfe5e3;border-radius:13px;background:#f0f8f7;color:#355566;font-size:.74rem;line-height:1.5;"><strong style="color:#0f5f59;">Cómo funciona el precio progresivo:</strong> las primeras plazas se calculan en su tramo y solo las plazas adicionales reciben la tarifa menor del siguiente tramo. Por eso, agregar participantes nunca reduce el valor total de la contratación.</div>
            <p style="margin:10px 2px 0;color:var(--muted);font-size:.72rem;">* Valores expresados en USD por curso. Impuestos y facturación dependen del país y del documento fiscal requerido.</p>'''
text = text.replace(old_note, new_note, 1)

text = text.replace('<div class="pricing-cta__total"><span>Presupuesto</span><strong>$600</strong></div>', '<div class="pricing-cta__total"><span>Presupuesto</span><strong>$688</strong></div>', 1)
text = text.replace('La tarifa se aplica automáticamente según el tamaño de la cohorte.', 'El cálculo aplica automáticamente cada tramo progresivo según el tamaño de la cohorte.', 1)

# --- Budget heading and metrics ---
text = text.replace(
'          <p>Indica cuántas personas participarán y cuántos cursos necesitas. El sistema aplica automáticamente la tarifa por volumen y calcula la inversión total estimada.</p>',
'          <p>Indica cuántas personas participarán y cuántos cursos necesitas. El sistema calcula cada tramo progresivo, muestra la tarifa marginal alcanzada y el costo promedio efectivo por persona.</p>', 1
)

old_metrics = '''            <div class="budget-metrics">
              <div class="budget-metric"><span>Escala aplicada</span><strong id="budgetTier">Grupo estándar</strong></div>
              <div class="budget-metric"><span>Tarifa por persona / curso</span><strong id="budgetUnitPrice">$5 USD</strong></div>
              <div class="budget-metric"><span>Participantes</span><strong id="budgetParticipantDisplay">15</strong></div>
              <div class="budget-metric"><span>Cursos</span><strong id="budgetCourseDisplay">1</strong></div>
              <div class="budget-metric"><span>Plazas-curso</span><strong id="budgetSeats">15</strong></div>
              <div class="budget-metric"><span>DNF</span><strong id="budgetDnf">Incluida</strong></div>
            </div>'''
new_metrics = '''            <div class="budget-metrics">
              <div class="budget-metric"><span>Escala alcanzada</span><strong id="budgetTier">Grupo estándar</strong></div>
              <div class="budget-metric"><span>Tarifa marginal del tramo</span><strong id="budgetUnitPrice">$5 USD</strong></div>
              <div class="budget-metric"><span>Promedio efectivo persona / curso</span><strong id="budgetAveragePrice">$6.47 USD</strong></div>
              <div class="budget-metric"><span>Participantes</span><strong id="budgetParticipantDisplay">15</strong></div>
              <div class="budget-metric"><span>Cursos</span><strong id="budgetCourseDisplay">1</strong></div>
              <div class="budget-metric"><span>Plazas-curso</span><strong id="budgetSeats">15</strong></div>
              <div class="budget-metric"><span>DNF</span><strong id="budgetDnf">Incluida</strong></div>
            </div>'''
if old_metrics not in text:
    raise SystemExit('Budget metrics anchor not found')
text = text.replace(old_metrics, new_metrics, 1)

text = text.replace('<div><span>Subtotal por curso</span><strong id="budgetPerCourse">$75 USD</strong></div>', '<div><span>Costo progresivo por curso</span><strong id="budgetPerCourse">$97 USD</strong></div>', 1)
text = text.replace('<div><span>Diferencia vs. tarifa lista</span><strong id="budgetSavings">$150 USD</strong></div>', '<div><span>Ahorro vs. tarifa lista</span><strong id="budgetSavings">$128 USD</strong></div>', 1)
text = text.replace('''            </div>

            <div class="budget-benefits">''', '''            </div>
            <p class="budget-progressive-note" id="budgetProgressiveNote">Cálculo por curso: 11×$7 + 4×$5 = $97.</p>

            <div class="budget-benefits">''', 1)

# Add styles for the progressive explanation in the calculator.
css_anchor = '    .budget-disclaimer { margin: 12px 0 0; color: #8fa4b8; font-size: .66rem; line-height: 1.45; }\n'
if '.budget-progressive-note' not in text:
    if css_anchor not in text:
        raise SystemExit('Budget CSS anchor not found')
    text = text.replace(css_anchor, css_anchor + '    .budget-progressive-note { margin: 12px 0 0; padding: 10px 12px; border-radius: 12px; background: rgba(118,213,219,.10); border: 1px solid rgba(118,213,219,.16); color: #cfe5ed; font-size: .7rem; line-height: 1.45; }\n', 1)

# --- Visible FAQ and operating terms ---
faq_anchor = '''          <details>
            <summary>¿Puedo pedir una cotización para más de 200 participantes?</summary>'''
faq_new = '''          <details>
            <summary>¿Cómo se calculan las tarifas progresivas?</summary>
            <p>Cada tarifa se aplica solo a las plazas incluidas dentro de su tramo. Por ejemplo, al llegar a 100 participantes no se recalculan las primeras 99 plazas a $3; únicamente la plaza 100 y las siguientes usan la tarifa de $3 por curso.</p>
          </details>
          <details>
            <summary>¿Puedo pedir una cotización para más de 200 participantes?</summary>'''
if '¿Cómo se calculan las tarifas progresivas?' not in text:
    text = text.replace(faq_anchor, faq_new, 1)

terms_anchor = '''              <li><i class="fa-solid fa-check" aria-hidden="true"></i><span><b>Servicios complementarios por escala:</b> el diseño del plan de capacitación y el cronograma de ejecución aplican según el volumen contratado.</span></li>'''
terms_new = '''              <li><i class="fa-solid fa-check" aria-hidden="true"></i><span><b>Tarificación progresiva:</b> cada tarifa se aplica únicamente a las plazas ubicadas en su tramo; al alcanzar un tramo superior no se recalculan hacia atrás las plazas anteriores.</span></li>
              <li><i class="fa-solid fa-check" aria-hidden="true"></i><span><b>Servicios complementarios por escala:</b> el diseño del plan de capacitación y el cronograma de ejecución aplican según el volumen contratado.</span></li>'''
if '<b>Tarificación progresiva:</b>' not in text:
    text = text.replace(terms_anchor, terms_new, 1)

# --- Print copy ---
text = text.replace(
'      <p class="print-intro">Estimación generada a partir del número de participantes y cursos seleccionados en el cotizador corporativo. El cálculo aplica automáticamente la escala de precios por volumen vigente en esta propuesta.</p>',
'      <p class="print-intro">Estimación generada a partir del número de participantes y cursos seleccionados en el cotizador corporativo. El cálculo utiliza tarifas progresivas por tramos: cada tarifa se aplica únicamente a las plazas correspondientes a ese tramo.</p>', 1
)
text = text.replace('<div class="print-stat"><span>Tarifa persona / curso</span><strong id="printUnitPrice">—</strong></div>', '<div class="print-stat"><span>Promedio efectivo / persona / curso</span><strong id="printUnitPrice">—</strong></div>', 1)
text = text.replace('<div class="print-calc-row"><span>Subtotal por curso</span><strong id="printPerCourse">—</strong></div>', '<div class="print-calc-row"><span>Costo progresivo por curso</span><strong id="printPerCourse">—</strong></div>', 1)
text = text.replace('<div class="print-calc-row"><span>DNF</span><strong id="printDnf">—</strong></div>', '<div class="print-calc-row"><span>Tarifa marginal alcanzada</span><strong id="printMarginalPrice">—</strong></div>\n          <div class="print-calc-row"><span>DNF</span><strong id="printDnf">—</strong></div>', 1)
text = text.replace('<div class="print-calc-row"><span>Diferencia vs. tarifa lista</span><strong id="printSavings">—</strong></div>', '<div class="print-calc-row"><span>Ahorro vs. tarifa lista</span><strong id="printSavings">—</strong></div>', 1)

text = text.replace('<h3 class="print-section-title">Escala de tarifas por volumen</h3>', '<h3 class="print-section-title">Tarifas progresivas por volumen</h3>', 1)
text = text.replace('<thead><tr><th>Grupo</th><th>Participantes</th><th>Tarifa convenio</th><th>Beneficio</th></tr></thead>', '<thead><tr><th>Grupo</th><th>Participantes</th><th>Tarifa del tramo</th><th>Beneficio</th></tr></thead>', 1)
text = text.replace('<tr id="printTierSmall"><td>Grupo menor</td><td>3 a 11</td><td>$7 USD / persona / curso</td>', '<tr id="printTierSmall"><td>Grupo menor</td><td>3 a 11</td><td>$7 USD / plaza / curso</td>', 1)
text = text.replace('<tr id="printTierStandard"><td>Grupo estándar</td><td>12 a 49</td><td>$5 USD / persona / curso</td>', '<tr id="printTierStandard"><td>Grupo estándar</td><td>12 a 49</td><td>$5 USD / plaza adicional / curso</td>', 1)
text = text.replace('<tr id="printTierScale"><td>Grupo escala</td><td>50 a 99</td><td>$4 USD / persona / curso</td>', '<tr id="printTierScale"><td>Grupo escala</td><td>50 a 99</td><td>$4 USD / plaza adicional / curso</td>', 1)
text = text.replace('<tr id="printTierMass"><td>Grupo masivo</td><td>100+</td><td>$3 USD / persona / curso</td>', '<tr id="printTierMass"><td>Grupo masivo</td><td>100+</td><td>$3 USD / plaza adicional / curso</td>', 1)
text = text.replace('Mínimo de contratación: 3 participantes por cohorte. Precios netos expresados en USD y aplicados por persona, por curso.', 'Mínimo de contratación: 3 participantes por cohorte. Modelo progresivo: cada tarifa se aplica solo a las plazas de su tramo; las plazas anteriores mantienen su tarifa al pasar de escala.', 1)

print_terms_anchor = '''          <li><b>Servicios complementarios por escala:</b> el diseño del plan de capacitación y el cronograma de ejecución aplican según el volumen contratado.</li>'''
print_terms_new = '''          <li><b>Tarificación progresiva:</b> cada tarifa se aplica únicamente a las plazas de su tramo; al alcanzar un tramo superior no se recalculan las plazas anteriores.</li>
          <li><b>Servicios complementarios por escala:</b> el diseño del plan de capacitación y el cronograma de ejecución aplican según el volumen contratado.</li>'''
if text.count('<b>Tarificación progresiva:</b>') < 2:
    text = text.replace(print_terms_anchor, print_terms_new, 1)

# --- JavaScript DOM bindings ---
text = text.replace("      const unitDisplay = document.getElementById('budgetUnitPrice');\n", "      const unitDisplay = document.getElementById('budgetUnitPrice');\n      const averageDisplay = document.getElementById('budgetAveragePrice');\n", 1)
text = text.replace("      const totalDisplay = document.getElementById('budgetTotal');\n", "      const totalDisplay = document.getElementById('budgetTotal');\n      const progressiveNote = document.getElementById('budgetProgressiveNote');\n", 1)
text = text.replace("      const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });\n", "      const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });\n      const rateMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });\n", 1)
text = text.replace("        unit: document.getElementById('printUnitPrice'),\n", "        unit: document.getElementById('printUnitPrice'),\n        marginal: document.getElementById('printMarginalPrice'),\n", 1)

# Update print synchronization signature and values.
text = text.replace(
"      function syncPrintProposal({ participants, courses, tier, seats, perCourse, total, listTotal, difference }) {",
"      function syncPrintProposal({ participants, courses, tier, seats, perCourse, total, listTotal, difference, averageRate, marginalRate }) {", 1
)
text = text.replace("        if (printEls.unit) printEls.unit.textContent = `${money.format(tier.price)} USD`;\n", "        if (printEls.unit) printEls.unit.textContent = `${rateMoney.format(averageRate)} USD`;\n        if (printEls.marginal) printEls.marginal.textContent = `${money.format(marginalRate)} USD`;\n", 1)

# Add progressive pricing function after getTier.
get_tier_end = '''        return {
          name: 'Grupo menor',
          price: 7,
          dnf: false,
          benefits: baseBenefits,
          planningScope: 'Incluye acceso, evaluación, certificados, registro de asistencia, informe básico de participación y resultados, grupo de WhatsApp de soporte por curso y ayuda con IA para resumir y explicar contenidos.'
        };
      }
'''
progressive_fn = get_tier_end + '''
      function calculateProgressivePricing(count) {
        const tranche1 = Math.min(count, 11);
        const tranche2 = Math.max(0, Math.min(count, 49) - 11);
        const tranche3 = Math.max(0, Math.min(count, 99) - 49);
        const tranche4 = Math.max(0, count - 99);
        const tranches = [
          { quantity: tranche1, rate: 7 },
          { quantity: tranche2, rate: 5 },
          { quantity: tranche3, rate: 4 },
          { quantity: tranche4, rate: 3 }
        ].filter(item => item.quantity > 0);
        const perCourse = tranches.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
        const marginalRate = count >= 100 ? 3 : count >= 50 ? 4 : count >= 12 ? 5 : 7;
        const averageRate = perCourse / count;
        const breakdown = tranches.map(item => `${item.quantity}×${money.format(item.rate)}`).join(' + ');
        return { perCourse, marginalRate, averageRate, breakdown };
      }
'''
if 'function calculateProgressivePricing' not in text:
    if get_tier_end not in text:
        raise SystemExit('getTier end anchor not found')
    text = text.replace(get_tier_end, progressive_fn, 1)

# Replace flat pricing calculation with progressive pricing.
old_calc = '''        const tier = getTier(participants);
        const seats = participants * courses;
        const perCourse = participants * tier.price;
        const total = perCourse * courses;
        const listTotal = participants * courses * 15;
        const difference = listTotal - total;

        tierDisplay.textContent = tier.name;
        unitDisplay.textContent = `${money.format(tier.price)} USD`;
        participantDisplay.textContent = String(participants);
        courseDisplay.textContent = String(courses);
        seatsDisplay.textContent = seats.toLocaleString('es-ES');
        dnfDisplay.textContent = tier.dnf ? 'Incluida' : 'Desde 12 participantes';
        dnfDisplay.style.color = tier.dnf ? '#9be483' : '#c1cfdd';
        perCourseDisplay.textContent = `${money.format(perCourse)} USD`;
        savingsDisplay.textContent = `${money.format(difference)} USD`;
        totalDisplay.textContent = `${money.format(total)} USD`;
        if (budgetBenefits) {
          budgetBenefits.innerHTML = tier.benefits.map(item => `<span class="budget-benefit"><i class="fa-solid fa-check" aria-hidden="true"></i>${item}</span>`).join('');
        }

        syncPrintProposal({ participants, courses, tier, seats, perCourse, total, listTotal, difference });

        const courseWord = courses === 1 ? 'curso' : 'cursos';
        const participantWord = participants === 1 ? 'participante' : 'participantes';
        const message = `Hola David, armé un presupuesto preliminar para ${participants} ${participantWord} y ${courses} ${courseWord}. La tarifa aplicada es ${money.format(tier.price)} USD por persona por curso y la inversión total estimada es ${money.format(total)} USD. Quisiera solicitar una cotización formal para mi empresa.`;
        whatsappBtn.href = `https://wa.me/56968615650?text=${encodeURIComponent(message)}`;'''
new_calc = '''        const tier = getTier(participants);
        const pricing = calculateProgressivePricing(participants);
        const seats = participants * courses;
        const perCourse = pricing.perCourse;
        const total = perCourse * courses;
        const listTotal = participants * courses * 15;
        const difference = listTotal - total;

        tierDisplay.textContent = tier.name;
        unitDisplay.textContent = `${money.format(pricing.marginalRate)} USD`;
        if (averageDisplay) averageDisplay.textContent = `${rateMoney.format(pricing.averageRate)} USD`;
        participantDisplay.textContent = String(participants);
        courseDisplay.textContent = String(courses);
        seatsDisplay.textContent = seats.toLocaleString('es-ES');
        dnfDisplay.textContent = tier.dnf ? 'Incluida' : 'Desde 12 participantes';
        dnfDisplay.style.color = tier.dnf ? '#9be483' : '#c1cfdd';
        perCourseDisplay.textContent = `${money.format(perCourse)} USD`;
        savingsDisplay.textContent = `${money.format(difference)} USD`;
        totalDisplay.textContent = `${money.format(total)} USD`;
        if (progressiveNote) progressiveNote.textContent = `Cálculo por curso: ${pricing.breakdown} = ${money.format(perCourse)}. Promedio efectivo: ${rateMoney.format(pricing.averageRate)} por persona.`;
        if (budgetBenefits) {
          budgetBenefits.innerHTML = tier.benefits.map(item => `<span class="budget-benefit"><i class="fa-solid fa-check" aria-hidden="true"></i>${item}</span>`).join('');
        }

        syncPrintProposal({ participants, courses, tier, seats, perCourse, total, listTotal, difference, averageRate: pricing.averageRate, marginalRate: pricing.marginalRate });

        const courseWord = courses === 1 ? 'curso' : 'cursos';
        const participantWord = participants === 1 ? 'participante' : 'participantes';
        const message = `Hola David, armé un presupuesto preliminar para ${participants} ${participantWord} y ${courses} ${courseWord} con tarifas progresivas por tramo. La tarifa marginal alcanzada es ${money.format(pricing.marginalRate)} USD por plaza/curso, el promedio efectivo es ${rateMoney.format(pricing.averageRate)} USD por persona/curso y la inversión total estimada es ${money.format(total)} USD. Quisiera solicitar una cotización formal para mi empresa.`;
        whatsappBtn.href = `https://wa.me/56968615650?text=${encodeURIComponent(message)}`;'''
if old_calc not in text:
    raise SystemExit('Flat pricing calculation block not found')
text = text.replace(old_calc, new_calc, 1)

# Keep JSON-LD semantically clear about the low/high rate being tranche rates.
text = text.replace('"offerCount": "4"', '"offerCount": "4",\n          "description": "Tarifas progresivas por tramos entre 3 y 7 USD por plaza y curso, según el volumen de la cohorte."', 1)

path.write_text(text, encoding='utf-8')
print('Progressive pricing model applied')
