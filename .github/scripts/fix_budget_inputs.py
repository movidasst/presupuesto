from pathlib import Path

path = Path('index.html')
text = path.read_text(encoding='utf-8')

# Improve disabled stepper feedback.
css_old = '''    .stepper-btn:hover { background: var(--soft-brand); border-color: #a9d5d8; }
    .stepper-btn:active { transform: scale(.96); }
    .budget-help { display: block; margin-top: 10px; color: var(--muted); font-size: .68rem; }
'''
css_new = '''    .stepper-btn:hover { background: var(--soft-brand); border-color: #a9d5d8; }
    .stepper-btn:active { transform: scale(.96); }
    .stepper-btn:disabled { opacity: .38; cursor: not-allowed; background: #f3f5f7; border-color: #e1e7ec; color: #8e9baa; transform: none; }
    .stepper-btn:disabled:hover { background: #f3f5f7; border-color: #e1e7ec; }
    .budget-help { display: block; margin-top: 10px; color: var(--muted); font-size: .68rem; }
'''
if css_old not in text:
    raise SystemExit('Stepper CSS anchor not found')
text = text.replace(css_old, css_new, 1)

# Replace aggressive clamp/update behavior. The previous implementation clamped an empty input
# immediately to its minimum on every input event, which made mobile editing feel "stuck" at 3/1.
js_old = '''      function clampNumber(input) {
        const min = Number(input.min || 0);
        const max = Number(input.max || Number.MAX_SAFE_INTEGER);
        let value = Number.parseInt(input.value, 10);
        if (!Number.isFinite(value)) value = min;
        value = Math.min(max, Math.max(min, value));
        input.value = String(value);
        return value;
      }

      function updateBudget() {
        if (!participantsInput || !coursesInput) return;
        const participants = clampNumber(participantsInput);
        const courses = clampNumber(coursesInput);
        const tier = getTier(participants);
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
        whatsappBtn.href = `https://wa.me/56968615650?text=${encodeURIComponent(message)}`;
      }

      document.querySelectorAll('.stepper-btn').forEach((button) => {
        button.addEventListener('click', () => {
          const input = document.getElementById(button.dataset.target);
          if (!input) return;
          const delta = Number(button.dataset.step || 0);
          const current = Number.parseInt(input.value, 10) || Number(input.min) || 0;
          input.value = String(current + delta);
          updateBudget();
        });
      });

      participantsInput?.addEventListener('input', updateBudget);
      coursesInput?.addEventListener('input', updateBudget);
      participantsInput?.addEventListener('change', updateBudget);
      coursesInput?.addEventListener('change', updateBudget);
'''

js_new = '''      function inputBounds(input) {
        return {
          min: Number(input.min || 0),
          max: Number(input.max || Number.MAX_SAFE_INTEGER)
        };
      }

      function readNumber(input) {
        if (!input) return null;
        const raw = String(input.value ?? '').trim();
        if (raw === '') return null;
        const value = Number.parseInt(raw, 10);
        if (!Number.isFinite(value)) return null;
        const { min, max } = inputBounds(input);
        if (value < min || value > max) return null;
        return value;
      }

      function clampNumber(input) {
        const { min, max } = inputBounds(input);
        const raw = String(input.value ?? '').trim();
        let value = Number.parseInt(raw, 10);
        if (!Number.isFinite(value)) value = min;
        value = Math.min(max, Math.max(min, value));
        input.value = String(value);
        return value;
      }

      function updateStepperStates() {
        document.querySelectorAll('.stepper-btn').forEach((button) => {
          const input = document.getElementById(button.dataset.target);
          if (!input) return;
          const delta = Number(button.dataset.step || 0);
          const value = readNumber(input);
          const { min, max } = inputBounds(input);
          if (delta < 0) button.disabled = value === null || value <= min;
          if (delta > 0) button.disabled = value !== null && value >= max;
        });
      }

      function updateBudget({ normalize = false } = {}) {
        if (!participantsInput || !coursesInput) return;

        const participants = normalize ? clampNumber(participantsInput) : readNumber(participantsInput);
        const courses = normalize ? clampNumber(coursesInput) : readNumber(coursesInput);
        updateStepperStates();

        // During direct editing on mobile, an input can briefly be empty or incomplete.
        // Preserve that state instead of forcing the minimum value back into the field.
        if (participants === null || courses === null) return;

        const tier = getTier(participants);
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
        whatsappBtn.href = `https://wa.me/56968615650?text=${encodeURIComponent(message)}`;
      }

      document.querySelectorAll('.stepper-btn').forEach((button) => {
        button.addEventListener('click', () => {
          const input = document.getElementById(button.dataset.target);
          if (!input) return;
          const delta = Number(button.dataset.step || 0);
          const { min, max } = inputBounds(input);
          const current = readNumber(input) ?? min;
          const next = Math.min(max, Math.max(min, current + delta));
          input.value = String(next);
          updateBudget({ normalize: true });
        });
      });

      [participantsInput, coursesInput].forEach((input) => {
        if (!input) return;
        input.addEventListener('input', () => updateBudget({ normalize: false }));
        input.addEventListener('change', () => updateBudget({ normalize: true }));
        input.addEventListener('blur', () => updateBudget({ normalize: true }));
        input.addEventListener('focus', () => {
          window.setTimeout(() => {
            try { input.select(); } catch (_) {}
          }, 0);
        });
      });
'''

if js_old not in text:
    raise SystemExit('Budget JS anchor not found')
text = text.replace(js_old, js_new, 1)

# Ensure PDF normalizes any partially edited values before printing.
text = text.replace('''      function printBudgetProposal() {
        updateBudget();
        const participants = clampNumber(participantsInput);
        const courses = clampNumber(coursesInput);
''', '''      function printBudgetProposal() {
        updateBudget({ normalize: true });
        const participants = clampNumber(participantsInput);
        const courses = clampNumber(coursesInput);
''', 1)

# Initial render should normalize defaults and establish button states.
text = text.replace('''      updateBudget();
    })();
''', '''      updateBudget({ normalize: true });
    })();
''', 1)

path.write_text(text, encoding='utf-8')
print('Budget inputs fixed successfully')
