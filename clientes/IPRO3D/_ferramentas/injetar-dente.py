# -*- coding: utf-8 -*-
"""Regera a silhueta solida do dente e injeta na capa do livro do e-book.

So o `book-mark` (dente grande da capa) passa por aqui. O logo do header e
do rodape (`brand-mark`) NAO: virou um dente chapado desenhado a mao, direto
no markup, porque a malha 3D achatada ficava com cara de polvo no tamanho
de 38px. O dente do hero tambem nao passa: e o embed do Sketchfab.
"""
import io, os, re, types

SP = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(SP, '..', 'site')
src = io.open(os.path.join(SP, 'gerar-dente-3d.py'), encoding='utf-8').read()
d3 = types.ModuleType('d3'); exec(compile(src, 'gerar-dente-3d.py', 'exec'), d3.__dict__)


def svg(cls, box, paint, mesh):
    # o traco da mesma cor do preenchimento fecha a costura entre as faces
    return ('<svg class="%s" viewBox="0 0 %d %d" aria-hidden="true">'
            '<g fill="%s" stroke="%s" stroke-width=".5" stroke-linejoin="round">%s</g>'
            '</svg>' % (cls, box, box, paint, paint, mesh))


# capa do livro: fundo laranja, entao sempre branco (e maior, aparece grande)
BOOK_MARK = svg('book-mark', 40, '#fff',
                d3.build_flat(size=40, cr=22, seg=44, rr_=11, segr=22,
                              phi=26, pitch=13, prec=2, scale=.96))

PAT = re.compile(r'<svg class="book-mark"[^>]*>.*?</svg>', re.S)

for fn in ('index.html', 'ebook.html'):
    p = os.path.join(SITE, fn)
    s = io.open(p, encoding='utf-8').read()
    n = [0]

    def rep(m):
        n[0] += 1
        return BOOK_MARK

    s2 = PAT.sub(rep, s)
    io.open(p, 'w', encoding='utf-8', newline='').write(s2)
    print(fn, n[0], 'svg(s) ·', len(s2), 'bytes')
