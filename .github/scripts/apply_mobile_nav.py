from pathlib import Path
import re

path = Path('index.html')
text = path.read_text(encoding='utf-8')

# Replace the old two-button mobile CTA CSS with an app-style bottom navigation.
css_pattern = re.compile(r'''    /\* Bottom mobile CTA \*/\n    \.mobile-cta \{.*?    \.mobile-cta \.btn \{.*?\}\n''', re.S)
new_css = '''    /* Mobile app-style bottom navigation */
    .mobile-app-nav { display: none; }

    @media (max-width: 639px) {
      .menu-toggle { display: none !important; }

      .mobile-app-nav {
        position: fixed; left: 0; right: 0; bottom: 0; z-index: 140;
        display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));
        min-height: 68px;
        padding: 6px max(8px, env(safe-area-inset-right)) calc(6px + env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left));
        background: rgba(255,255,255,.96); backdrop-filter: blur(18px);
        border-top: 1px solid rgba(217,226,234,.92);
        box-shadow: 0 -12px 34px rgba(8,24,47,.10);
      }
      .mobile-app-nav__item {
        position: relative; min-width: 0; min-height: 54px; padding: 4px 2px;
        border: 0; background: transparent; color: #6b7a8d;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
        font: inherit; cursor: pointer; border-radius: 13px;
        transition: color .2s ease, background .2s ease, transform .2s ease;
      }
      .mobile-app-nav__item i { font-size: 1.02rem; line-height: 1; }
      .mobile-app-nav__item span { font-size: .58rem; font-weight: 800; line-height: 1; white-space: nowrap; }
      .mobile-app-nav__item.is-active { color: var(--brand); background: var(--soft-brand); }
      .mobile-app-nav__item.is-active::before {
        content: ''; position: absolute; top: 2px; left: 50%; width: 22px; height: 3px;
        transform: translateX(-50%); border-radius: 999px; background: var(--brand);
      }
      .mobile-app-nav__item--primary { color: var(--brand-700); }
      .mobile-app-nav__icon {
        width: 34px; height: 34px; margin-top: -15px; border-radius: 12px;
        display: grid; place-items: center;
        background: linear-gradient(180deg,#13847b 0%,#0f766e 100%); color: #fff;
        box-shadow: 0 8px 20px rgba(15,118,110,.25); border: 3px solid #fff;
      }
      .mobile-app-nav__item--primary.is-active { background: transparent; }
      .mobile-app-nav__item--primary.is-active::before { display: none; }

      /* Secondary options become a bottom sheet on phones. */
      .mobile-menu {
        inset: 0; z-index: 130; display: flex; align-items: flex-end;
        padding-bottom: calc(68px + env(safe-area-inset-bottom));
        background: rgba(4,17,34,.48);
      }
      .mobile-menu__panel {
        width: 100%; max-height: min(68vh, 520px); overflow-y: auto;
        border: 0; border-radius: 24px 24px 0 0; padding: 18px 16px 16px;
        display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px;
        transform: translateY(105%); transition: transform .28s cubic-bezier(.2,.8,.2,1);
        box-shadow: 0 -18px 45px rgba(8,24,47,.22);
      }
      .mobile-menu.is-open .mobile-menu__panel { transform: translateY(0); }
      .mobile-menu a,
      .mobile-menu__action {
        min-height: 58px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 14px;
        background: #f8fafc; color: #243854; font-size: .76rem; line-height: 1.2;
      }
      .mobile-menu a { margin: 0; }
      .mobile-menu .mobile-menu__cta {
        grid-column: 1 / -1; min-height: 52px; margin-top: 2px; border: 0;
        background: #138a4b; color: #fff; justify-content: center;
      }
      .mobile-menu__action { width: 100%; }
      footer { padding-bottom: 92px; }
    }
'''
text, css_count = css_pattern.subn(new_css, text, count=1)
if css_count != 1:
    raise SystemExit(f'Expected to replace 1 mobile CTA CSS block, replaced {css_count}')

# Replace the old two-button fixed footer with a five-item mobile app navigation.
nav_pattern = re.compile(r'''\n  <div class="mobile-cta no-print" aria-label="Acciones rápidas">.*?\n  </div>\n\n  <script>''', re.S)
new_nav = '''
  <nav class="mobile-app-nav no-print" aria-label="Navegación rápida móvil">
    <a class="mobile-app-nav__item is-active" data-mobile-section href="#top" aria-label="Ir al inicio">
      <i class="fa-solid fa-house" aria-hidden="true"></i><span>Inicio</span>
    </a>
    <a class="mobile-app-nav__item" data-mobile-section href="#demo" aria-label="Ir al Demo corporativo">
      <i class="fa-solid fa-flask" aria-hidden="true"></i><span>Demo</span>
    </a>
    <a class="mobile-app-nav__item" data-mobile-section href="#planes" aria-label="Ir a planes y tarifas">
      <i class="fa-solid fa-tags" aria-hidden="true"></i><span>Planes</span>
    </a>
    <a class="mobile-app-nav__item mobile-app-nav__item--primary" data-mobile-section href="#presupuesto" aria-label="Armar presupuesto">
      <span class="mobile-app-nav__icon"><i class="fa-solid fa-calculator" aria-hidden="true"></i></span><span>Cotizar</span>
    </a>
    <button class="mobile-app-nav__item" id="mobileMoreBtn" type="button" aria-label="Ver más opciones" aria-expanded="false" aria-controls="mobileMenu">
      <i class="fa-solid fa-grip" aria-hidden="true"></i><span>Más</span>
    </button>
  </nav>

  <script>'''
