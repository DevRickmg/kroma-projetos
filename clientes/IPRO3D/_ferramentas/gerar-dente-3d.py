# -*- coding: utf-8 -*-
"""Dente molar wireframe 3D (IPRO3D).

Uma superficie so: a coroa e' lofted do topo oclusal ate' dentro da regiao
das raizes, e a secao transversal vai se deformando de circular pra uniao
dos 3 cilindros radiculares. Dali pra baixo os tubos das raizes assumem,
afinam e fecham em ponta arredondada. Profundidade sugerida por opacidade.
"""
import math

def prof(pts, t):
    """Interpola a lista de controle (t, valor) com smoothstep."""
    if t <= pts[0][0]: return pts[0][1]
    for i in range(len(pts)-1):
        t0,v0 = pts[i]; t1,v1 = pts[i+1]
        if t0 <= t <= t1:
            u = 0 if t1==t0 else (t-t0)/(t1-t0)
            return v0+(v1-v0)*(u*u*(3-2*u))
    return pts[-1][1]

def smoothstep(a, b, x):
    u = 0.0 if b <= a else max(0.0, min(1.0, (x-a)/(b-a)))
    return u*u*(3-2*u)

# --- geometria -------------------------------------------------------------
Y_TOP, Y_NECK, Y_JOIN = 0.92, 0.0, -0.20   # topo oclusal · colo · fim da coroa
CROWN_R, ASPECT = 0.64, 0.86               # raio maximo e achatamento V-L
SUPER_N = 2.35                             # 2 = circulo, >2 = secao mais quadrada
NROOT, RTOP, ROOT_L = 3, 0.16, 0.80        # n. de raizes · topo (dentro da coroa) · comprimento
D0, SPLAY, RR0 = 0.235, 0.075, 0.335       # afastamento do eixo · abertura · raio do tubo
T_MIX, T_FULL = 0.58, 0.90                 # onde a secao comeca/termina de virar lobada
S_ROOT = 0.30                              # de onde os tubos passam a ser desenhados

# perfil circular da coroa: tc=0 no topo, tc=1 em Y_JOIN
RC = [(0,0),(.033,.44),(.075,.68),(.125,.84),(.185,.94),(.27,1.0),
      (.37,1.0),(.47,.97),(.57,.93),(.67,.885),(.77,.845),(.836,.82),(1,.80)]

def y_crown(tc):  return Y_TOP - (Y_TOP-Y_JOIN)*tc
def s_at(y):      return (Y_NECK + RTOP - y)/ROOT_L      # altura -> parametro da raiz
def _cl(s):       return max(0.0, min(1.0, s))
def root_d(s):    return D0 + SPLAY*(_cl(s)**0.85)
def root_r(s):    return RR0*(1 - _cl(s)**2.2)**0.42

def root_base(phi):
    """Angulo do 1o lobo pra que as 3 raizes projetem simetricas na vista."""
    return math.atan2(-math.cos(phi), ASPECT*math.sin(phi))

def union_r(th, s, base):
    """Raio da uniao dos NROOT circulos na altura s, na direcao th."""
    d, rr, best = root_d(s), root_r(s), 0.0
    for k in range(NROOT):
        a = th - (base + k*(2*math.pi/NROOT))
        disc = rr*rr - (d*math.sin(a))**2
        if disc > 0:
            best = max(best, d*math.cos(a) + math.sqrt(disc))
    return best if best > 1e-4 else rr

def crown_pt(th, tc, base):
    y = y_crown(tc)
    rn = prof(RC, tc)                                  # 0..1
    r = rn*CROWN_R
    k = (abs(math.cos(th))**SUPER_N + abs(math.sin(th))**SUPER_N)**(1/SUPER_N)
    r /= k if k > 1e-6 else 1
    cusp = max(0.0, 1 - tc/0.30)                       # cuspides so no terco oclusal
    r *= 1 + 0.075*math.cos(4*th)*cusp*cusp
    y += 0.045*math.cos(4*th)*cusp*cusp*cusp*rn   # some no polo, senao vira estrela
    w = smoothstep(T_MIX, T_FULL, tc)                  # circular -> lobada
    if w > 0:
        r = r*(1-w) + union_r(th, s_at(y), base)*w
    return r*math.cos(th), y, ASPECT*r*math.sin(th)

def root_pt(k, ph, s, base):
    thk = base + k*(2*math.pi/NROOT)
    d, rr = root_d(s), root_r(s)
    return (d*math.cos(thk) + rr*math.cos(ph), Y_NECK + RTOP - ROOT_L*s,
            ASPECT*(d*math.sin(thk) + rr*math.sin(ph)))

