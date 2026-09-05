# -*- coding: utf-8 -*-
"""Renderiza so o canvas do dente 3D, isolado, num PNG grande.

Reaproveita o proprio bloco de script que esta dentro do index.html, pra
nao existir uma segunda copia da geometria pra sair de sincronia.
"""
import io, os, re, subprocess, sys

SP = os.path.dirname(os.path.abspath(__file__)).replace(chr(92), '/')
CHROME = r'C:/Program Files/Google/Chrome/Application/chrome.exe'
SRC = os.path.join(SP, '..', 'site', 'index.html')

s = io.open(SRC, encoding='utf-8').read()
m = re.search(r'( +/\* ---- dente 3D no canvas.*?\n  \}\)\(\);)', s, re.S)
if not m:
    sys.exit('nao achei o bloco do dente no index.html')
js = m.group(1)

SIZE = int(sys.argv[1]) if len(sys.argv) > 1 else 620
BG = sys.argv[2] if len(sys.argv) > 2 else '#281d59'

page = """<!doctype html><meta charset=utf-8>
<style>html,body{margin:0;background:%s}
.tooth-stage{width:%dpx;height:%dpx}
.tooth-canvas{display:none;width:100%%;height:100%%}
.tooth-stage.is-3d .tooth-canvas{display:block}</style>
<div class="tooth-stage"><canvas id="tooth3d" class="tooth-canvas"></canvas></div>
<script>var reduce=true;
%s
</script>""" % (BG, SIZE, SIZE, js)

tmp = os.path.join(SP, '_cv.html').replace(chr(92), '/')
io.open(tmp, 'w', encoding='utf-8').write(page)
out = os.path.join(SP, 'p_canvas.png').replace(chr(92), '/')
subprocess.run([CHROME, '--headless', '--hide-scrollbars',
                '--force-device-scale-factor=2', '--virtual-time-budget=4000',
                '--enable-unsafe-swiftshader',
                '--screenshot=' + out, '--window-size=%d,%d' % (SIZE, SIZE),
                'file:///' + tmp], capture_output=True)
print('p_canvas.png', os.path.getsize(out) if os.path.exists(out) else 'FALHOU')
