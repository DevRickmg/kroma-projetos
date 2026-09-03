# -*- coding: utf-8 -*-
"""Dente molar wireframe 3D (IPRO3D): coroa lofted + N raizes tubulares."""
import math

def prof(pts, t):
    if t <= pts[0][0]: return pts[0][1]
    for i in range(len(pts)-1):
        t0,v0 = pts[i]; t1,v1 = pts[i+1]
        if t0 <= t <= t1:
            u = 0 if t1==t0 else (t-t0)/(t1-t0)
            return v0+(v1-v0)*(u*u*(3-2*u))
    return pts[-1][1]

Y_NECK, CROWN_H, ROOT_L = -0.05, 1.00, 0.88
NROOT, D0, SPLAY, RR0 = 4, 0.255, 0.10, 0.215
CROWN_R = 0.60
RC = [(0,.82),(.12,.90),(.30,.97),(.50,1.0),(.68,1.0),(.82,.96),
      (.90,.88),(.96,.66),(.99,.32),(1,.10)]
SUPER_N = 2.9

def crown_pt(th, tc):
    r = prof(RC, tc)*CROWN_R
    k = (abs(math.cos(th))**SUPER_N + abs(math.sin(th))**SUPER_N)**(1/SUPER_N)
    r /= k if k > 1e-6 else 1
    if tc > 0.62:                                  # cuspides
        r *= 1 + 0.055*math.cos(4*th)*((tc-0.62)/0.38)
    return r*math.cos(th), Y_NECK+CROWN_H*tc, r*math.sin(th)

def root_pt(k, ph, s):
    thk = math.radians(45 + k*(360.0/NROOT))
    d   = D0 + SPLAY*math.sin(s*1.45)
    y   = Y_NECK + 0.05 - ROOT_L*s
    rr  = RR0*(1 - s**2.6)**0.40
    return (d*math.cos(thk) + rr*math.cos(thk+ph), y,
            d*math.sin(thk) + rr*math.sin(thk+ph))

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

def build(size=260, cr=14, cm=24, rr_=8, rm=9, seg=72, steps=34,
          phi=26, pitch=14, op_back=.16, eps=.35, prec=1, scale=.36):
    phi, pitch = math.radians(phi), math.radians(pitch)
    allp = []
    for i in range(cr+1):
        for j in range(seg):
            allp.append(project(crown_pt(2*math.pi*j/seg, i/cr), phi, pitch))
    for k in range(NROOT):
        for i in range(rr_+1):
            for j in range(seg):
                allp.append(project(root_pt(k, 2*math.pi*j/seg, i/rr_), phi, pitch))
    zmin = min(p[2] for p in allp); zmax = max(p[2] for p in allp)
    xs = [p[0] for p in allp]; ys = [p[1] for p in allp]
    x0,x1 = min(xs),max(xs); y0,y1 = min(ys),max(ys)
    span = max(x1-x0, y1-y0)
    S = size*scale/span*1.0
    cxo = size/2 - (x0+x1)/2*S; cyo = size/2 - (y0+y1)/2*S
    sc = lambda x,y: (cxo+x*S, cyo+y*S)
    op = lambda z: round(op_back+(1-op_back)*max(0.0,min(1.0,(z-zmin)/(zmax-zmin)))**1.15, 2)

    out = []
    def add_ring(fn, n):
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

    for i in range(cr+1):
        tc = i/cr
        if tc > 0.995: continue
        add_ring(lambda th, tc=tc: crown_pt(th, tc), seg)
    for m in range(cm):
        th = 2*math.pi*m/cm
        add_line(lambda u, th=th: crown_pt(th, u*0.995), steps)
    for k in range(NROOT):
        for i in range(rr_+1):
            s = i/rr_
            if s > 0.985: continue
            add_ring(lambda ph, k=k, s=s: root_pt(k, ph, s), max(18, seg//3))
        for m in range(rm):
            ph = 2*math.pi*m/rm
            add_line(lambda u, k=k, ph=ph: root_pt(k, ph, u*0.985), steps//2)

    f = "%."+str(prec)+"f"
    g = {}
    for pts, o in out:
        g.setdefault(o, []).append("M"+"L".join((f+" "+f) % q for q in rdp(pts, eps)))
    return "".join('<g stroke-opacity="%s"><path d="%s"/></g>' % (o, "".join(g[o]))
                   for o in sorted(g))
