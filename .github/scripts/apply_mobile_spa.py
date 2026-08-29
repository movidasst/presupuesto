from pathlib import Path
import re

path = Path('index.html')
text = path.read_text(encoding='utf-8')

# 1) IDs for mobile subviews that previously had only aria labels.
text = text.replace('<section class="section section--white" aria-labelledby="report-title">', '<section class="section section--white" id="reportes" aria-labelledby="report-title">', 1)
text = text.replace('<section class="section section--white" aria-labelledby="faq-title">', '<section class="section section--white" id="faq" aria-labelledby="faq-title">', 1)
text = text.replace('<section class="section contact-section" aria-labelledby="contact-title">', '<section class="section contact-section" id="contacto" aria-labelledby="contact-title">', 1)

# 2) Compact mobile screen indicator in the header. Hidden outside phones.
header_anchor = '''      </a>\n\n      <nav class="desktop-nav" aria-label="Navegación principal">'''
header_replacement = '''      </a>\n\n      <div class="mobile-screen-label no-print" id="mobileScreenLabel" aria-live="polite">\n        <i class="fa-solid fa-house" aria-hidden="true"></i><span>Inicio</span>\n      </div>\n\n      <nav class="desktop-nav" aria-label="Navegación principal">'''
if 'id="mobileScreenLabel"' not in text:
    if header_anchor not in text:
        raise SystemExit('Header anchor not found')
    text = text.replace(header_anchor, header_replacement, 1)

# 3) Add the mobile More hub before the DNF section. It is invisible on tablet/desktop/print.
more_hub = '''\n    <section class="mobile-more-hub no-print" id="mobileMoreHub" aria-labelledby="mobile-more-title">\n      <div class="container">\n        <div class="mobile-screen-heading">\n          <span class="eyebrow"><i class="fa-solid fa-grid-2" aria-hidden="true"></i> Más opciones</span>\n          <h2 id="mobile-more-title">Información y soporte</h2>\n          <p>Consulta los detalles de la propuesta sin salir de la experiencia móvil.</p>\n        </div>\n        <div class="mobile-more-grid">\n          <button class="mobile-more-card" type="button" data-mobile-more-target="dnf">\n            <span class="mobile-more-card__icon"><i class="fa-solid fa-magnifying-glass-chart" aria-hidden="true"></i></span>\n            <span><strong>DNF</strong><small>Necesidades de formación</small></span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i>\n          </button>\n          <button class="mobile-more-card" type="button" data-mobile-more-target="reportes">\n            <span class="mobile-more-card__icon"><i class="fa-solid fa-chart-column" aria-hidden="true"></i></span>\n            <span><strong>Reportes</strong><small>Asistencia, avance y resultados</small></span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i>\n          </button>\n          <button class="mobile-more-card" type="button" data-mobile-more-target="condiciones">\n            <span class="mobile-more-card__icon"><i class="fa-solid fa-file-signature" aria-hidden="true"></i></span>\n            <span><strong>Condiciones</strong><small>Pago y operación</small></span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i>\n          </button>\n          <button class="mobile-more-card" type="button" data-mobile-more-target="faq">\n            <span class="mobile-more-card__icon"><i class="fa-solid fa-circle-question" aria-hidden="true"></i></span>\n            <span><strong>Preguntas</strong><small>Respuestas frecuentes</small></span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i>\n          </button>\n          <button class="mobile-more-card" type="button" data-mobile-more-target="contacto">\n            <span class="mobile-more-card__icon"><i class="fa-solid fa-headset" aria-hidden="true"></i></span>\n            <span><strong>Contacto</strong><small>Atención corporativa</small></span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i>\n          </button>\n        </div>\n        <div class="mobile-more-actions">\n          <button class="btn btn--outline btn--block" id="mobileHubPrintBtn" type="button"><i class="fa-solid fa-file-pdf" aria-hidden="true"></i> Generar propuesta PDF</button>\n          <a class="btn btn--whatsapp btn--block" href="https://wa.me/56968615650?text=Hola%20David,%20quiero%20informaci%C3%B3n%20sobre%20la%20capacitaci%C3%B3n%20corporativa%20en%20SST." target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Hablar por WhatsApp</a>\n        </div>\n      </div>\n    </section>\n'''
if 'id="mobileMoreHub"' not in text:
    dnf_anchor = '    <section class="section" id="dnf" aria-labelledby="dnf-title">'
    if dnf_anchor not in text:
        raise SystemExit('DNF anchor not found')
    text = text.replace(dnf_anchor, more_hub + '\n' + dnf_anchor, 1)

