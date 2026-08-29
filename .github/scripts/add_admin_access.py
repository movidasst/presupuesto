from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

old_footer='<div class="footer__links no-print"><a href="https://movidasst.org/" target="_blank" rel="noopener">Academia</a><a href="https://www.movidasst.com/" target="_blank" rel="noopener">La Movida SST</a><a href="#top">Volver arriba ↑</a></div>'
new_footer='<div class="footer__links no-print"><a href="https://movidasst.org/" target="_blank" rel="noopener">Academia</a><a href="https://www.movidasst.com/" target="_blank" rel="noopener">La Movida SST</a><a href="admin.html"><i class="fa-solid fa-lock" aria-hidden="true"></i> Administración</a><a href="#top">Volver arriba ↑</a></div>'
if old_footer not in s:
    raise SystemExit('No se encontró el footer esperado')
s=s.replace(old_footer,new_footer,1)

needle='''          <button class="mobile-more-card" type="button" data-mobile-more-target="contacto">\n            <span class="mobile-more-card__icon"><i class="fa-solid fa-headset" aria-hidden="true"></i></span>\n            <span><strong>Contacto</strong><small>Atención corporativa</small></span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i>\n          </button>'''
insert=needle+'''\n          <a class="mobile-more-card" href="admin.html">\n            <span class="mobile-more-card__icon"><i class="fa-solid fa-lock" aria-hidden="true"></i></span>\n            <span><strong>Administración</strong><small>Configurar tarifas y condiciones</small></span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i>\n          </a>'''
if needle not in s:
    raise SystemExit('No se encontró la tarjeta móvil de Contacto')
s=s.replace(needle,insert,1)

p.write_text(s,encoding='utf-8')
print('Acceso de administración agregado.')
