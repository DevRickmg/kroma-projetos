# -*- coding: utf-8 -*-
"""Renderiza a silhueta do dente (build_flat) num PNG pra conferir a forma."""
import io, os, subprocess, sys, types

SP = os.path.dirname(os.path.abspath(__file__)).replace(chr(92), '/')
CHROME = r'C:/Program Files/Google/Chrome/Application/chrome.exe'
src = io.open(os.path.join(SP, 'gerar-dente-3d.py'), encoding='utf-8').read()
d3 = types.ModuleType('d3'); exec(compile(src, 'gerar-dente-3d.py', 'exec'), d3.__dict__)

S = int(sys.argv[1]) if len(sys.argv) > 1 else 560
# varias poses, pra ver se as 4 pontinhas leem de qualquer angulo
POSES = [0, 22, 45, 70]
cells = []
for a in POSES:
    body = d3.build_flat(size=S, cr=42, seg=76, rr_=16, segr=34,
                         phi=a, pitch=14, prec=2, scale=.90)
    cells.append('<svg width="%d" height="%d" viewBox="0 0 %d %d">'
                 '<g fill="#fff" stroke="#fff" stroke-width=".5">%s</g></svg>'
                 % (S//2, S//2, S, S, body))

html = ('<style>html,body{margin:0;background:#281d59;display:flex;flex-wrap:wrap}'
        'svg{display:block}</style>' + ''.join(cells))
tmp = os.path.join(SP, '_dente.html').replace(chr(92), '/')
io.open(tmp, 'w', encoding='utf-8').write(html)
out = os.path.join(SP, 'p_dente.png').replace(chr(92), '/')
subprocess.run([CHROME, '--headless', '--disable-gpu', '--hide-scrollbars',
                '--force-device-scale-factor=2', '--virtual-time-budget=4000',
                '--screenshot=' + out, '--window-size=%d,%d' % (S, S),
                'file:///' + tmp], capture_output=True)
print('p_dente.png', os.path.getsize(out) if os.path.exists(out) else 'FALHOU',
      '· svg', len(cells[0]), 'bytes')