# 4) Replace phone bottom nav: real app tabs, no anchor-scrolling.
nav_pattern = re.compile(r'  <nav class="mobile-app-nav no-print" aria-label="Navegación rápida móvil">.*?  </nav>\n\n  <script>', re.S)
new_nav = '''  <nav class="mobile-app-nav no-print" aria-label="Navegación principal móvil">\n    <button class="mobile-app-nav__item is-active" type="button" data-mobile-view-target="home" aria-label="Abrir Inicio">\n      <i class="fa-solid fa-house" aria-hidden="true"></i><span>Inicio</span>\n    </button>\n    <button class="mobile-app-nav__item" type="button" data-mobile-view-target="demo" aria-label="Abrir Demo">\n      <i class="fa-solid fa-flask" aria-hidden="true"></i><span>Demo</span>\n    </button>\n    <button class="mobile-app-nav__item" type="button" data-mobile-view-target="plans" aria-label="Abrir Planes">\n      <i class="fa-solid fa-tags" aria-hidden="true"></i><span>Planes</span>\n    </button>\n    <button class="mobile-app-nav__item mobile-app-nav__item--primary" type="button" data-mobile-view-target="quote" aria-label="Abrir Cotizador">\n      <span class="mobile-app-nav__icon"><i class="fa-solid fa-calculator" aria-hidden="true"></i></span><span>Cotizar</span>\n    </button>\n    <button class="mobile-app-nav__item" id="mobileMoreBtn" type="button" data-mobile-view-target="more" aria-label="Abrir Más opciones">\n      <i class="fa-solid fa-grip" aria-hidden="true"></i><span>Más</span>\n    </button>\n  </nav>\n\n  <script>'''
text, nav_count = nav_pattern.subn(new_nav, text, count=1)
if nav_count != 1:
    raise SystemExit(f'Mobile nav replacement count: {nav_count}')

