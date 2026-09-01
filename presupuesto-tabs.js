(() => {
  'use strict';

  const MAIN_TABS = [
    { key: 'inicio', label: 'Inicio', icon: 'fa-house' },
    { key: 'demo', label: 'Demo', icon: 'fa-flask' },
    { key: 'planes', label: 'Planes', icon: 'fa-tags' },
    { key: 'presupuesto', label: 'Cotizador', icon: 'fa-calculator' },
    { key: 'mas', label: 'Más', icon: 'fa-grip' }
  ];

  const DEMO_SUBTABS = [
    { key: 'demo', label: 'Demo' },
    { key: 'experiencia', label: 'Experiencia' },
    { key: 'como-funciona', label: 'Cómo funciona' }
  ];

  const MORE_SUBTABS = [
    { key: 'mas', label: 'Más' },
    { key: 'dnf', label: 'DNF' },
    { key: 'reportes', label: 'Reportes' },
    { key: 'condiciones', label: 'Condiciones' },
    { key: 'faq', label: 'Preguntas' },
    { key: 'contacto', label: 'Contacto' }
  ];

  const ROUTES = {
    inicio: { main: 'inicio', selectors: ['.hero', '.trust', '#para-quien'] },
    demo: { main: 'demo', selectors: ['#demo'] },
    experiencia: { main: 'demo', selectors: ['#experiencia'] },
    'como-funciona': { main: 'demo', selectors: ['#como-funciona'] },
    planes: { main: 'planes', selectors: ['#planes'] },
    presupuesto: { main: 'presupuesto', selectors: ['#presupuesto'] },
    mas: { main: 'mas', selectors: ['#mobileMoreHub'] },
    dnf: { main: 'mas', selectors: ['#dnf'] },
    reportes: { main: 'mas', selectors: ['#reportes'] },
    condiciones: { main: 'mas', selectors: ['#condiciones'] },
    faq: { main: 'mas', selectors: ['#faq'] },
    contacto: { main: 'mas', selectors: ['#contacto'] }
  };

  const HASH_ALIASES = {
    '': 'inicio',
    top: 'inicio',
    contenido: 'inicio',
    'para-quien': 'inicio',
    leadCapture: 'presupuesto'
  };

  const MOBILE_MAP = {
    home: 'inicio',
    demo: 'demo',
    plans: 'planes',
    quote: 'presupuesto',
    more: 'mas'
  };

  let currentRoute = 'inicio';
  let tabsShell = null;
  let subTabsShell = null;
  let subTabsInner = null;
  let applyingHistory = false;

  function bySelector(selector) {
    try { return document.querySelector(selector); } catch (_) { return null; }
  }

  function loadDemoOnboardingModule() {
    if (window.PresupuestoDemoOnboarding || document.querySelector('script[data-demo-onboarding-module]')) return;
    const script = document.createElement('script');
    script.src = 'presupuesto-demo-onboarding.js?v=20260901-1';
    script.dataset.demoOnboardingModule = '1';
    script.async = false;
    document.head.appendChild(script);
  }

  function installDemoResponseInterceptor() {
    if (window.__PRESUPUESTO_DEMO_FETCH_HOOK__) return;
    window.__PRESUPUESTO_DEMO_FETCH_HOOK__ = true;
    const nativeFetch = window.fetch.bind(window);
    const safeQuoteUrl = 'https://lfdmbkzghnwvsapxypvt.supabase.co/functions/v1/presupuesto-propuesta-corporativa-segura';
    const originalQuotePattern = /\/functions\/v1\/presupuesto-propuesta-corporativa(?:\?|$)/;
    window.fetch = async function(input, init) {
      const url = typeof input === 'string' ? input : (input?.url || '');
      let routedInput = input;
      if (originalQuotePattern.test(url)) {
        const queryIndex = url.indexOf('?');
        routedInput = queryIndex >= 0 ? `${safeQuoteUrl}${url.slice(queryIndex)}` : safeQuoteUrl;
      }
      const response = await nativeFetch(routedInput, init);
      try {
        const method = String(init?.method || (typeof input !== 'string' ? input?.method : '') || 'GET').toUpperCase();
        if (method === 'POST' && originalQuotePattern.test(url)) {
          const copy = response.clone();
          Promise.resolve().then(async () => {
            try {
              const data = await copy.json();
              if (!data || data.ok !== true || data.request_type !== 'demo' || !data.demo_onboarding) return;
              let prospect = null;
              if (typeof init?.body === 'string') {
                try { prospect = JSON.parse(init.body); } catch (_) {}
              }
              const detail = { reference: data.reference || '', demo_onboarding: data.demo_onboarding, prospect };
              if (window.PresupuestoDemoOnboarding?.start) window.PresupuestoDemoOnboarding.start(detail);
              else {
                window.__PRESUPUESTO_PENDING_DEMO__ = detail;
                window.dispatchEvent(new CustomEvent('presupuesto:demo-created', { detail }));
              }
            } catch (_) {}
          });
        }
      } catch (_) {}
      return response;
    };
  }

  function normalizeLegacyHash(rawHash) {
    const hash = String(rawHash || '');
    if (!hash.startsWith('#/')) return null;
    const parts = hash.slice(2).split('/').filter(Boolean);
    const first = parts[0] || 'inicio';
    if (first === 'inicio') return 'inicio';
    if (first === 'demo') return 'demo';
    if (first === 'planes') return 'planes';
    if (first === 'cotizar') return 'presupuesto';
    if (first === 'mas') return parts[1] && ROUTES[parts[1]] ? parts[1] : 'mas';
    return 'inicio';
  }

  function routeFromHash(rawHash = location.hash) {
    const legacy = normalizeLegacyHash(rawHash);
    if (legacy) return legacy;
    const key = decodeURIComponent(String(rawHash || '').replace(/^#/, '')).trim();
    if (ROUTES[key]) return key;
    if (HASH_ALIASES[key]) return HASH_ALIASES[key];
    return 'inicio';
  }

  function managedSections() {
    const selectors = [...new Set(Object.values(ROUTES).flatMap(route => route.selectors))];
    return selectors.map(bySelector).filter(Boolean);
  }

  function injectStyles() {
    if (document.getElementById('globalTabNavigationStyles')) return;
    const style = document.createElement('style');
    style.id = 'globalTabNavigationStyles';
    style.textContent = `
      @media screen {
        body.global-tabs-ready .global-tab-section { display:none !important; }
        body.global-tabs-ready .global-tab-section.global-tab-active { display:block !important; }
        body.global-tabs-ready .desktop-nav { display:none !important; }
        body.global-tabs-ready .mobile-screen-label { display:none !important; }
        body.global-tabs-ready .mobile-view-hidden.global-tab-active { display:block !important; }
        body.global-tabs-ready .mobile-view-visible:not(.global-tab-active) { display:none !important; }
        body.global-tabs-ready #mobileMoreHub.global-tab-active { display:block !important; }
      }

      .app-tabs-shell {
        position:sticky;
        top:70px;
        z-index:86;
        background:rgba(245,247,251,.96);
        backdrop-filter:blur(16px);
        border-bottom:1px solid var(--line);
        padding:8px 0;
        box-shadow:0 8px 24px rgba(8,24,47,.05);
      }
      .app-tabs {
        width:min(calc(100% - 32px),var(--container));
        margin-inline:auto;
        display:grid;
        grid-template-columns:repeat(5,minmax(0,1fr));
        gap:7px;
        padding:4px;
        border:1px solid #dbe5eb;
        border-radius:17px;
        background:#fff;
      }
      .app-tab {
        min-height:46px;
        border:0;
        border-radius:12px;
        background:transparent;
        color:#52677a;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:7px;
        padding:9px 12px;
        font-weight:850;
        font-size:.76rem;
        cursor:pointer;
        transition:background .18s ease,color .18s ease,box-shadow .18s ease,transform .18s ease;
      }
      .app-tab i { color:#8093a4; }
      .app-tab:hover { background:#f4f8f8; color:var(--navy); }
      .app-tab.is-active {
        background:linear-gradient(135deg,var(--brand),#0b6072);
        color:#fff;
        box-shadow:0 8px 20px rgba(15,118,110,.2);
      }
      .app-tab.is-active i { color:#fff; }

      .app-subtabs-shell {
        position:sticky;
        top:132px;
        z-index:84;
        background:rgba(255,255,255,.96);
        backdrop-filter:blur(14px);
        border-bottom:1px solid #e5ecef;
        padding:7px 0;
      }
      .app-subtabs-shell[hidden] { display:none !important; }
      .app-subtabs {
        width:min(calc(100% - 32px),var(--container));
        margin-inline:auto;
        display:flex;
        gap:7px;
        overflow-x:auto;
        scrollbar-width:none;
        padding:1px 0 3px;
      }
      .app-subtabs::-webkit-scrollbar { display:none; }
      .app-subtab {
        flex:0 0 auto;
        min-height:38px;
        border:1px solid var(--line);
        border-radius:999px;
        background:#fff;
        color:#52677a;
        padding:8px 13px;
        font-size:.69rem;
        font-weight:850;
        cursor:pointer;
        white-space:nowrap;
      }
      .app-subtab.is-active {
        border-color:#9bcfc9;
        background:var(--soft-brand);
        color:var(--brand-700);
        box-shadow:0 0 0 2px rgba(15,118,110,.05);
      }

      body.global-tabs-ready .global-tab-active {
        animation:globalTabIn .22s ease both;
      }
      @keyframes globalTabIn {
        from { opacity:.55; transform:translateY(7px); }
        to { opacity:1; transform:translateY(0); }
      }

      @media (max-width:639px) {
        .app-tabs-shell { display:none !important; }
        .app-subtabs-shell { top:70px; padding:6px 0; }
        .app-subtabs { width:calc(100% - 22px); }
        .app-subtab { min-height:36px; padding:7px 12px; font-size:.66rem; }
        body.global-tabs-ready { padding-bottom:calc(78px + env(safe-area-inset-bottom)); }
      }

      @media (min-width:640px) and (max-width:959px) {
        .app-tabs { width:min(calc(100% - 24px),900px); }
        .app-tab { min-height:44px; padding:8px 7px; font-size:.7rem; }
        .app-subtabs { width:min(calc(100% - 24px),900px); }
      }

      @media (min-width:960px) {
        .app-tabs { max-width:820px; }
      }

      @media print {
        .app-tabs-shell,.app-subtabs-shell { display:none !important; }
        body.global-tabs-ready .global-tab-section { display:block !important; animation:none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function injectMainTabs() {
    if (document.getElementById('appTabsShell')) {
      tabsShell = document.getElementById('appTabsShell');
      return;
    }
    const header = document.querySelector('.site-header');
    if (!header) return;
    tabsShell = document.createElement('nav');
    tabsShell.id = 'appTabsShell';
    tabsShell.className = 'app-tabs-shell no-print';
    tabsShell.setAttribute('aria-label', 'Secciones principales');
    tabsShell.innerHTML = `<div class="app-tabs">${MAIN_TABS.map(tab => `
      <button class="app-tab" type="button" data-app-route="${tab.key}" aria-label="Abrir ${tab.label}">
        <i class="fa-solid ${tab.icon}" aria-hidden="true"></i><span>${tab.label}</span>
      </button>`).join('')}</div>`;
    header.insertAdjacentElement('afterend', tabsShell);
  }

  function injectSubTabs() {
    if (document.getElementById('appSubTabsShell')) {
      subTabsShell = document.getElementById('appSubTabsShell');
      subTabsInner = subTabsShell.querySelector('.app-subtabs');
      return;
    }
    subTabsShell = document.createElement('nav');
    subTabsShell.id = 'appSubTabsShell';
    subTabsShell.className = 'app-subtabs-shell no-print';
    subTabsShell.hidden = true;
    subTabsShell.setAttribute('aria-label', 'Secciones relacionadas');
    subTabsInner = document.createElement('div');
    subTabsInner.className = 'app-subtabs';
    subTabsShell.appendChild(subTabsInner);
    (tabsShell || document.querySelector('.site-header'))?.insertAdjacentElement('afterend', subTabsShell);
  }

  function renderSubTabs(main, activeKey) {
    if (!subTabsShell || !subTabsInner) return;
    const items = main === 'demo' ? DEMO_SUBTABS : main === 'mas' ? MORE_SUBTABS : [];
    subTabsShell.hidden = items.length === 0;
    if (!items.length) {
      subTabsInner.innerHTML = '';
      return;
    }
    subTabsInner.innerHTML = items.map(item => `
      <button class="app-subtab${item.key === activeKey ? ' is-active' : ''}" type="button" data-app-route="${item.key}"${item.key === activeKey ? ' aria-current="page"' : ''}>${item.label}</button>
    `).join('');
  }

  function markSections() {
    managedSections().forEach(section => section.classList.add('global-tab-section'));
  }

  function updateMainTabState(main) {
    document.querySelectorAll('[data-app-route]').forEach(button => {
      if (!button.classList.contains('app-tab')) return;
      const active = button.dataset.appRoute === main;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });

    document.querySelectorAll('[data-mobile-view-target]').forEach(button => {
      const mapped = MOBILE_MAP[button.dataset.mobileViewTarget];
      button.classList.toggle('is-active', mapped === main);
    });
  }

  function showOnlyRoute(routeKey) {
    const route = ROUTES[routeKey] || ROUTES.inicio;
    const active = new Set(route.selectors.map(bySelector).filter(Boolean));
    managedSections().forEach(section => section.classList.toggle('global-tab-active', active.has(section)));
    updateMainTabState(route.main);
    renderSubTabs(route.main, routeKey);
    currentRoute = routeKey;
  }

  function closeLegacyMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    const menuToggle = document.getElementById('menuToggle');
    const icon = menuToggle?.querySelector('i');
    if (mobileMenu) {
      mobileMenu.classList.remove('is-open');
      mobileMenu.setAttribute('aria-hidden', 'true');
    }
    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'Abrir menú');
    }
    if (icon) {
      icon.classList.remove('fa-xmark');
      icon.classList.add('fa-bars');
    }
    document.body.classList.remove('menu-open');
  }

  function topOffset() {
    const header = document.querySelector('.site-header');
    const mainTabs = window.matchMedia('(min-width:640px)').matches && tabsShell ? tabsShell.offsetHeight : 0;
    const subTabs = subTabsShell && !subTabsShell.hidden ? subTabsShell.offsetHeight : 0;
    return (header?.offsetHeight || 70) + mainTabs + subTabs + 10;
  }

  function scrollRouteIntoView(routeKey, targetId = '') {
    const route = ROUTES[routeKey] || ROUTES.inicio;
    const target = targetId ? document.getElementById(targetId) : route.selectors.map(bySelector).find(Boolean);
    if (!target) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    const y = Math.max(0, target.getBoundingClientRect().top + window.scrollY - topOffset());
    window.scrollTo({ top: y, behavior: 'auto' });
  }

  function hashForRoute(routeKey) {
    return `#${routeKey}`;
  }

  function navigate(routeKey, options = {}) {
    const validKey = ROUTES[routeKey] ? routeKey : 'inicio';
    const { replace = false, scroll = true, targetId = '' } = options;
    const nextHash = hashForRoute(validKey);
    closeLegacyMenu();
    applyingHistory = true;
    try {
      if (replace) history.replaceState({ appRoute: validKey }, '', `${location.pathname}${location.search}${nextHash}`);
      else if (location.hash !== nextHash) history.pushState({ appRoute: validKey }, '', nextHash);
      showOnlyRoute(validKey);
      if (scroll) requestAnimationFrame(() => scrollRouteIntoView(validKey, targetId));
    } finally {
      applyingHistory = false;
    }
  }

  function applyLocationRoute(options = {}) {
    const sourceHash = options.useInitialHash
      ? (window.__PRESUPUESTO_INITIAL_HASH__ || location.hash)
      : location.hash;
    const legacy = normalizeLegacyHash(sourceHash);
    const routeKey = legacy || routeFromHash(sourceHash);
    const canonicalHash = hashForRoute(routeKey);
    if (legacy || sourceHash !== location.hash || location.hash !== canonicalHash) {
      history.replaceState({ appRoute: routeKey }, '', `${location.pathname}${location.search}${canonicalHash}`);
    }
    showOnlyRoute(routeKey);
    if (options.scroll !== false) requestAnimationFrame(() => scrollRouteIntoView(routeKey));
  }

  function handleDemoRequestEntry(event) {
    const entry = event.target.closest('#demoWhatsappBtn,[data-demo-request-entry]');
    const heroDemo = event.target.closest('.hero__actions .btn--primary');
    const heroMatches = heroDemo && /solicitar\s+demo/i.test(heroDemo.textContent || '');
    if (!entry && !heroMatches) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.PresupuestoLead?.setRequestMode?.('demo');
    navigate('presupuesto', { scroll: false });
    window.setTimeout(() => {
      const lead = document.getElementById('leadCapture');
      if (!lead) return;
      const y = Math.max(0, lead.getBoundingClientRect().top + window.scrollY - topOffset());
      window.scrollTo({ top: y, behavior: 'smooth' });
      document.getElementById('leadCompany')?.focus({ preventScroll: true });
    }, 80);
    return true;
  }

  function handleNavigationClick(event) {
    if (event.button != null && event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (handleDemoRequestEntry(event)) return;

    const appButton = event.target.closest('[data-app-route]');
    if (appButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      navigate(appButton.dataset.appRoute || 'inicio');
      return;
    }

    const mobileTab = event.target.closest('[data-mobile-view-target]');
    if (mobileTab) {
      const routeKey = MOBILE_MAP[mobileTab.dataset.mobileViewTarget] || 'inicio';
      event.preventDefault();
      event.stopImmediatePropagation();
      navigate(routeKey);
      return;
    }

    const moreCard = event.target.closest('[data-mobile-more-target]');
    if (moreCard) {
      const routeKey = moreCard.dataset.mobileMoreTarget;
      if (!ROUTES[routeKey]) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      navigate(routeKey);
      return;
    }

    const backMore = event.target.closest('[data-mobile-back-more]');
    if (backMore) {
      event.preventDefault();
      event.stopImmediatePropagation();
      navigate('mas');
      return;
    }

    const anchor = event.target.closest('a[href^="#"]');
    if (!anchor) return;
    const raw = anchor.getAttribute('href') || '';
    const hashKey = decodeURIComponent(raw.replace(/^#/, '')).trim();
    const routeKey = ROUTES[hashKey] ? hashKey : HASH_ALIASES[hashKey];
    if (!routeKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const targetId = hashKey === 'leadCapture' ? 'leadCapture' : '';
    navigate(routeKey, { targetId });
  }

  function setup() {
    installDemoResponseInterceptor();
    loadDemoOnboardingModule();
    injectStyles();
    injectMainTabs();
    injectSubTabs();
    markSections();
    document.body.classList.add('global-tabs-ready');

    document.addEventListener('click', handleNavigationClick, true);

    window.addEventListener('popstate', () => {
      if (applyingHistory) return;
      requestAnimationFrame(() => applyLocationRoute({ scroll: true }));
    });
    window.addEventListener('hashchange', () => {
      if (applyingHistory) return;
      requestAnimationFrame(() => applyLocationRoute({ scroll: true }));
    });

    const initialHash = window.__PRESUPUESTO_INITIAL_HASH__ || location.hash;
    applyLocationRoute({ scroll: initialHash.length > 1, useInitialHash: true });

    window.PresupuestoTabs = {
      navigate,
      current: () => currentRoute,
      refresh: () => applyLocationRoute({ scroll: false })
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})();
