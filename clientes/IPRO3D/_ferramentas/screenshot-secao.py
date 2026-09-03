# -*- coding: utf-8 -*-
"""Isola uma secao no topo da pagina e tira screenshot (sem depender de scroll)."""
import io, os, subprocess, sys
SP = os.path.dirname(os.path.abspath(__file__))
CHROME = r'C:/Program Files/Google/Chrome/Application/chrome.exe'
SRC = r'c:/Users/Microsoft/Documents/kroma-projetos/clientes/IPRO3D/site/index.html'

TPL = """
<style>
html{scroll-behavior:auto!important}
.rv{opacity:1!important;transform:none!important;transition:none!important}
body>*{display:none!important}
body>#KEEP{display:block!important}
</style>
</body>"""

def shot(section, out, w=1440, h=900):
    s = io.open(SRC, encoding='utf-8').read()
    s = s.replace('</body>', TPL.replace('KEEP', section))
    tmp = os.path.join(SP, '_iso.html')
    io.open(tmp, 'w', encoding='utf-8').write(s)
    subprocess.run([CHROME, '--headless', '--disable-gpu', '--hide-scrollbars',
                    '--force-device-scale-factor=1', '--virtual-time-budget=5000',
                    '--screenshot=' + os.path.join(SP, out).replace(chr(92), '/'),
                    '--window-size=%d,%d' % (w, h),
                    'file:///' + tmp.replace(chr(92), '/')], capture_output=True)
    p = os.path.join(SP, out)
    print(out, os.path.getsize(p) if os.path.exists(p) else 'FALHOU')

if __name__ == '__main__':
    for a in sys.argv[1:]:
        sec, w, h = a, 1440, 900
        if ':' in a:
            sec, d = a.split(':'); w, h = [int(x) for x in d.split('x')]
        shot(sec, 's_%s.png' % sec, w, h)