# 5) Phone-only SPA CSS. This comes after the existing bottom-nav CSS and before print,
#    so it overrides phone behavior without changing tablet/desktop or print.
css_anchor = '    /* Print / PDF commercial proposal */'
spa_css = '''    /* Phone SPA: distinct screens instead of one long landing page */\n    .mobile-screen-label, .mobile-more-hub, .mobile-subview-back { display: none; }\n\n    @media (max-width: 639px) {\n      html { scroll-padding-top: 72px; }\n      body.mobile-spa-active { background: #f5f7fb; }\n      body.mobile-spa-active .notice { display: none !important; }\n      body.mobile-spa-active .site-header { top: 0; }\n      body.mobile-spa-active .nav { min-height: 64px; }\n      body.mobile-spa-active .nav-actions { display: none !important; }\n      body.mobile-spa-active .brand { max-width: 68%; }\n      body.mobile-spa-active .brand__tagline { display: none; }\n      body.mobile-spa-active .mobile-screen-label {\n        margin-left: auto; display: inline-flex; align-items: center; gap: 7px; max-width: 31%;\n        padding: 7px 10px; border-radius: 999px; background: var(--soft-brand); color: var(--brand-700);\n        font-size: .66rem; font-weight: 850; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\n      }\n      .mobile-screen-label span { overflow: hidden; text-overflow: ellipsis; }\n\n      body.mobile-spa-active #contenido { min-height: calc(100dvh - 136px); overflow-x: clip; }\n      body.mobile-spa-active footer { display: none !important; }\n      body.mobile-spa-active .mobile-menu { display: none !important; }\n      body.mobile-spa-active .mobile-view-item.mobile-view-hidden { display: none !important; }\n      body.mobile-spa-active .mobile-view-item.mobile-view-visible { display: block; }\n      body.mobile-spa-active .mobile-view-item.mobile-view-enter-right { animation: mobileViewRight .22s cubic-bezier(.2,.8,.2,1); }\n      body.mobile-spa-active .mobile-view-item.mobile-view-enter-left { animation: mobileViewLeft .22s cubic-bezier(.2,.8,.2,1); }\n\n      body.mobile-spa-active .section { padding: 42px 0 92px; }\n      body.mobile-spa-active .hero { padding: 42px 0 92px; min-height: calc(100dvh - 132px); }\n      body.mobile-spa-active .trust { padding-bottom: 82px; }\n      body.mobile-spa-active .section-head { margin-bottom: 24px; }\n      body.mobile-spa-active .section-head h2 { font-size: clamp(1.65rem, 8vw, 2.25rem); }\n\n      .mobile-more-hub { padding: 34px 0 94px; min-height: calc(100dvh - 132px); background: linear-gradient(180deg,#f8fafc,#f2f6f8); }\n      body.mobile-spa-active .mobile-more-hub.mobile-view-visible { display: block; }\n      .mobile-screen-heading { margin-bottom: 22px; }\n      .mobile-screen-heading h2 { margin: 12px 0 7px; color: var(--navy); font-size: 1.65rem; line-height: 1.05; }\n      .mobile-screen-heading p { margin: 0; color: var(--muted); font-size: .83rem; }\n      .mobile-more-grid { display: grid; gap: 10px; }\n      .mobile-more-card {\n        width: 100%; min-height: 74px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 17px;\n        background: #fff; color: var(--ink); display: grid; grid-template-columns: 44px minmax(0,1fr) auto;\n        align-items: center; gap: 12px; text-align: left; box-shadow: 0 8px 24px rgba(10,29,52,.05); cursor: pointer;\n      }\n      .mobile-more-card__icon { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 13px; background: var(--soft-brand); color: var(--brand); font-size: 1.05rem; }\n      .mobile-more-card strong { display: block; color: var(--navy); font-size: .86rem; }\n      .mobile-more-card small { display: block; margin-top: 2px; color: var(--muted); font-size: .68rem; }\n      .mobile-more-card > i { color: #9aa8b7; font-size: .72rem; }\n      .mobile-more-actions { display: grid; gap: 9px; margin-top: 18px; }\n\n      .mobile-subview-back {\n        position: sticky; top: 64px; z-index: 30; margin: -18px 0 20px; padding: 8px 0;\n        background: linear-gradient(180deg, rgba(245,247,251,.98) 70%, rgba(245,247,251,0));\n      }\n      body.mobile-spa-active .mobile-subview-back { display: block; }\n      .mobile-subview-back button {\n        min-height: 40px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 12px; background: #fff;\n        color: var(--navy); display: inline-flex; align-items: center; gap: 8px; font-weight: 800; font-size: .74rem;\n      }\n\n      .mobile-app-nav__item { touch-action: manipulation; }\n      .mobile-app-nav__item.is-active { color: var(--brand); background: var(--soft-brand); }\n      .mobile-app-nav__item--primary.is-active .mobile-app-nav__icon { transform: translateY(-2px) scale(1.04); }\n    }\n\n    @keyframes mobileViewRight {\n      from { opacity: 0; transform: translateX(16px); }\n      to { opacity: 1; transform: translateX(0); }\n    }\n    @keyframes mobileViewLeft {\n      from { opacity: 0; transform: translateX(-16px); }\n      to { opacity: 1; transform: translateX(0); }\n    }\n\n'''
if 'Phone SPA: distinct screens' not in text:
    if css_anchor not in text:
        raise SystemExit('Print CSS anchor not found')
    text = text.replace(css_anchor, spa_css + css_anchor, 1)

