# -*- coding: utf-8 -*-
"""Renderiza o dente sozinho num PNG pra conferir a forma."""
import io, os, subprocess, sys, importlib
SP = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, SP)
d3 = importlib.import_module('gerar-dente-3d'.replace('-', '_')) if False else None
import types
src = io.open(os.path.join(SP, 'gerar-dente-3d.py'), encoding='utf-8').read()
d3 = types.ModuleType('d3'); exec(compile(src, 'gerar-dente-3d.py', 'exec'), d3.__dict__)

CHROME = r'C:/Program Files/Google/Chrome/Application/chrome.exe'
S = 560
body = d3.build(size=S, cr=26, cm=36, rr_=10, rm=10, seg=88, steps=50, prec=2, scale=.46)
html = """<style>html,body{margin:0;background:#efeaff}</style>
<svg width="%d" height="%d" viewBox="0 0 %d %d" fill="none">
<defs><linearGradient id="g" x1="0" y1="0.1" x2="0.92" y2="0.92" gradientUnits="objectBoundingBox">
<stop offset="0" stop-color="#2a2472"/><stop offset=".45" stop-color="#5b4fd6"/><stop offset="1" stop-color="#f5851f"/>
</linearGradient></defs>
<g stroke="url(#g)" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round">%s</g></svg>""" % (S,S,S,S, body)
tmp = os.path.join(SP, '_dente.html')
io.open(tmp, 'w', encoding='utf-8').write(html)
out = os.path.join(SP, 'p_dente.png')
subprocess.run([CHROME, '--headless', '--disable-gpu', '--hide-scrollbars',
                '--force-device-scale-factor=1', '--virtual-time-budget=3000',
                '--screenshot=' + out.replace(chr(92), '/'),
                '--window-size=%d,%d' % (S, S), 'file:///' + tmp.replace(chr(92), '/')],
               capture_output=True)
print('p_dente.png', os.path.getsize(out), 'bytes svg:', len(body))
