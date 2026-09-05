# -*- coding: utf-8 -*-
"""Screenshot com viewport MOBILE de verdade.

O Chrome nao aceita janela abaixo de ~500px de largura, entao --window-size=390
renderiza a 500 e corta a direita (falso positivo de overflow). Aqui a pagina vai
dentro de um iframe com a largura pedida, que ganha viewport real.
"""
import io, os, subprocess, sys

SP = os.path.dirname(os.path.abspath(__file__)).replace(chr(92), '/')
CHROME = r'C:/Program Files/Google/Chrome/Application/chrome.exe'
SRC = r'c:/Users/Microsoft/Documents/kroma-projetos/clientes/IPRO3D/site/index.html'

ISO = """
<style>
html{scroll-behavior:auto!important}
.rv{opacity:1!important;transform:none!important;transition:none!important}
body>*{display:none!important}
body>#KEEP{display:block!important}
</style>
</body>"""

WRAP = """<!doctype html><meta charset=utf-8>
<body style="margin:0;background:#e5e7f0;display:flex;justify-content:flex-start">
<iframe src="%s" style="width:%dpx;height:%dpx;border:0;background:#fff" scrolling="no"></iframe>
</body>"""


def shot(section, out, w=390, h=900, src=SRC):
    s = io.open(src, encoding='utf-8').read()
    if section:
        s = s.replace('</body>', ISO.replace('KEEP', section))
    page = os.path.join(SP, '_m_page.html').replace(chr(92), '/')
    io.open(page, 'w', encoding='utf-8').write(s)
    io.open(os.path.join(SP, '_m_wrap.html'), 'w', encoding='utf-8').write(
        WRAP % ('_m_page.html', w, h))
    subprocess.run([CHROME, '--headless', '--enable-unsafe-swiftshader', '--hide-scrollbars',
                    '--force-device-scale-factor=1', '--virtual-time-budget=6000',
                    '--allow-file-access-from-files',
                    '--screenshot=' + SP + '/' + out,
                    '--window-size=%d,%d' % (w + 20, h),
                    'file:///' + SP + '/_m_wrap.html'], capture_output=True)
    p = os.path.join(SP, out)
    print(out, os.path.getsize(p) if os.path.exists(p) else 'FALHOU')


if __name__ == '__main__':
    for a in sys.argv[1:]:
        sec, w, h, src = a, 390, 900, SRC
        if ':' in a:
            sec, d = a.split(':', 1)
            w, h = [int(x) for x in d.split('x')]
        if sec.endswith('.html'):
            src = os.path.join(os.path.dirname(SRC), sec)
            shot(None, 's_m_' + sec.replace('.html', '') + '.png', w, h, src)
        else:
            shot(sec, 's_m_%s.png' % sec, w, h)
