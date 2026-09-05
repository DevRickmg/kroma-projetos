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

def crown_pt(th, tc, tuck=0.22):
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
    # cima da superficie dos tubos, a borda aberta aparecia como um anel.
    # So faz sentido no solido sombreado — na silhueta (tuck=0) esse recuo
    # abriria um degrau no colo, que vira farpa no contorno.
    r *= 1 - tuck*smoothstep(0.94, 1.0, tc)
    return (r*math.cos(th), y, ASPECT*r*math.sin(th))

def root_pt(k, ph, s):
    thk = BASE + k*(2*math.pi/NROOT)
    d, rr = root_d(s), root_r(s)
    return (d*math.cos(thk) + rr*math.cos(ph),
            Y_NECK + RTOP - ROOT_L*s,
            ASPECT*(d*math.sin(thk) + rr*math.sin(ph)))


# --- malha -----------------------------------------------------------------
def mesh(cr=26, seg=56, rr_=12, segr=26, tuck=0.22):
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

    grid(lambda i,j: crown_pt(2*math.pi*j/seg, i/cr, tuck), cr, seg,
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


# --- silhueta limpa --------------------------------------------------------
# `build_flat` cospe uma face por quad: fecha o bloco, mas sao milhares de
# subcaminhos e cada costura aparece como linha. Aqui a gente rasteriza a
# malha projetada, pega o contorno da mancha e devolve UM caminho suave —
# a mesma pose, sem linha nenhuma, do tamanho de um icone.

def _raster(P, F, N, ss):
    """Mancha da malha projetada num grid N*ss, devolvida como cobertura NxN."""
    M = N*ss
    g = bytearray(M*M)
    for f in F:
        q = [P[i] for i in f]
        ymin = max(0, int(min(p[1] for p in q)))
        ymax = min(M-1, int(max(p[1] for p in q)) + 1)
        for y in range(ymin, ymax+1):
            yc, xs, n = y + .5, [], len(q)
            for k in range(n):
                x1, y1 = q[k][0], q[k][1]
                x2, y2 = q[(k+1) % n][0], q[(k+1) % n][1]
                if (y1 <= yc < y2) or (y2 <= yc < y1):
                    xs.append(x1 + (yc-y1)*(x2-x1)/(y2-y1))
            if len(xs) < 2: continue
            xs.sort()
            row = y*M
            for k in range(0, len(xs)-1, 2):
                a = max(0, int(xs[k] - .5) + 1)
                b = min(M-1, int(xs[k+1] - .5))
                if b >= a: g[row+a:row+b+1] = b'\x01' * (b-a+1)
    # media dos ss x ss subpixels -> cobertura 0..1, o que suaviza o contorno
    inv = 1.0/(ss*ss)
    cov = [[0.0]*N for _ in range(N)]
    for j in range(N):
        rows = [g[(j*ss+dy)*M:(j*ss+dy+1)*M] for dy in range(ss)]
        cj = cov[j]
        for i in range(N):
            x0 = i*ss
            cj[i] = sum(sum(r[x0:x0+ss]) for r in rows)*inv
    return cov


def _contours(cov, N, iso=.5):
    """Marching squares com interpolacao: devolve os anéis fechados."""
    def ip(xa, ya, va, xb, yb, vb):
        t = 0.5 if abs(vb-va) < 1e-9 else (iso-va)/(vb-va)
        return (xa + (xb-xa)*t, ya + (yb-ya)*t)

    segs = []
    for j in range(N-1):
        for i in range(N-1):
            v0, v1 = cov[j][i], cov[j][i+1]
            v2, v3 = cov[j+1][i+1], cov[j+1][i]
            c = (1 if v0 > iso else 0) | (2 if v1 > iso else 0) \
                | (4 if v2 > iso else 0) | (8 if v3 > iso else 0)
            if c == 0 or c == 15: continue
            T = ip(i, j, v0, i+1, j, v1)          # aresta de cima
            R = ip(i+1, j, v1, i+1, j+1, v2)      # direita
            B = ip(i+1, j+1, v2, i, j+1, v3)      # baixo
            L = ip(i, j+1, v3, i, j, v0)          # esquerda
            # winding: o interior (>iso) fica sempre a esquerda do segmento
            if   c in (1, 14):  segs.append((L, T) if c == 1 else (T, L))
            elif c in (2, 13):  segs.append((T, R) if c == 2 else (R, T))
            elif c in (4, 11):  segs.append((R, B) if c == 4 else (B, R))
            elif c in (8, 7):   segs.append((B, L) if c == 8 else (L, B))
            elif c == 3:        segs.append((L, R))
            elif c == 12:       segs.append((R, L))
            elif c == 6:        segs.append((T, B))
            elif c == 9:        segs.append((B, T))
            elif c == 5:        segs.append((L, T)); segs.append((R, B))
            elif c == 10:       segs.append((T, R)); segs.append((B, L))

    key = lambda p: (round(p[0], 6), round(p[1], 6))
    nxt = {}
    for a, b in segs: nxt.setdefault(key(a), []).append((a, b))
    loops, used = [], set()
    for a0, b0 in segs:
        if id((a0, b0)) in used: continue
        cur, loop, guard = (a0, b0), [a0], 0
        while guard < len(segs) + 5:
            guard += 1
            if id(cur) in used: break
            used.add(id(cur))
            loop.append(cur[1])
            cand = nxt.get(key(cur[1]))
            if not cand: break
            nx = None
            for s in cand:
                if id(s) not in used: nx = s; break
            if nx is None: break
            if key(nx[1]) == key(loop[0]) and len(loop) > 3:
                used.add(id(nx)); break
            cur = nx
        if len(loop) > 8: loops.append(loop)
    return loops


def _area(pts):
    a = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]; x2, y2 = pts[(i+1) % len(pts)]
        a += x1*y2 - x2*y1
    return a/2.0


