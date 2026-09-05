# -*- coding: utf-8 -*-
"""Regera o dente e injeta nas marcas do site.

Duas saidas, do MESMO modelo 3D (`gerar-dente-3d.py`), na mesma pose:

  · `brand-mark` (logo do header e do rodape) — `build_outline()`: a silhueta
    virada num contorno unico e liso. Chapada, uma cor so (ou gradiente),
    sem malha. A versao antiga usava `build_flat()`, que cospe uma face por
    quad: em 38px as costuras viravam pernas e o dente ficava com cara de
    polvo.
  · `book-mark` (dente grande da capa do livro do e-book) — `build_flat()`,
    que ali aparece grande o bastante pra malha nao atrapalhar.

O dente do hero NAO passa por aqui: e o embed do Sketchfab, direto no
markup do `index.html`.
"""
import io, os, re, types

SP = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(SP, '..', 'site')
src = io.open(os.path.join(SP, 'gerar-dente-3d.py'), encoding='utf-8').read()
d3 = types.ModuleType('d3'); exec(compile(src, 'gerar-dente-3d.py', 'exec'), d3.__dict__)

GRAD_MARK = ('<linearGradient id="markGrad" x1="0" y1="0" x2="0.85" y2="1" '
             'gradientUnits="objectBoundingBox"><stop offset="0" stop-color="#5b4fd6"/>'
             '<stop offset=".55" stop-color="#2a2472"/>'
             '<stop offset="1" stop-color="#f5851f"/></linearGradient>')

# grid/smooth mais altos que o padrao: em 38px qualquer serrilhado aparece
OUTLINE = d3.build_outline(size=40, smooth=6, grid=220, eps=.30)

MARK_GRAD = ('<svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true">'
             '<defs>%s</defs><g fill="url(#markGrad)">%s</g></svg>'
             % (GRAD_MARK, OUTLINE))
MARK_WHITE = ('<svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true">'
              '<g fill="#fff">%s</g></svg>' % OUTLINE)

# capa do livro: fundo laranja, entao sempre branco (e maior, aparece grande)
BOOK_MARK = ('<svg class="book-mark" viewBox="0 0 40 40" aria-hidden="true">'
             '<g fill="#fff" stroke="#fff" stroke-width=".5" stroke-linejoin="round">'
             '%s</g></svg>'
             % d3.build_flat(size=40, cr=22, seg=44, rr_=11, segr=22,
                             phi=26, pitch=13, prec=2, scale=.96))

PAT = re.compile(r'<svg class="(brand-mark|book-mark)"[^>]*>.*?</svg>', re.S)


def marca(m):
    whole, cls = m.group(0), m.group(1)
    if cls == 'book-mark':
        return BOOK_MARK
    # a marca em fundo escuro (rodape, header da landing) e branca
    return MARK_WHITE if 'markGrad' not in whole else MARK_GRAD


for fn in ('index.html', 'ebook.html'):
    p = os.path.join(SITE, fn)
    s = io.open(p, encoding='utf-8').read()
    n = [0]

    def rep(m):
        n[0] += 1
        return marca(m)

    s2 = PAT.sub(rep, s)
    io.open(p, 'w', encoding='utf-8', newline='').write(s2)
    print(fn, n[0], 'svg(s)', len(s2), 'bytes')
