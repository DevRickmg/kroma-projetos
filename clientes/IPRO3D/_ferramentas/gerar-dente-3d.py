# -*- coding: utf-8 -*-
"""Dente molar 3D (IPRO3D) — solido, formato tradicional.

Coroa com mesa oclusal e 4 cuspides, colo, e 4 raizes que nascem fundidas
e descem afinando ate a ponta. E uma superficie so: a secao transversal da
coroa vai virando a uniao dos 4 cilindros radiculares e dali pra baixo os
tubos assumem.

`build_flat()` devolve a silhueta chapada em SVG (uma cor) — e o que vai
nos logos e no fallback sem JS. A versao com sombreamento de verdade e a
do `<canvas>` no hero do site (o mesmo perfil, portado pro JS).
"""
import math

# --- perfil ----------------------------------------------------------------
Y_TOP, Y_NECK, Y_JOIN = 0.62, 0.0, -0.12   # topo oclusal · colo · fim da coroa
CROWN_R, ASPECT = 0.445, 0.88               # raio maximo e achatamento V-L
SUPER_N = 2.05                             # 2 = circulo, >2 = secao mais quadrada
CUSP_A, CUSP_T = 0.030, 0.34               # altura e alcance das cuspides
NROOT, RTOP, ROOT_L = 4, 0.10, 0.62        # n. de raizes · topo (dentro da coroa) · comprimento
D0, SPLAY, RR0 = 0.087, 0.146, 0.178       # afastamento do eixo · abertura · raio do tubo
T_MIX, T_FULL = 0.80, 1.00                 # onde a secao comeca/termina de virar lobada
BASE = math.radians(22.5)                  # gira o conjunto de raizes na pose parada

# coroa: tc=0 no centro da mesa oclusal, tc=1 em Y_JOIN
RC = [(0,0),(.03,.36),(.07,.60),(.12,.78),(.18,.89),(.25,.955),(.34,.99),
      (.43,1.0),(.53,.99),(.63,.96),(.72,.915),(.80,.86),(.87,.79),(.93,.715),
      (.97,.677),(1,.66)]   # o fim quase reto encosta no tronco sem degrau


def _prof_raw(pts, t):
    """Catmull-Rom pela lista de controle (t, valor).

    Nao usar smoothstep entre pontos: ela chega com derivada zero em cada
    ponto de controle, o que deixa um anel achatado ali — e no solido
    sombreado isso vira onda visivel.
    """
    n = len(pts)
    if t <= pts[0][0]:  return pts[0][1]
    if t >= pts[-1][0]: return pts[-1][1]
    for i in range(n-1):
        t0,v0 = pts[i]; t1,v1 = pts[i+1]
        if t0 <= t <= t1:
            h = t1-t0
            if h <= 0: return v1
            u  = (t-t0)/h
            tm,vm = pts[i-1] if i > 0     else pts[i]        # ponta: um lado so
            tp,vp = pts[i+2] if i+2 < n   else pts[i+1]
            m0 = (v1-vm)/(t1-tm) if t1 != tm else 0.0
            m1 = (vp-v0)/(tp-t0) if tp != t0 else 0.0
            u2, u3 = u*u, u*u*u
            return ((2*u3-3*u2+1)*v0 + (u3-2*u2+u)*h*m0 +
                    (-2*u3+3*u2)*v1 + (u3-u2)*h*m1)
    return pts[-1][1]

NT, SM_R, SM_P = 512, 5, 2          # tabela · raio da media movel · passadas

def _build_table(pts):
    a = [_prof_raw(pts, i/(NT-1.0)) for i in range(NT)]
    for _ in range(SM_P):
        b = a[:]
        for i in range(1, NT-1):
            lo, hi = max(0, i-SM_R), min(NT-1, i+SM_R)
            b[i] = sum(a[lo:hi+1])/(hi-lo+1)
        a = b                        # pontas travadas: polo e colo nao andam
    return a

_TBL = None

def prof(pts, t):
    """Perfil da coroa, ja suavizado (a lista `pts` e sempre RC)."""
    global _TBL
    if _TBL is None: _TBL = _build_table(RC)
    x = min(1.0, max(0.0, t))*(NT-1)
    i = int(x)
    if i >= NT-1: return _TBL[NT-1]
    return _TBL[i] + (_TBL[i+1]-_TBL[i])*(x-i)

def smoothstep(a, b, x):
    u = 0.0 if b <= a else max(0.0, min(1.0, (x-a)/(b-a)))
    return u*u*(3-2*u)

def _cl(s):    return max(0.0, min(1.0, s))
def root_d(s): return D0 + SPLAY*(_cl(s)**0.90)
def root_r(s): return RR0*(1 - _cl(s)**1.6)**0.58      # afina ate a pontinha
def s_at(y):   return (Y_NECK + RTOP - y)/ROOT_L
def y_crown(tc): return Y_TOP - (Y_TOP-Y_JOIN)*tc

def union_r(th, s):
    """Raio da uniao dos NROOT circulos na altura s, na direcao th."""
    d, rr, best = root_d(s), root_r(s), 0.0
    for k in range(NROOT):
        a = th - (BASE + k*(2*math.pi/NROOT))
        disc = rr*rr - (d*math.sin(a))**2
        if disc > 0:
            best = max(best, d*math.cos(a) + math.sqrt(disc))
    return best if best > 1e-4 else rr