# 6) Remove the old phone scroll-spy / smooth-anchor controller and install real view routing.
old_block_pattern = re.compile(
    r"      const mobileSectionLinks = \[\.\.\.document\.querySelectorAll\('\.mobile-app-nav__item\[data-mobile-section\]'\)\];.*?      syncMobileNav\(\);\n",
    re.S,
)
spa_js = r'''      const phoneMq = window.matchMedia('(max-width: 639px)');
      const mobileScreenLabel = document.getElementById('mobileScreenLabel');
      const mobileTabButtons = [...document.querySelectorAll('[data-mobile-view-target]')];
      const mobileMoreHub = document.getElementById('mobileMoreHub');
      const mobileMoreCards = [...document.querySelectorAll('[data-mobile-more-target]')];
      const mobileManagedSections = [
        document.querySelector('.hero'),
        document.querySelector('.trust'),
        document.getElementById('demo'),
        document.getElementById('como-funciona'),
        document.getElementById('planes'),
        document.getElementById('presupuesto'),
        mobileMoreHub,
        document.getElementById('dnf'),
        document.getElementById('reportes'),
        document.getElementById('condiciones'),
        document.getElementById('faq'),
        document.getElementById('contacto')
      ].filter(Boolean);

      const mobileViewOrder = { home: 0, demo: 1, plans: 2, quote: 3, more: 4 };
      const mobileViewMeta = {
        home:  { label: 'Inicio', icon: 'fa-house' },
        demo:  { label: 'Demo', icon: 'fa-flask' },
        plans: { label: 'Planes', icon: 'fa-tags' },
        quote: { label: 'Cotizar', icon: 'fa-calculator' },
        more:  { label: 'Más', icon: 'fa-grip' }
      };
      const mobileMoreLabels = {
        dnf: 'DNF', reportes: 'Reportes', condiciones: 'Condiciones', faq: 'Preguntas', contacto: 'Contacto'
      };
      const mobileScrollMemory = new Map();
      let currentMobileView = 'home';
      let currentMobileDetail = null;
      let mobileAppReady = false;

      function mobileRoute(view, detail = null) {
        const base = { home: 'inicio', demo: 'demo', plans: 'planes', quote: 'cotizar', more: 'mas' }[view] || 'inicio';
        return detail ? `#/${base}/${detail}` : `#/${base}`;
      }

      function parseMobileRoute() {
        const hash = location.hash || '';
        if (!hash.startsWith('#/')) return { view: 'home', detail: null };
        const parts = hash.slice(2).split('/').filter(Boolean);
        const view = { inicio: 'home', demo: 'demo', planes: 'plans', cotizar: 'quote', mas: 'more' }[parts[0]] || 'home';
        const detail = view === 'more' && mobileMoreLabels[parts[1]] ? parts[1] : null;
        return { view, detail };
      }

      function mobileKey(view, detail) { return `${view}:${detail || 'root'}`; }

      function ensureMobileSubviewBack(section, detail) {
        if (!section || section.querySelector(':scope > .container > .mobile-subview-back')) return;
        const container = section.querySelector(':scope > .container');
        if (!container) return;
        const wrap = document.createElement('div');
        wrap.className = 'mobile-subview-back no-print';
        wrap.innerHTML = `<button type="button" data-mobile-back-more><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Volver a Más</button>`;
        container.prepend(wrap);
      }

      function setupMobileSections() {
        mobileManagedSections.forEach((section) => section.classList.add('mobile-view-item'));
        ['dnf','reportes','condiciones','faq','contacto'].forEach((detail) => ensureMobileSubviewBack(document.getElementById(detail), detail));
      }

      function visibleSectionsFor(view, detail) {
        if (view === 'home') return [document.querySelector('.hero'), document.querySelector('.trust')].filter(Boolean);
        if (view === 'demo') return [document.getElementById('demo'), document.getElementById('como-funciona')].filter(Boolean);
        if (view === 'plans') return [document.getElementById('planes')].filter(Boolean);
        if (view === 'quote') return [document.getElementById('presupuesto')].filter(Boolean);
        if (view === 'more') return [detail ? document.getElementById(detail) : mobileMoreHub].filter(Boolean);
        return [document.querySelector('.hero')].filter(Boolean);
      }

      function updateMobileHeader(view, detail) {
        if (!mobileScreenLabel) return;
        const meta = mobileViewMeta[view] || mobileViewMeta.home;
        const label = detail ? (mobileMoreLabels[detail] || meta.label) : meta.label;
        mobileScreenLabel.innerHTML = `<i class="fa-solid ${meta.icon}" aria-hidden="true"></i><span>${label}</span>`;
      }

      function setMobileTabActive(view) {
        mobileTabButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.mobileViewTarget === view));
      }

      function applyMobileView(view, detail = null, options = {}) {
        if (!phoneMq.matches) return;
        const { historyMode = 'push', restoreScroll = true } = options;
        const oldView = currentMobileView;
        const oldDetail = currentMobileDetail;
        mobileScrollMemory.set(mobileKey(oldView, oldDetail), window.scrollY);

        const direction = (mobileViewOrder[view] ?? 0) >= (mobileViewOrder[oldView] ?? 0) ? 'right' : 'left';
        const visible = new Set(visibleSectionsFor(view, detail));
        mobileManagedSections.forEach((section) => {
          section.classList.remove('mobile-view-visible', 'mobile-view-enter-right', 'mobile-view-enter-left');
          section.classList.toggle('mobile-view-hidden', !visible.has(section));
        });
        visible.forEach((section) => {
          section.classList.remove('mobile-view-hidden');
          section.classList.add('mobile-view-visible', direction === 'right' ? 'mobile-view-enter-right' : 'mobile-view-enter-left');
        });

        currentMobileView = view;
        currentMobileDetail = detail;
        setMobileTabActive(view);
        updateMobileHeader(view, detail);
        setMenu(false);

        const route = mobileRoute(view, detail);
        if (historyMode === 'replace') history.replaceState({ mobileView: view, mobileDetail: detail }, '', route);
        if (historyMode === 'push' && location.hash !== route) history.pushState({ mobileView: view, mobileDetail: detail }, '', route);

        const saved = restoreScroll ? (mobileScrollMemory.get(mobileKey(view, detail)) || 0) : 0;
        requestAnimationFrame(() => {
          window.scrollTo({ top: saved, left: 0, behavior: 'auto' });
          window.setTimeout(() => visible.forEach((section) => section.classList.remove('mobile-view-enter-right', 'mobile-view-enter-left')), 260);
        });
      }

      function navigateMobile(view, detail = null, options = {}) {
        if (!phoneMq.matches) return false;
        applyMobileView(view, detail, { historyMode: options.replace ? 'replace' : 'push', restoreScroll: options.restoreScroll !== false });
        return true;
      }

      function routeAnchorOnPhone(hash) {
        const routeMap = {
          '#top': ['home', null], '#contenido': ['home', null], '#demo': ['demo', null], '#como-funciona': ['demo', null],
          '#planes': ['plans', null], '#presupuesto': ['quote', null], '#dnf': ['more', 'dnf'], '#reportes': ['more', 'reportes'],
          '#condiciones': ['more', 'condiciones'], '#faq': ['more', 'faq'], '#contacto': ['more', 'contacto']
        };
        return routeMap[hash] || null;
      }

      document.addEventListener('click', (event) => {
        if (!phoneMq.matches) return;
        const tab = event.target.closest('[data-mobile-view-target]');
        if (tab) {
          event.preventDefault();
          navigateMobile(tab.dataset.mobileViewTarget, null, { restoreScroll: true });
          return;
        }
        const moreCard = event.target.closest('[data-mobile-more-target]');
        if (moreCard) {
          event.preventDefault();
          navigateMobile('more', moreCard.dataset.mobileMoreTarget, { restoreScroll: true });
          return;
        }
        const back = event.target.closest('[data-mobile-back-more]');
        if (back) {
          event.preventDefault();
          navigateMobile('more', null, { restoreScroll: true });
          return;
        }
        const anchor = event.target.closest('a[href^="#"]');
        if (!anchor) return;
        const hash = anchor.getAttribute('href');
        const route = routeAnchorOnPhone(hash);
        if (!route) return;
        event.preventDefault();
        const [view, detail] = route;
        const sameView = view === currentMobileView && detail === currentMobileDetail;
        if (!sameView) navigateMobile(view, detail, { restoreScroll: false });
        requestAnimationFrame(() => {
          const target = document.querySelector(hash);
          if (target && sameView) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });

      function enableMobileApp() {
        if (!phoneMq.matches) return;
        setupMobileSections();
        document.body.classList.add('mobile-spa-active');
        const route = parseMobileRoute();
        currentMobileView = route.view;
        currentMobileDetail = route.detail;
        mobileAppReady = true;
        applyMobileView(route.view, route.detail, { historyMode: location.hash.startsWith('#/') ? 'none' : 'replace', restoreScroll: false });
      }

      function disableMobileApp() {
        document.body.classList.remove('mobile-spa-active');
        mobileManagedSections.forEach((section) => section.classList.remove('mobile-view-hidden', 'mobile-view-visible', 'mobile-view-enter-right', 'mobile-view-enter-left'));
        if (location.hash.startsWith('#/')) history.replaceState(null, '', location.pathname + location.search);
        mobileAppReady = false;
      }

      window.addEventListener('popstate', () => {
        if (!phoneMq.matches) return;
        const route = parseMobileRoute();
        applyMobileView(route.view, route.detail, { historyMode: 'none', restoreScroll: true });
      });

      phoneMq.addEventListener?.('change', (event) => event.matches ? enableMobileApp() : disableMobileApp());
      if (phoneMq.matches) enableMobileApp();
'''
text, js_count = old_block_pattern.subn(spa_js, text, count=1)
if js_count != 1:
    raise SystemExit(f'Old mobile JS block replacement count: {js_count}')