def project(p, phi, pitch):
    X, Y, Z = p
    cp, sp = math.cos(phi), math.sin(phi)
    Xr, Zr = X*cp+Z*sp, -X*sp+Z*cp
    ct, st = math.cos(pitch), math.sin(pitch)
    return Xr, -(Y*ct - Zr*st), Y*st + Zr*ct

def rdp(p, eps):
    if len(p) < 3: return p
    x0,y0 = p[0]; x1,y1 = p[-1]
    dx,dy = x1-x0, y1-y0; n = math.hypot(dx,dy)
    im, dm = 0, 0.0
    for i in range(1,len(p)-1):
        px,py = p[i]
        d = abs(dy*px-dx*py+x1*y0-y1*x0)/n if n > 1e-9 else math.hypot(px-x0,py-y0)
        if d > dm: im, dm = i, d
    return rdp(p[:im+1],eps)[:-1]+rdp(p[im:],eps) if dm > eps else [p[0],p[-1]]

def build(size=260, cr=24, cm=34, rr_=9, rm=9, seg=84, steps=46,
          phi=24, pitch=13, op_back=.30, eps=.35, prec=1, scale=.42):
    """cr/cm: aneis e meridianos da coroa · rr_/rm: idem por raiz."""
    phi, pitch = math.radians(phi), math.radians(pitch)
    base = root_base(phi)
    allp = []
    for i in range(cr+1):
        for j in range(seg):
            allp.append(project(crown_pt(2*math.pi*j/seg, i/cr, base), phi, pitch))
    for k in range(NROOT):
        for i in range(rr_+1):
            s = S_ROOT + (1-S_ROOT)*i/rr_
            for j in range(seg):
                allp.append(project(root_pt(k, 2*math.pi*j/seg, s, base), phi, pitch))
    zmin = min(p[2] for p in allp); zmax = max(p[2] for p in allp)
    xs = [p[0] for p in allp]; ys = [p[1] for p in allp]
    x0,x1 = min(xs),max(xs); y0,y1 = min(ys),max(ys)
    span = max(x1-x0, y1-y0)
    S = size*scale/span
    cxo = size/2 - (x0+x1)/2*S; cyo = size/2 - (y0+y1)/2*S
    sc = lambda x,y: (cxo+x*S, cyo+y*S)
    op = lambda z: round(op_back+(1-op_back)*max(0.0,min(1.0,(z-zmin)/(zmax-zmin)))**1.05, 2)

    out = []
    def add_ring(fn, n):
        """Anel fechado, quebrado onde cruza do lado de tras pro da frente."""
        pts = [project(fn(2*math.pi*j/n), phi, pitch) for j in range(n+1)]
        run, rf = [], None
        for x,y,z in pts:
            f = z >= 0
            if rf is None: rf = f
            if f != rf and len(run) > 1:
                out.append((run[:], op(.88*zmax if rf else .88*zmin)))
                run = [run[-1]]; rf = f
            run.append(sc(x,y))
        if len(run) > 1: out.append((run, op(.88*zmax if rf else .88*zmin)))
    def add_line(fn, n):
        pts, zt = [], 0.0
        for k2 in range(n+1):
            x,y,z = project(fn(k2/n), phi, pitch); pts.append(sc(x,y)); zt += z
        out.append((pts, op(zt/(n+1))))

    for i in range(cr+1):                                   # aneis da coroa
        tc = i/cr
        if tc < 0.004: continue
        add_ring(lambda th, tc=tc: crown_pt(th, tc, base), seg)
    for m in range(cm):                                     # meridianos da coroa
        th = 2*math.pi*m/cm
        add_line(lambda u, th=th: crown_pt(th, u, base), steps)
    for k in range(NROOT):
        for i in range(rr_+1):                              # aneis da raiz
            s = S_ROOT + (1-S_ROOT)*i/rr_
            if s > 0.985: continue
            add_ring(lambda ph, k=k, s=s: root_pt(k, ph, s, base), max(20, seg//2))
        for m in range(rm):                                 # meridianos da raiz
            ph = 2*math.pi*m/rm
            add_line(lambda u, k=k, ph=ph: root_pt(
                k, ph, S_ROOT + (0.985-S_ROOT)*u, base), max(8, steps//2))

    f = "%."+str(prec)+"f"
    g = {}
    for pts, o in out:
        g.setdefault(o, []).append("M"+"L".join((f+" "+f) % q for q in rdp(pts, eps)))
    return "".join('<g stroke-opacity="%s"><path d="%s"/></g>' % (o, "".join(g[o]))
                   for o in sorted(g))
