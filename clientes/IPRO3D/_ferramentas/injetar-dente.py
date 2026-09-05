# -*- coding: utf-8 -*-
"""Regera a silhueta solida do dente e injeta nos SVGs do site.

O dente do hero e o `<canvas>` WebGL (o script vive dentro do index.html).
Estes SVGs sao o resto: os logos, e o fallback do hero pra quem nao tem
WebGL. Todos chapados — uma cor ou um degrade, sem linha nenhuma.
"""
import io, os, re, types

SP = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(SP, '..', 'site')
src = io.open(os.path.join(SP, 'gerar-dente-3d.py'), encoding='utf-8').read()
d3 = types.ModuleType('d3'); exec(compile(src, 'gerar-dente-3d.py', 'exec'), d3.__dict__)

HERO = dict(size=260, cr=34, seg=64, rr_=16, segr=26, phi=26, pitch=13,
            prec=1, scale=.90)
LOGO = dict(size=40,  cr=13, seg=26, rr_=7,  segr=13, phi=26, pitch=13,
            prec=1, scale=.96)

GRAD_HERO = ('<linearGradient id="toothGrad" x1="0" y1="0" x2="0.35" y2="1" '
             'gradientUnits="objectBoundingBox"><stop offset="0" stop-color="#fff"/>'
             '<stop offset=".55" stop-color="#eae7f8"/>'
             '<stop offset="1" stop-color="#a89fd0"/></linearGradient>')
GRAD_MARK = ('<linearGradient id="markGrad" x1="0" y1="0" x2="0.85" y2="1" '
             'gradientUnits="objectBoundingBox"><stop offset="0" stop-color="#5b4fd6"/>'
             '<stop offset=".55" stop-color="#2a2472"/>'
             '<stop offset="1" stop-color="#f5851f"/></linearGradient>')

MESH_HERO = d3.build_flat(**HERO)
MESH_LOGO = d3.build_flat(**LOGO)

def svg(cls, box, defs, paint, mesh):
    # o traco da mesma cor do preenchimento fecha a costura entre as faces
    return ('<svg class="%s" viewBox="0 0 %d %d" aria-hidden="true">%s'
            '<g fill="%s" stroke="%s" stroke-width=".5" stroke-linejoin="round">%s</g>'
            '</svg>' % (cls, box, box, defs, paint, paint, mesh))

HERO_SVG  = svg('tooth-3d',   260, '<defs>%s</defs>' % GRAD_HERO, 'url(#toothGrad)', MESH_HERO)
MARK_GRAD = svg('brand-mark',  40, '<defs>%s</defs>' % GRAD_MARK, 'url(#markGrad)',  MESH_LOGO)
MARK_WHITE= svg('brand-mark',  40, '', '#fff', MESH_LOGO)

PAT = re.compile(r'<svg class="(tooth-3d|brand-mark)"[^>]*>.*?</svg>', re.S)

for fn in ('index.html', 'ebook.html'):
    p = os.path.join(SITE, fn)
    s = io.open(p, encoding='utf-8').read()
    n = [0]
    def rep(m):
        n[0] += 1
        whole, cls = m.group(0), m.group(1)
        if cls == 'tooth-3d': return HERO_SVG
        # a marca em fundo escuro (rodape, header da landing) e branca
        return MARK_WHITE if 'stroke="#fff"' in whole or 'fill="#fff"' in whole \
               else MARK_GRAD
    s2 = PAT.sub(rep, s)
    io.open(p, 'w', encoding='utf-8').write(s2)
    print(fn, n[0], 'svg(s) ·', len(s2), 'bytes')