def crown_pt(th, tc):
    y  = y_crown(tc)
    rn = prof(RC, tc)
    r  = rn*CROWN_R
    k  = (abs(math.cos(th))**SUPER_N + abs(math.sin(th))**SUPER_N)**(1/SUPER_N)
    r /= k if k > 1e-6 else 1
    # cuspides: sobem no anel da mesa oclusal e somem indo pro centro e pro colo
    bump = math.sin(math.pi*min(1.0, tc/CUSP_T))**1.4 if tc < CUSP_T else 0.0
    y += CUSP_A*math.cos(NROOT*(th-BASE))*bump
    w = smoothstep(T_MIX, T_FULL, tc)
    if w > 0:
        r = r*(1-w) + union_r(th, s_at(y))*w
    # a ultima volta some pra dentro do bloco das raizes: se ela parasse em
    # cima da superficie dos tubos, a borda aberta aparecia como um anel
    r *= 1 - 0.22*smoothstep(0.94, 1.0, tc)
    return (r*math.cos(th), y, ASPECT*r*math.sin(th))

def root_pt(k, ph, s):
    thk = BASE + k*(2*math.pi/NROOT)
    d, rr = root_d(s), root_r(s)
    return (d*math.cos(thk) + rr*math.cos(ph),
            Y_NECK + RTOP - ROOT_L*s,
            ASPECT*(d*math.sin(thk) + rr*math.sin(ph)))


# --- malha -----------------------------------------------------------------
def mesh(cr=26, seg=56, rr_=12, segr=26):
    """Vertices + quads, com winding pra fora (normal aponta pra fora)."""
    V, F = [], []
    S_JOIN = s_at(Y_JOIN)

    def grid(pt, nu, nv, axis):
        """nu aneis x nv voltas; `axis` da o ponto do eixo pra orientar a face."""
        base = len(V)
        for i in range(nu+1):
            for j in range(nv):
                V.append(pt(i, j))
        for i in range(nu):
            for j in range(nv):
                j2 = (j+1) % nv
                a = base + i*nv + j;      b = base + i*nv + j2
                c = base + (i+1)*nv + j2; d = base + (i+1)*nv + j
                # normal do quad x vetor que sai do eixo: garante winding pra fora
                pa,pb,pc,pd = V[a],V[b],V[c],V[d]
                ux = (pc[0]-pa[0], pc[1]-pa[1], pc[2]-pa[2])
                vx = (pd[0]-pb[0], pd[1]-pb[1], pd[2]-pb[2])
                n = (ux[1]*vx[2]-ux[2]*vx[1],
                     ux[2]*vx[0]-ux[0]*vx[2],
                     ux[0]*vx[1]-ux[1]*vx[0])
                cen = [(pa[t]+pb[t]+pc[t]+pd[t])/4.0 for t in range(3)]
                ax  = axis(cen)
                out = (cen[0]-ax[0], cen[1]-ax[1], cen[2]-ax[2])
                F.append((a,b,c,d) if n[0]*out[0]+n[1]*out[1]+n[2]*out[2] >= 0
                         else (a,d,c,b))

    grid(lambda i,j: crown_pt(2*math.pi*j/seg, i/cr), cr, seg,
         lambda c: (0.0, c[1], 0.0))
    for k in range(NROOT):
        thk = BASE + k*(2*math.pi/NROOT)
        grid(lambda i,j,k=k: root_pt(k, 2*math.pi*j/segr,
                                     S_JOIN + (1-S_JOIN)*i/rr_), rr_, segr,
             lambda c,thk=thk: (root_d(s_at(c[1]))*math.cos(thk), c[1],
                                ASPECT*root_d(s_at(c[1]))*math.sin(thk)))
    return V, F


def project(p, phi, pitch):
    X, Y, Z = p
    cp, sp = math.cos(phi), math.sin(phi)
    Xr, Zr = X*cp+Z*sp, -X*sp+Z*cp
    ct, st = math.cos(pitch), math.sin(pitch)
    return Xr, -(Y*ct - Zr*st), Y*st + Zr*ct


def build_flat(size=260, cr=26, seg=56, rr_=12, segr=26,
               phi=26, pitch=14, prec=1, scale=.88):
    """Silhueta chapada: so as faces da frente, todas na mesma cor.

    A uniao delas fecha o contorno do dente, entao sai um bloco solido —
    sem linha nenhuma. Vira um `<path>` unico com varios subcaminhos.
    """
    V, F = mesh(cr, seg, rr_, segr)
    ph, pt = math.radians(phi), math.radians(pitch)
    P = [project(v, ph, pt) for v in V]

    xs = [p[0] for p in P]; ys = [p[1] for p in P]
    x0,x1 = min(xs),max(xs); y0,y1 = min(ys),max(ys)
    S = size*scale/max(x1-x0, y1-y0)
    cxo = size/2 - (x0+x1)/2*S; cyo = size/2 - (y0+y1)/2*S
    f = "%."+str(prec)+"f"

    out = []
    for a,b,c,d in F:
        pa,pb,pc,pd = P[a],P[b],P[c],P[d]
        # descarta as faces de tras (normal na direcao contraria a camera)
        nz = ((pc[0]-pa[0])*(pd[1]-pb[1]) - (pc[1]-pa[1])*(pd[0]-pb[0]))
        if nz >= 0: continue
        out.append("M" + "L".join((f+" "+f) % (cxo+q[0]*S, cyo+q[1]*S)
                                  for q in (pa,pb,pc,pd)) + "Z")
    return '<path d="%s"/>' % "".join(out)