def _smooth(pts, passes, w=.5):
    """Laplaciano no anel fechado: tira o serrilhado do marching squares."""
    for _ in range(passes):
        n = len(pts)
        pts = [((1-w)*pts[i][0] + w*(pts[i-1][0] + pts[(i+1) % n][0])/2,
                (1-w)*pts[i][1] + w*(pts[i-1][1] + pts[(i+1) % n][1])/2)
               for i in range(n)]
    return pts


def _rdp(pts, eps):
    """Douglas-Peucker: joga fora ponto que a reta ja explica."""
    if len(pts) < 3: return pts
    x0, y0 = pts[0]; x1, y1 = pts[-1]
    dx, dy = x1-x0, y1-y0
    L = math.hypot(dx, dy)
    imax, dmax = 0, -1.0
    for i in range(1, len(pts)-1):
        px, py = pts[i]
        d = (abs(dy*px - dx*py + x1*y0 - y1*x0)/L if L > 1e-12
             else math.hypot(px-x0, py-y0))
        if d > dmax: imax, dmax = i, d
    if dmax <= eps: return [pts[0], pts[-1]]
    return _rdp(pts[:imax+1], eps)[:-1] + _rdp(pts[imax:], eps)


def _bezier(pts, f, t=1/6.):
    """Catmull-Rom -> cubicas: o contorno sai curvo, nao poligonal."""
    n = len(pts)
    d = ["M" + (f+" "+f) % pts[0]]
    for i in range(n):
        p0, p1 = pts[i-1], pts[i]
        p2, p3 = pts[(i+1) % n], pts[(i+2) % n]
        c1 = (p1[0] + (p2[0]-p0[0])*t, p1[1] + (p2[1]-p0[1])*t)
        c2 = (p2[0] - (p3[0]-p1[0])*t, p2[1] - (p3[1]-p1[1])*t)
        d.append(("C" + (f+" "+f+" "+f+" "+f+" "+f+" "+f))
                 % (c1[0], c1[1], c2[0], c2[1], p2[0], p2[1]))
    return "".join(d) + "Z"


def build_outline(size=40, phi=26, pitch=13, scale=.94, grid=180, ss=4,
                  smooth=3, eps=.35, prec=2, mesh_args=None):
    """Silhueta do dente 3D como UM caminho fechado e liso.

    Mesma pose do modelo do hero, so que chapada: da pra pintar de uma cor
    (ou com gradiente) e funciona bem de 24px pra cima.
    """
    V, F = mesh(**(mesh_args or dict(cr=34, seg=88, rr_=18, segr=36, tuck=0.0)))
    ph, pt = math.radians(phi), math.radians(pitch)
    P = [project(v, ph, pt) for v in V]

    xs = [p[0] for p in P]; ys = [p[1] for p in P]
    x0, x1 = min(xs), max(xs); y0, y1 = min(ys), max(ys)
    S = grid*scale/max(x1-x0, y1-y0)
    ox = grid/2. - (x0+x1)/2*S; oy = grid/2. - (y0+y1)/2*S
    Pg = [((ox + p[0]*S)*ss, (oy + p[1]*S)*ss) for p in P]

    loops = _contours(_raster(Pg, F, grid, ss), grid)
    if not loops: raise RuntimeError('silhueta vazia')
    loops.sort(key=lambda L: abs(_area(L)), reverse=True)
    outer = loops[0]
    if _area(outer) < 0: outer = outer[::-1]     # sentido horario, fill nonzero

    outer = _rdp(_smooth(outer, smooth), eps)
    if len(outer) > 2 and outer[0] == outer[-1]: outer = outer[:-1]

    k = size/float(grid)
    outer = [(x*k, y*k) for x, y in outer]
    return '<path d="%s"/>' % _bezier(outer, "%."+str(prec)+"f")
