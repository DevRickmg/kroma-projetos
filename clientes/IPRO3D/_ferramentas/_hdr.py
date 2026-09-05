import io, os, subprocess
s = io.open('../site/index.html', encoding='utf-8').read().replace(
    '</body>', '<style>.rv{opacity:1!important;transform:none!important}</style></body>')
tmp = os.path.abspath('_h.html'); io.open(tmp,'w',encoding='utf-8').write(s)
subprocess.run([r'C:/Program Files/Google/Chrome/Application/chrome.exe','--headless',
  '--enable-unsafe-swiftshader','--hide-scrollbars','--force-device-scale-factor=2',
  '--virtual-time-budget=4000','--screenshot='+os.path.abspath('p_h.png').replace(chr(92),'/'),
  '--window-size=900,110','file:///'+tmp.replace(chr(92),'/')], capture_output=True)
print(os.path.getsize('p_h.png'))
