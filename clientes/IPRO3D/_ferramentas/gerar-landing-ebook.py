# -*- coding: utf-8 -*-
"""Gera ebook.html: landing dedicada pro e-book, reaproveitando tokens e livro 3D."""
import io, re

SITE = r'c:/Users/Microsoft/Documents/kroma-projetos/clientes/IPRO3D/site/index.html'
OUT = r'c:/Users/Microsoft/Documents/kroma-projetos/clientes/IPRO3D/site/ebook.html'
src = io.open(SITE, encoding='utf-8').read()

# reaproveita o CSS inteiro do site (tokens, botoes, livro 3D, form)
css = re.search(r'<style>(.*?)</style>', src, re.S).group(1)

# reaproveita o markup do livro 3D e a marca do header
lines = src.split(chr(10))
i0 = next(i for i, l in enumerate(lines) if 'class="book-stage"' in l)
i1 = next(i for i, l in enumerate(lines) if 'class="book-shadow"' in l)
book = chr(10).join(lines[i0:i1 + 2])
assert 'book-face' in book, 'livro incompleto'

brand = re.search(r'<a href="#top" class="brand".*?</a>', src, re.S).group(0)
brand = brand.replace('href="#top"', 'href="index.html"')

PAGE = """<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>E-book gratuito | O que diferencia os dentistas &ldquo;digitais&rdquo; &mdash; IPRO3D</title>
<meta name="description" content="Guia gratuito da IPRO3D para cirurgi&otilde;es-dentistas: o que muda na rotina do consult&oacute;rio quando o fluxo vira digital. Baixe em 30 segundos.">
<meta name="robots" content="index,follow">
<meta name="theme-color" content="#14103c">
<meta property="og:title" content="E-book gratuito &mdash; O que diferencia os dentistas digitais dos demais">
<meta property="og:description" content="Guia curto e direto para cirurgi&otilde;es-dentistas. Material gratuito da IPRO3D.">
<meta property="og:type" content="article">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
__CSS__

/* ---- especifico da landing ---- */
body{background:var(--indigo-900)}
header.lp-head{position:relative;z-index:5;padding:1.1rem 0;background:var(--indigo-900);
  backdrop-filter:none;border-bottom:1px solid var(--line-dark);box-shadow:none}
.lp-head .wrap{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}
.lp-head .brand-txt{color:#fff}
.lp-head .brand-txt small{color:#8985b4}
.lp-back{font-size:.88rem;color:#a29ecd;display:inline-flex;align-items:center;gap:.45rem;transition:color .25s}
.lp-back:hover{color:#fff}
.lp-hero{position:relative;overflow:hidden;
  background:radial-gradient(120% 130% at 18% 8%,#2f2782 0%,#1d1856 46%,#14103c 100%);
  padding:clamp(2.5rem,6vw,4.5rem) 0 clamp(3rem,7vw,5rem)}
.lp-hero::before{content:"";position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.13) 1px,transparent 1px);background-size:28px 28px;mask-image:radial-gradient(60% 80% at 25% 25%,#000,transparent)}
.lp-grid{position:relative;display:grid;grid-template-columns:.88fr 1.12fr;gap:clamp(2rem,6vw,5rem);align-items:center}
.lp-card{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.13);border-radius:var(--r-lg);padding:clamp(1.5rem,3vw,2.2rem);backdrop-filter:blur(6px)}
.lp-card h3{color:#fff;font-size:1.05rem;margin-bottom:1rem}
.lp-steps{list-style:none;display:grid;gap:1rem;counter-reset:st}
.lp-steps li{display:flex;gap:.85rem;align-items:flex-start;font-size:.93rem;color:#c9c5ea;counter-increment:st}
.lp-steps li::before{content:counter(st);flex:none;width:26px;height:26px;border-radius:50%;
  background:var(--orange);color:#fff;display:grid;place-items:center;font-family:"Plus Jakarta Sans",sans-serif;
  font-weight:700;font-size:.78rem}
.lp-trust{display:flex;gap:1.6rem;flex-wrap:wrap;margin-top:2.2rem;padding-top:1.8rem;border-top:1px solid var(--line-dark)}
.lp-trust div{font-size:.84rem;color:#8e8ab8}
.lp-trust b{display:block;font-family:"Plus Jakarta Sans",sans-serif;color:#fff;font-size:1.3rem;letter-spacing:-.03em;line-height:1.2}
.lp-foot{padding:2.2rem 0;border-top:1px solid var(--line-dark);font-size:.83rem;color:#7d79a8;text-align:center}
.lp-foot a{color:#a29ecd}
.lp-foot a:hover{color:#fff}
@media(max-width:1000px){.lp-grid{grid-template-columns:1fr}.book{width:min(230px,60%)}}
</style>
</head>
<body>

<header class="lp-head">
  <div class="wrap">
    __BRAND__
    <a href="index.html" class="lp-back">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>
      Voltar para o site
    </a>
  </div>
</header>

<section class="lp-hero dark">
  <div class="wrap">
    <div class="lp-grid">
      __BOOK__

      <div>
        <span class="eyebrow">E-book gratuito &middot; para cirurgi&otilde;es-dentistas</span>
        <h1 style="font-size:clamp(2rem,4vw,3.1rem);color:#fff;margin-bottom:1.1rem">O que diferencia os dentistas &ldquo;digitais&rdquo; dos demais</h1>
        <p class="lead" style="margin-bottom:1.8rem">Um guia curto e direto sobre o que muda na rotina do consult&oacute;rio quando o fluxo vira digital &mdash; escaneamento no lugar da moldagem, modelo em resina no lugar do gesso e exame que chega antes do paciente sair da cadeira.</p>

        <div class="lp-card">
          <h3>O que voc&ecirc; vai encontrar</h3>
          <ul class="eb-list" style="margin:0 0 1.6rem">
            <li><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5L20 7"/></svg> Onde o fluxo anal&oacute;gico ainda custa tempo e dinheiro</li>
            <li><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5L20 7"/></svg> O que o paciente percebe (e comenta) na primeira visita</li>
            <li><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5L20 7"/></svg> Por onde come&ccedil;ar sem trocar o consult&oacute;rio inteiro</li>
            <li><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5L20 7"/></svg> O que perguntar para um servi&ccedil;o de radiologia parceiro</li>
          </ul>

          <form class="eb-form" id="ebForm" name="ebook-lp" method="POST" data-netlify="true" netlify-honeypot="bot-field" style="margin-top:0">
            <input type="hidden" name="form-name" value="ebook-lp">
            <p hidden><label>N&atilde;o preencha: <input name="bot-field"></label></p>
            <input type="text" name="nome" placeholder="Seu nome" required autocomplete="name">
            <div class="row2">
              <input type="email" name="email" placeholder="Seu melhor e-mail" required autocomplete="email">
              <input type="tel" name="telefone" placeholder="WhatsApp" required autocomplete="tel">
            </div>
            <input type="text" name="cro" placeholder="CRO (opcional)">
            <button class="btn btn-orange btn-block" type="submit">Receber o e-book gr&aacute;tis
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 3v12M8 11l4 4 4-4"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>
            </button>
            <small class="dim" style="font-size:.78rem">Enviamos s&oacute; o material. Nada de spam.</small>
          </form>

          <div class="eb-ok" id="ebOk" style="margin-top:0">
            <strong>Pronto! Material a caminho.</strong>
            <span>Confira sua caixa de entrada (e o spam, por via das d&uacute;vidas). Se n&atilde;o chegar em alguns minutos, <a href="https://wa.me/5512981470501?text=Ol%C3%A1%21%20Baixei%20o%20e-book%20mas%20n%C3%A3o%20recebi." style="color:#fff;text-decoration:underline">chama no WhatsApp</a> que a gente reenvia.</span>
          </div>
        </div>

        <div class="lp-trust">
          <div><b>23 anos</b>de radiologia odontol&oacute;gica</div>
          <div><b>+300</b>dentistas parceiros</div>
          <div><b>100% digital</b>do exame ao laudo</div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="sect dark" style="background:var(--indigo-900);padding-top:clamp(2.5rem,5vw,4rem)">
  <div class="wrap">
    <div class="sect-head center">
      <span class="eyebrow">Como funciona</span>
      <h2>Do formul&aacute;rio ao seu e-mail</h2>
    </div>
    <div class="lp-card" style="max-width:640px;margin-inline:auto">
      <ol class="lp-steps">
        <li>Voc&ecirc; preenche nome, e-mail e WhatsApp no formul&aacute;rio acima.</li>
        <li>O material chega no seu e-mail em alguns minutos, em PDF.</li>
        <li>Ficou com d&uacute;vida sobre fluxo digital? Chama a equipe no WhatsApp &mdash; a gente responde sem compromisso.</li>
      </ol>
      <a href="https://wa.me/5512981470501?text=Ol%C3%A1%21%20Vim%20pela%20p%C3%A1gina%20do%20e-book." class="btn btn-orange" style="margin-top:1.8rem">Falar com a IPRO3D
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </a>
    </div>
  </div>
</section>

<footer class="lp-foot">
  <div class="wrap">
    <p style="margin-inline:auto">IPRO3D &mdash; Instituto Pindense de Radiologia Odontol&oacute;gica &middot; Av. Albuquerque Lins, 91, Pindamonhangaba/SP</p>
    <p style="margin-inline:auto;margin-top:.4rem">Respons&aacute;vel t&eacute;cnico: Dr. Ronald Lima &mdash; CRO-SP 66226 &middot; <a href="index.html">Voltar para o site</a></p>
  </div>
</footer>

<a class="wa" href="https://wa.me/5512981470501?text=Ol%C3%A1%21%20Vim%20pela%20p%C3%A1gina%20do%20e-book." aria-label="Falar no WhatsApp" target="_blank" rel="noopener">
  <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 00-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1012 2Zm5.7 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5-4.5-.2-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.2-.3.5-.4.7-.4h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.1.3.7 1.1 1.4 1.8 1 .9 1.8 1.1 2 1.3.3.1.4.1.6-.1l.7-.9c.2-.3.4-.2.6-.1l1.9.9c.2.1.4.2.5.3.1.2.1.6-.1 1.2Z"/></svg>
</a>

<script>
(function(){
  var eb = document.getElementById('ebForm');
  eb.addEventListener('submit', function(e){
    e.preventDefault();
    eb.style.display = 'none';
    document.getElementById('ebOk').classList.add('on');
  });
})();
</script>

</body>
</html>
"""

PAGE = PAGE.replace('__CSS__', css).replace('__BOOK__', book).replace('__BRAND__', brand)
io.open(OUT, 'w', encoding='utf-8').write(PAGE)
print('ebook.html gravado:', len(PAGE), 'bytes')