# 7) Stop More from opening the old dropdown and stop setMenu from hijacking its active state.
text = text.replace("      const mobileMoreBtn = document.getElementById('mobileMoreBtn');\n", "      const mobileMoreBtn = document.getElementById('mobileMoreBtn');\n")
text = text.replace("        mobileMoreBtn?.setAttribute('aria-expanded', String(open));\n        mobileMoreBtn?.classList.toggle('is-active', open);\n", "")
text = text.replace("      mobileMoreBtn?.addEventListener('click', () => setMenu(!mobileMenu.classList.contains('is-open')));\n", "")

# 8) Wire the PDF action from the More hub to the existing print engine.
print_const_anchor = "      const mobilePrintBtn = document.getElementById('mobilePrintBtn');\n"
if "const mobileHubPrintBtn" not in text:
    text = text.replace(print_const_anchor, print_const_anchor + "      const mobileHubPrintBtn = document.getElementById('mobileHubPrintBtn');\n", 1)
print_listener_anchor = "      mobilePrintBtn?.addEventListener('click', () => { setMenu(false); printBudgetProposal(); });\n"
if "mobileHubPrintBtn?.addEventListener" not in text:
    text = text.replace(print_listener_anchor, print_listener_anchor + "      mobileHubPrintBtn?.addEventListener('click', printBudgetProposal);\n", 1)

path.write_text(text, encoding='utf-8')
print('Applied phone SPA navigation without changing tablet, desktop or print proposal.')
