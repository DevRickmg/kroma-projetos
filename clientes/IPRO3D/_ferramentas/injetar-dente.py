# -*- coding: utf-8 -*-
"""Regenera a malha do dente e injeta nos SVGs do site (hero + logos)."""
import io, os, re, types

SP = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(SP, '..', 'site')
src = io.open(os.path.join(SP, 'gerar-dente-3d.py'), encoding='utf-8').read()
d3 = types.ModuleType('d3'); exec(compile(src, 'gerar-dente-3d.py', 'exec'), d3.__dict__)

HERO = dict(size=260, cr=24, cm=34, rr_=9, rm=9, seg=84, steps=46,
            phi=24, pitch=13, op_back=.26, eps=.34, prec=1, scale=.82)
LOGO = dict(size=40, cr=6, cm=16, rr_=2, rm=6, seg=48, steps=26,
            phi=22, pitch=11, op_back=.36, eps=.06, prec=2, scale=.96)
MINI = dict(size=40, cr=5, cm=12, rr_=2, rm=5, seg=40, steps=22,
            phi=22, pitch=11, op_back=.44, eps=.09, prec=2, scale=.96)

MESH = {'tooth-3d': d3.build(**HERO), 'brand-mark': d3.build(**LOGO)}
MINI_MESH = d3.build(**MINI)

# <svg class="X" ...>  ...  <g stroke="..." ...>  MALHA  </g></svg>
PAT = re.compile(r'(<svg class="(tooth-3d|brand-mark)"[^>]*>.*?<g stroke="[^"]*"[^>]*>)'
                 r'.*?(</g></svg>)', re.S)

for fn in ('index.html', 'ebook.html'):
    p = os.path.join(SITE, fn)
    s = io.open(p, encoding='utf-8').read()
    n = [0]
    def rep(m):
        head, cls = m.group(1), m.group(2)
        n[0] += 1
        mesh = MINI_MESH if 'stroke="#fff"' in head else MESH[cls]
        return head + mesh + m.group(3)
    s2 = PAT.sub(rep, s)
    io.open(p, 'w', encoding='utf-8').write(s2)
    print(fn, n[0], 'svg(s) atualizado(s)')