text, nav_count = nav_pattern.subn(new_nav, text, count=1)
if nav_count != 1:
    raise SystemExit(f'Expected to replace 1 mobile CTA HTML block, replaced {nav_count}')

old_refs = """      const menuToggle = document.getElementById('menuToggle');
      const mobileMenu = document.getElementById('mobileMenu');
      const menuIcon = menuToggle?.querySelector('i');
"""
new_refs = """      const menuToggle = document.getElementById('menuToggle');
      const mobileMenu = document.getElementById('mobileMenu');
      const mobileMoreBtn = document.getElementById('mobileMoreBtn');
      const menuIcon = menuToggle?.querySelector('i');
"""
if old_refs not in text:
    raise SystemExit('Menu reference block not found')
text = text.replace(old_refs, new_refs, 1)

old_setmenu = """        menuToggle.setAttribute('aria-expanded', String(open));
        menuToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
        document.body.classList.toggle('menu-open', open);
"""
new_setmenu = """        menuToggle.setAttribute('aria-expanded', String(open));
        menuToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
        mobileMoreBtn?.setAttribute('aria-expanded', String(open));
        mobileMoreBtn?.classList.toggle('is-active', open);
        document.body.classList.toggle('menu-open', open);
"""
if old_setmenu not in text:
    raise SystemExit('setMenu block not found')
text = text.replace(old_setmenu, new_setmenu, 1)

old_listeners = """      menuToggle?.addEventListener('click', () => setMenu(!mobileMenu.classList.contains('is-open')));
      mobileMenu?.addEventListener('click', (event) => {
        if (event.target === mobileMenu || event.target.closest('a')) setMenu(false);
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') setMenu(false);
      });
"""
new_listeners = """      menuToggle?.addEventListener('click', () => setMenu(!mobileMenu.classList.contains('is-open')));
      mobileMoreBtn?.addEventListener('click', () => setMenu(!mobileMenu.classList.contains('is-open')));
      mobileMenu?.addEventListener('click', (event) => {
        if (event.target === mobileMenu || event.target.closest('a')) setMenu(false);
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') setMenu(false);
      });

      const mobileSectionLinks = [...document.querySelectorAll('.mobile-app-nav__item[data-mobile-section]')];
      const mobileSmoothLinks = [...document.querySelectorAll('.mobile-app-nav a[href^=\"#\"], .mobile-menu a[href^=\"#\"]')];

      mobileSmoothLinks.forEach((link) => {
        link.addEventListener('click', (event) => {
          if (!window.matchMedia('(max-width: 639px)').matches) return;
          const selector = link.getAttribute('href');
          if (!selector || selector === '#') return;
          const target = document.querySelector(selector);
          if (!target) return;
          event.preventDefault();
          setMenu(false);
          requestAnimationFrame(() => {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            history.replaceState(null, '', selector);
          });
        });
      });

      let mobileNavTicking = false;
      function syncMobileNav() {
        mobileNavTicking = false;
        if (!window.matchMedia('(max-width: 639px)').matches || !mobileSectionLinks.length) return;
        const marker = window.scrollY + Math.min(window.innerHeight * .28, 190);
        let activeLink = mobileSectionLinks[0];
        for (const link of mobileSectionLinks) {
          const target = document.querySelector(link.getAttribute('href'));
          if (target && target.offsetTop <= marker) activeLink = link;
        }
        mobileSectionLinks.forEach((link) => link.classList.toggle('is-active', link === activeLink));
      }
      function requestMobileNavSync() {
        if (mobileNavTicking) return;
        mobileNavTicking = true;
        requestAnimationFrame(syncMobileNav);
      }
      window.addEventListener('scroll', requestMobileNavSync, { passive: true });
      window.addEventListener('resize', requestMobileNavSync);
      syncMobileNav();
"""
if old_listeners not in text:
    raise SystemExit('Menu listener block not found')
text = text.replace(old_listeners, new_listeners, 1)

path.write_text(text, encoding='utf-8')
print('Mobile app navigation patch applied successfully')
