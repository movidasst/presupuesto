from pathlib import Path

path = Path('index.html')
text = path.read_text(encoding='utf-8')

# 1) Visual styles for the course experience section.
css_anchor = '''    /* AI learning support */
'''
course_css = '''    /* Course learning experience */
    .course-experience-section {
      background:
        radial-gradient(circle at 8% 12%, rgba(15,118,110,.08), transparent 24%),
        radial-gradient(circle at 92% 88%, rgba(232,171,63,.08), transparent 22%),
        #f7f9fc;
    }
    .course-experience-grid { display: grid; gap: 12px; }
    .course-experience-card {
      position: relative; overflow: hidden; min-height: 150px; padding: 18px;
      border: 1px solid var(--line); border-radius: 18px; background: rgba(255,255,255,.96);
      box-shadow: var(--shadow-sm);
    }
    .course-experience-card::after {
      content: ''; position: absolute; width: 70px; height: 70px; right: -28px; bottom: -32px;
      border-radius: 50%; background: var(--soft-brand); pointer-events: none;
    }
    .course-experience-card__icon {
      width: 42px; height: 42px; display: grid; place-items: center; border-radius: 13px;
      background: var(--soft-brand); color: var(--brand); font-size: 1rem;
    }
    .course-experience-card:nth-child(2n) .course-experience-card__icon { background: var(--soft-yellow); color: #9a6a12; }
    .course-experience-card:nth-child(3n) .course-experience-card__icon { background: var(--soft-green); color: #4d7d31; }
    .course-experience-card h3 { margin: 12px 0 6px; color: var(--navy); font-size: .96rem; line-height: 1.15; }
    .course-experience-card p { position: relative; z-index: 1; margin: 0; color: var(--muted); font-size: .79rem; line-height: 1.5; }
    .course-experience-flow {
      margin-top: 16px; padding: 17px; border-radius: 18px;
      background: linear-gradient(135deg, #0f2747 0%, #123a5f 60%, #0f766e 100%);
      color: #fff; box-shadow: var(--shadow-sm);
    }
    .course-experience-flow__title { display: flex; align-items: center; gap: 8px; color: #f3c968; font-size: .73rem; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; }
    .course-experience-flow p { margin: 8px 0 0; color: #d2deea; font-size: .8rem; line-height: 1.55; }
    .course-experience-flow__steps { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 13px; }
    .course-experience-flow__steps span { display: inline-flex; align-items: center; gap: 6px; padding: 7px 9px; border-radius: 999px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); color: #e7eef5; font-size: .65rem; font-weight: 800; }

'''
if '/* Course learning experience */' not in text:
    if css_anchor not in text:
        raise SystemExit('CSS anchor not found')
    text = text.replace(css_anchor, course_css + css_anchor, 1)

# 2) Responsive layout enhancements without changing mobile SPA boundaries.
tablet_anchor = '''      .feature-grid { grid-template-columns: repeat(2,1fr); }
'''
if '      .course-experience-grid { grid-template-columns: repeat(2,1fr); }' not in text:
    text = text.replace(tablet_anchor, tablet_anchor + '      .course-experience-grid { grid-template-columns: repeat(2,1fr); }\n', 1)

desktop_anchor = '''      .feature-grid { grid-template-columns: repeat(3,1fr); gap: 18px; }
'''
if '      .course-experience-grid { grid-template-columns: repeat(4,1fr); gap: 14px; }' not in text:
    text = text.replace(desktop_anchor, desktop_anchor + '      .course-experience-grid { grid-template-columns: repeat(4,1fr); gap: 14px; }\n      .course-experience-card:last-child { grid-column: span 2; }\n', 1)

# 3) Insert the new section between Demo and implementation steps.
html_anchor = '''    <section class="section section--soft" id="como-funciona" aria-labelledby="steps-title">
'''
experience_html = '''    <section class="section course-experience-section" id="experiencia" aria-labelledby="experience-title">
      <div class="container">
        <div class="section-head">
          <span class="eyebrow"><i class="fa-solid fa-bolt" aria-hidden="true"></i> Aprendizaje activo</span>
          <h2 id="experience-title">Cursos pensados para hacer, analizar y decidir</h2>
          <p>No se trata solo de consumir contenido. Cada curso combina recursos de estudio, actividades prácticas y dinámicas que mantienen al participante activo durante todo el recorrido.</p>
        </div>

        <div class="course-experience-grid">
          <article class="course-experience-card">
            <div class="course-experience-card__icon"><i class="fa-solid fa-briefcase" aria-hidden="true"></i></div>
            <h3>Estudio de casos</h3>
            <p>Situaciones y escenarios de SST para analizar problemas, tomar decisiones y trasladar los conceptos a contextos de trabajo.</p>
          </article>
          <article class="course-experience-card">
            <div class="course-experience-card__icon"><i class="fa-solid fa-file-pdf" aria-hidden="true"></i></div>
            <h3>Guías y recursos en PDF</h3>
            <p>Materiales descargables para estudiar, repasar contenidos clave y conservar recursos de consulta después del curso.</p>
          </article>
          <article class="course-experience-card">
            <div class="course-experience-card__icon"><i class="fa-solid fa-circle-question" aria-hidden="true"></i></div>
            <h3>Quizzes interactivos</h3>
            <p>Preguntas breves y actividades de comprobación que ayudan a reforzar la comprensión durante el proceso de aprendizaje.</p>
          </article>
          <article class="course-experience-card">
            <div class="course-experience-card__icon"><i class="fa-solid fa-flag-checkered" aria-hidden="true"></i></div>
            <h3>Retos y actividades</h3>
            <p>Pequeños desafíos orientados a aplicar lo aprendido, resolver situaciones y mantener una participación activa.</p>
          </article>
          <article class="course-experience-card">
            <div class="course-experience-card__icon"><i class="fa-solid fa-clipboard-check" aria-hidden="true"></i></div>
            <h3>Evaluación final</h3>
            <p>Una evaluación automatizada permite verificar el aprendizaje alcanzado y determinar el cumplimiento del criterio de aprobación.</p>
          </article>
          <article class="course-experience-card">
            <div class="course-experience-card__icon"><i class="fa-solid fa-star" aria-hidden="true"></i></div>
            <h3>Encuesta de satisfacción</h3>
            <p>Al cierre recogemos la percepción del participante sobre la experiencia para apoyar la mejora continua de la formación.</p>
          </article>
          <article class="course-experience-card">
            <div class="course-experience-card__icon"><i class="fa-solid fa-trophy" aria-hidden="true"></i></div>
            <h3>Experiencia gamificada</h3>
            <p>Puntos, participación y ranking incorporan una capa de motivación y permiten hacer más visible el avance dentro de la comunidad de aprendizaje.</p>
          </article>
        </div>

        <div class="course-experience-flow">
          <div class="course-experience-flow__title"><i class="fa-solid fa-route" aria-hidden="true"></i> Un recorrido, no una colección de archivos</div>
          <p>La experiencia combina contenido, práctica, interacción y comprobación del aprendizaje para que el participante avance con propósito y la empresa pueda observar participación y resultados.</p>
          <div class="course-experience-flow__steps" aria-label="Recorrido típico del curso">
            <span><i class="fa-solid fa-book-open" aria-hidden="true"></i> Estudia</span>
            <span><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i> Analiza casos</span>
            <span><i class="fa-solid fa-puzzle-piece" aria-hidden="true"></i> Resuelve retos</span>
            <span><i class="fa-solid fa-ranking-star" aria-hidden="true"></i> Suma puntos</span>
            <span><i class="fa-solid fa-check-double" aria-hidden="true"></i> Evalúa</span>
            <span><i class="fa-solid fa-comment-dots" aria-hidden="true"></i> Da feedback</span>
          </div>
        </div>
      </div>
    </section>

'''
if 'id="experiencia"' not in text:
    if html_anchor not in text:
        raise SystemExit('HTML anchor not found')
    text = text.replace(html_anchor, experience_html + html_anchor, 1)

# 4) Add the section to the Demo mobile screen.
managed_anchor = '''        document.getElementById('demo'),
        document.getElementById('como-funciona'),
'''
if "document.getElementById('experiencia')" not in text:
    text = text.replace(managed_anchor, "        document.getElementById('demo'),\n        document.getElementById('experiencia'),\n        document.getElementById('como-funciona'),\n", 1)

visible_anchor = '''        if (view === 'demo') return [document.getElementById('demo'), document.getElementById('como-funciona')].filter(Boolean);
'''
visible_new = '''        if (view === 'demo') return [document.getElementById('demo'), document.getElementById('experiencia'), document.getElementById('como-funciona')].filter(Boolean);
'''
text = text.replace(visible_anchor, visible_new, 1)

route_anchor = '''          '#top': ['home', null], '#contenido': ['home', null], '#demo': ['demo', null], '#como-funciona': ['demo', null],
'''
if "'#experiencia': ['demo', null]" not in text:
    text = text.replace(route_anchor, "          '#top': ['home', null], '#contenido': ['home', null], '#demo': ['demo', null], '#experiencia': ['demo', null], '#como-funciona': ['demo', null],\n", 1)

# 5) Include these characteristics in every budget tier.
benefit_anchor = '''          'Ayuda con IA para resumir y explicar contenidos'
'''
benefit_new = '''          'Ayuda con IA para resumir y explicar contenidos',
          'Metodología práctica con estudios de caso, quizzes y retos',
          'Guías PDF y recursos de apoyo',
          'Encuesta de satisfacción al cierre',
          'Gamificación con puntos y ranking'
'''
if "'Gamificación con puntos y ranking'" not in text:
    text = text.replace(benefit_anchor, benefit_new, 1)

# 6) Enrich existing PDF methodology description, without adding another print box.
print_old = '''<div class="print-include"><b>4 horas académicas por curso</b><span>Contenido asincrónico en formato microlearning con 45 días de matrícula por curso.</span></div>'''
print_new = '''<div class="print-include"><b>4 horas académicas por curso</b><span>Casos prácticos, guías PDF, quizzes, retos y gamificación; evaluación final y encuesta de satisfacción. 45 días de matrícula.</span></div>'''
text = text.replace(print_old, print_new, 1)

path.write_text(text, encoding='utf-8')
print('Course experience section added successfully')
