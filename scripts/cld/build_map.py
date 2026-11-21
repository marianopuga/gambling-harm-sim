#!/usr/bin/env python3
"""Builds the group's causal loop diagram (static SVG + small loop-highlight script).

Usage: python3 -I scripts/cld/build_map.py <page.html> [--ts src/ui/cldDiagram.ts]
The HTML is the standalone diagram page; --ts also writes the module the simulation's loops tab uses.
"""
import html
import math
import sys

OUT = sys.argv[1]
NH = 48  # node height

# id: (cx, cy, width, label lines, zone)
NODES = {
    'E': (95, 185, 114, ['Exposure to', 'gambling'], 'mk'),
    'SA': (230, 95, 110, ['Social', 'acceptance'], 'mk'),
    'M': (385, 108, 104, ['Marketing', 'exposure'], 'mk'),
    'OR': (475, 190, 96, ['Operator', 'revenue'], 'mk'),
    'A': (100, 270, 128, ['Gambling', 'accessibility'], 'mk'),
    'P': (280, 270, 128, ['Gambling', 'participation'], 'mk'),
    'GE': (450, 270, 114, ['Gambling', 'expenditure'], 'mk'),
    'GI': (665, 175, 100, ['Gambling', 'intensity'], 'hm'),
    'L': (815, 75, 96, ['Gambling', 'losses'], 'hm'),
    'FS': (960, 75, 100, ['Financial', 'stress'], 'hm'),
    'C': (1105, 175, 114, ['Gambling as', 'coping'], 'hm'),
    'H': (665, 270, 120, ['Gambling-', 'related harm'], 'hm'),
    'ED': (815, 270, 100, ['Emotional', 'distress'], 'hm'),
    'FC': (960, 270, 96, ['Family', 'conflict'], 'hm'),
    'SI': (1105, 270, 100, ['Social', 'isolation'], 'hm'),
    'RS': (100, 580, 104, ['Regulatory', 'strength'], 'gv'),
    'T': (450, 580, 120, ['Gambling tax', 'revenue'], 'gv'),
    'GS': (610, 580, 110, ['Government', 'spend'], 'gv'),
    'AW': (760, 580, 100, ['Awareness', 'of harm'], 'gv'),
    'HS': (910, 580, 116, ['Help-seeking'], 'gv'),
    'PP': (760, 695, 140, ['Public pressure', 'to reform'], 'gv'),
    'TC': (1000, 695, 176, ['Treatment &', 'counselling capacity'], 'gv'),
}
STOCK = (595, 400, 220, 80)  # cx, cy, w, h

# (from, to, sign, loops, options)
LINKS = [
    ('E', 'P', '+', 'R1 B1', {}),
    ('P', 'SA', '+', 'R1', {'delay': True}),
    ('SA', 'E', '+', 'R1 B1', {}),
    ('P', 'GE', '+', 'R2', {}),
    ('GE', 'OR', '+', 'R2', {}),
    ('OR', 'M', '+', 'R2', {}),
    ('M', 'P', '+', 'R2', {}),
    ('A', 'P', '+', 'B1', {}),
    ('P', 'IN', '+', 'B1 R2', {'end': (280, 385)}),
    ('RS', 'A', '-', 'B1', {}),
    ('GI', 'L', '+', 'R3', {}),
    ('L', 'FS', '+', 'R3', {}),
    ('FS', 'C', '+', 'R3', {}),
    ('C', 'GI', '+', 'R3 R4', {}),
    ('GI', 'H', '+', 'R4', {}),
    ('H', 'ED', '+', 'R4', {}),
    ('ED', 'FC', '+', 'R4', {}),
    ('FC', 'SI', '+', 'R4', {'delay': True}),
    ('SI', 'C', '+', 'R4', {}),
    ('ST', 'H', '+', 'B1 B2', {}),
    ('ST', 'GE', '+', 'R2 B2', {}),
    ('SI', 'OUT', '-', '', {'end': (958, 385)}),
    ('H', 'AW', '+', 'B1 B2', {'path': [('M', 713, 297), ('C', 742, 304, 760, 314, 760, 342), ('L', 760, 552)], 'delayAt': (760, 470)}),
    ('GE', 'T', '+', 'B2', {}),
    ('AW', 'PP', '+', 'B1 B2', {}),
    ('PP', 'RS', '+', 'B1', {'path': [('M', 702, 722), ('C', 696, 736, 686, 742, 668, 742), ('L', 132, 742),
                                      ('C', 110, 742, 100, 732, 100, 607)], 'delayAt': (400, 742)}),
    ('AW', 'HS', '+', 'B2', {}),
    ('HS', 'OUT', '+', 'B2', {'start': (915, 553), 'end': (915, 461)}),
    ('PP', 'TC', '+', 'B2', {'delay': True}),
    ('T', 'GS', '+', 'B2', {}),
    ('GS', 'TC', '+', 'B2', {'path': [('M', 610, 607), ('C', 610, 618, 616, 626, 628, 626), ('L', 895, 626),
                                      ('C', 924, 626, 935, 642, 938, 668)], 'delayAt': (700, 626)}),
    ('TC', 'OUT', '+', 'B2', {'start': (1000, 668), 'end': (1000, 461)}),
    # public pressure lowers social acceptance: runs around the outside of the left edge, crossing nothing
    ('PP', 'SA', '-', 'B1', {'path': [('M', 730, 722), ('L', 730, 759), ('C', 730, 770, 723, 777, 712, 777),
                                      ('L', 22, 777), ('C', 11, 777, 4, 770, 4, 759), ('L', 4, 113),
                                      ('C', 4, 102, 11, 95, 22, 95), ('L', 171, 95)], 'delayAt': (4, 420)}),
    # treatment lowers harm: up the outside of the right edge, across the top, down the gap between the zones
    ('TC', 'H', '-', 'B2', {'path': [('M', 1091, 695), ('L', 1178, 695), ('C', 1190, 695, 1196, 689, 1196, 677),
                                     ('L', 1196, 22), ('C', 1196, 10, 1190, 4, 1178, 4), ('L', 578, 4),
                                     ('C', 566, 4, 560, 10, 560, 22), ('L', 560, 258),
                                     ('C', 560, 266, 564, 270, 572, 270), ('L', 602, 270)]}),
]

# id, cx, cy, clockwise, name, explanation
LOOPS = [
    ('R1', 195, 192, False, 'Normalization',
     'More people gambling makes gambling feel normal. That raises exposure, which brings more people in.'),
    ('R2', 385, 205, False, 'Marketing',
     'More spending, much of it by people already at risk, means more operator revenue. That pays for more marketing, which draws more people in.'),
    ('R3', 888, 130, True, 'Chasing losses',
     'Gambling harder brings bigger losses and financial stress. Gambling to cope makes people gamble harder still.'),
    ('R4', 888, 222, False, 'Distress and isolation',
     'Harm causes distress, family conflict and isolation. Isolated people gamble to cope, which deepens the harm.'),
    ('B1', 595, 482, True, 'Harm visibility',
     'More people at risk means more visible harm. Awareness builds pressure to reform: regulation gets stronger and cuts access, social acceptance falls, and fewer people enter risk.'),
    ('B2', 836, 490, False, 'Help and treatment',
     'More harm raises awareness, and spending by people at risk raises tax revenue and government spending on services. Help-seeking and treatment capacity grow, so more people exit risk and treatment reduces harm.'),
]

ZONES = [
    ('mk', 20, 20, 530, 295, 'MARKET &amp; SOCIAL NORMS', 40, 46),
    ('hm', 570, 20, 610, 295, 'INDIVIDUAL HARM', 590, 46),
    ('gv', 20, 510, 1160, 255, 'GOVERNMENT &amp; PUBLIC RESPONSE', 122, 536),
]

esc = html.escape


def box_of(nid):
    if nid == 'ST':
        cx, cy, w, h = STOCK
        return cx, cy, w / 2, h / 2
    cx, cy, w, _, _ = NODES[nid]
    return cx, cy, w / 2, NH / 2


def clip(nid, toward, gap):
    cx, cy, hw, hh = box_of(nid)
    dx, dy = toward[0] - cx, toward[1] - cy
    sx = hw / abs(dx) if dx else math.inf
    sy = hh / abs(dy) if dy else math.inf
    s = min(sx, sy)
    ln = math.hypot(dx, dy)
    return (cx + dx * s + dx / ln * gap, cy + dy * s + dy / ln * gap)


def segments(frm, to, opts):
    if 'path' in opts:
        return opts['path']
    a, b = opts.get('start'), opts.get('end')
    src_c = box_of(frm)[:2]
    if b is None:
        b = clip(to, a or src_c, 3)
    if a is None:
        a = clip(frm, b if 'end' in opts else box_of(to)[:2], 3)
    return [('M', *a), ('L', *b)]


def sample(segs, n=120):
    pts, cur = [], None
    for s in segs:
        if s[0] == 'M':
            cur = (s[1], s[2])
            pts.append(cur)
        elif s[0] == 'L':
            p = (s[1], s[2])
            for i in range(1, n + 1):
                t = i / n
                pts.append((cur[0] + (p[0] - cur[0]) * t, cur[1] + (p[1] - cur[1]) * t))
            cur = p
        else:
            x1, y1, x2, y2, x, y = s[1:]
            for i in range(1, n + 1):
                t = i / n
                m = 1 - t
                pts.append((m ** 3 * cur[0] + 3 * m * m * t * x1 + 3 * m * t * t * x2 + t ** 3 * x,
                            m ** 3 * cur[1] + 3 * m * m * t * y1 + 3 * m * t * t * y2 + t ** 3 * y))
            cur = (x, y)
    return pts


def length(pts):
    return sum(math.dist(pts[i - 1], pts[i]) for i in range(1, len(pts)))


def point_at(pts, dist):
    acc = 0.0
    for i in range(1, len(pts)):
        d = math.dist(pts[i - 1], pts[i])
        if acc + d >= dist:
            t = (dist - acc) / d if d else 0
            a, b = pts[i - 1], pts[i]
            return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
        acc += d
    return pts[-1]


def point_tangent(pts, dist):
    """Point at a distance along the path and the unit tangent there."""
    acc = 0.0
    for i in range(1, len(pts)):
        d = math.dist(pts[i - 1], pts[i])
        if acc + d >= dist and d > 0:
            a, b = pts[i - 1], pts[i]
            t = (dist - acc) / d
            return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), ((b[0] - a[0]) / d, (b[1] - a[1]) / d)
        acc += d
    a, b = pts[-2], pts[-1]
    d = math.dist(a, b) or 1
    return b, ((b[0] - a[0]) / d, (b[1] - a[1]) / d)


def d_of(segs):
    return ' '.join(s[0] + ' ' + ' '.join(f'{v:.1f}' for v in s[1:]) for s in segs)


# ---------------------------------------------------------------- build pieces
node_loops = {k: set() for k in NODES}
for frm, to, _, loops, _ in LINKS:
    for n in (frm, to):
        if n in node_loops and loops:
            node_loops[n].update(loops.split())

BADGE_R = 7.5
link_svg, badges, warnings, delays = [], [], [], []
geo = []
for frm, to, sign, loops, opts in LINKS:
    segs = segments(frm, to, opts)
    pts = sample(segs)
    ln = length(pts)
    has_delay = 'delay' in opts or 'delayAt' in opts
    bdist = ln - 17 if (has_delay and ln < 70) else (ln - 20 if ln > 46 else ln / 2)
    bx, by = point_at(pts, bdist)
    badges.append((bx, by, f'{frm}->{to}'))
    geo.append((frm, to, pts))
    pol = 'pos' if sign == '+' else 'neg'
    glyph = '+' if sign == '+' else '−'
    # delay mark: two short strokes across the arrow where the effect takes months or years
    delay_svg = ''
    if has_delay:
        if 'delayAt' in opts:
            k = min(range(len(pts)), key=lambda j: math.dist(pts[j], opts['delayAt']))
            ddist = length(pts[:k + 1])
        else:
            ddist = 0.45 * ln if ln >= 70 else 6
        (qx, qy), (tx, ty) = point_tangent(pts, ddist)
        nx, ny = -ty, tx
        for off in (-2.4, 2.4):
            cx_, cy_ = qx + tx * off, qy + ty * off
            delay_svg += (f'<line class="dl" x1="{cx_ - 6.5 * nx:.1f}" y1="{cy_ - 6.5 * ny:.1f}" '
                          f'x2="{cx_ + 6.5 * nx:.1f}" y2="{cy_ + 6.5 * ny:.1f}"/>')
        delays.append((qx, qy, f'{frm}->{to}'))
    link_svg.append(
        f'<g class="lk {pol}" data-loops="{loops}">'
        f'<path class="ln" d="{d_of(segs)}" marker-end="url(#ah-{pol})"/>{delay_svg}'
        f'<g class="bd"><circle cx="{bx:.1f}" cy="{by:.1f}" r="{BADGE_R}"/>'
        f'<text x="{bx:.1f}" y="{by + 0.5:.1f}">{glyph}</text></g></g>')

node_svg = []
for nid, (cx, cy, w, lines, zone) in NODES.items():
    x, y = cx - w / 2, cy - NH / 2
    if len(lines) == 1:
        txt = f'<text class="nt" x="{cx}" y="{cy}">{esc(lines[0])}</text>'
    else:
        txt = (f'<text class="nt" x="{cx}" y="{cy - 8.5}">{esc(lines[0])}</text>'
               f'<text class="nt" x="{cx}" y="{cy + 8.5}">{esc(lines[1])}</text>')
    node_svg.append(f'<g class="nd {zone}" data-loops="{" ".join(sorted(node_loops[nid]))}">'
                    f'<rect x="{x:.0f}" y="{y:.0f}" width="{w}" height="{NH}" rx="9"/>{txt}</g>')

loop_svg = []
for lid, cx, cy, cw, name, _ in LOOPS:
    r = 15
    if cw:
        d = f'M {cx + .5 * r:.1f} {cy - .866 * r:.1f} A {r} {r} 0 1 1 {cx - .5 * r:.1f} {cy - .866 * r:.1f}'
    else:
        d = f'M {cx - .5 * r:.1f} {cy - .866 * r:.1f} A {r} {r} 0 1 0 {cx + .5 * r:.1f} {cy - .866 * r:.1f}'
    kind = 'reinforcing' if lid[0] == 'R' else 'balancing'
    loop_svg.append(
        f'<g class="lp" data-loops="{lid}" tabindex="0" role="button" aria-label="Trace loop {lid}, {name} ({kind})">'
        f'<circle class="hit" cx="{cx}" cy="{cy}" r="21"/>'
        f'<path d="{d}" marker-end="url(#ah-lp)"/><text x="{cx}" y="{cy + .5}">{lid}</text></g>')


def cloud(cx, cy, mirror=False):
    parts = [(-11, 4, 11), (2, -6, 13), (15, 4, 10)]
    if mirror:
        parts = [(-dx, dy, r) for dx, dy, r in parts]
    o = ''.join(f'<circle class="cloud-o" cx="{cx + dx}" cy="{cy + dy}" r="{r + 1.4}"/>' for dx, dy, r in parts)
    i = ''.join(f'<circle class="cloud-i" cx="{cx + dx}" cy="{cy + dy}" r="{r}"/>' for dx, dy, r in parts)
    return f'<g class="cloud">{o}{i}</g>'


def valve(cx, cy):
    return (f'<path class="valve" d="M {cx - 12} {cy - 13} L {cx} {cy} L {cx - 12} {cy + 13} Z '
            f'M {cx + 12} {cy - 13} L {cx} {cy} L {cx + 12} {cy + 13} Z"/>')


flows = [
    '<g class="fl" data-loops="B1 R2">',
    '<rect class="pipe" x="76" y="393" width="395" height="14"/>',
    '<polygon class="pipe-head" points="469,386 486,400 469,414"/>',
    valve(280, 400),
    '<rect class="fbox" x="172" y="418" width="216" height="40" rx="7"/>',
    '<text class="ft" x="280" y="431">Entering at-risk gambling</text>',
    '<text class="fs" x="280" y="447">PGSI 0 → 1+</text>',
    '</g>',
    '<g class="fl" data-loops="B2">',
    '<rect class="pipe" x="705" y="393" width="397" height="14"/>',
    '<polygon class="pipe-head" points="1100,386 1117,400 1100,414"/>',
    valve(950, 400),
    '<rect class="fbox" x="875" y="418" width="150" height="40" rx="7"/>',
    '<text class="ft" x="950" y="431">Exit from risk</text>',
    '<text class="fs" x="950" y="447">PGSI 1+ → 0</text>',
    '</g>',
    cloud(55, 400),
    cloud(1141, 400, mirror=True),
]
scx, scy, sw, sh = STOCK
stock = (f'<g class="st" data-loops="B1 B2 R2"><rect x="{scx - sw / 2:.0f}" y="{scy - sh / 2:.0f}" width="{sw}" '
         f'height="{sh}" rx="8"/><text class="stt" x="{scx}" y="{scy - 9}">At-risk gamblers</text>'
         f'<text class="sts" x="{scx}" y="{scy + 14}">adults with PGSI 1+</text></g>')

zones = [f'<rect class="zone {z}" x="{x}" y="{y}" width="{w}" height="{h}" rx="18"/>'
         f'<text class="zt {z}" x="{tx}" y="{ty}">{title}</text>'
         for z, x, y, w, h, title, tx, ty in ZONES]

# ---------------------------------------------------------------- geometry checks
boxes = {k: box_of(k) for k in NODES}
boxes['ST'] = box_of('ST')
extra = {'INbox': (280, 438, 108, 20), 'OUTbox': (950, 438, 75, 20)}


def inside(p, b, pad=1.0):
    cx, cy, hw, hh = b
    return abs(p[0] - cx) < hw + pad and abs(p[1] - cy) < hh + pad


for frm, to, pts in geo:
    core = pts[3:-3]
    for k, b in {**boxes, **extra}.items():
        if k in (frm, to):
            continue
        if any(inside(p, b) for p in core):
            warnings.append(f'link {frm}->{to} crosses {k}')
    for lid, cx, cy, *_ in LOOPS:
        dmin = min(math.dist(p, (cx, cy)) for p in pts)
        if dmin < 19:
            warnings.append(f'link {frm}->{to} passes {dmin:.0f}px from loop {lid}')
for bx, by, name in badges:
    for k, b in boxes.items():
        if inside((bx, by), b, pad=BADGE_R + 1):
            warnings.append(f'badge {name} touches {k}')
    for bx2, by2, name2 in badges:
        if name2 > name and math.dist((bx, by), (bx2, by2)) < 2 * BADGE_R + 2:
            warnings.append(f'badges {name} and {name2} overlap')
for qx, qy, name in delays:
    for k, b in {**boxes, **extra}.items():
        if inside((qx, qy), b, pad=9):
            warnings.append(f'delay mark on {name} touches {k}')
    for bx, by, bname in badges:
        if math.dist((qx, qy), (bx, by)) < BADGE_R + 6:
            warnings.append(f'delay mark on {name} is close to badge {bname}')
    for lid, cx, cy, *_ in LOOPS:
        if math.dist((qx, qy), (cx, cy)) < 26:
            warnings.append(f'delay mark on {name} is close to loop {lid}')
ids = list(NODES)
for i, a in enumerate(ids):
    for b in ids[i + 1:]:
        A, B = boxes[a], boxes[b]
        if abs(A[0] - B[0]) < A[2] + B[2] + 8 and abs(A[1] - B[1]) < A[3] + B[3] + 8:
            warnings.append(f'nodes {a} and {b} are closer than 8px')
for w in warnings:
    print('WARN', w)

# ---------------------------------------------------------------- page
SVG = f'''<svg id="cld" class="cld" viewBox="-16 -12 1232 804" role="img" aria-label="At-risk gamblers is the stock. Market and social norms push people in, harm keeps them gambling, and awareness, help and regulation pull them back out.">
<defs>
<marker id="ah-pos" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path class="ah-pos" d="M0 0 L10 5 L0 10 L2.6 5 Z"/></marker>
<marker id="ah-neg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path class="ah-neg" d="M0 0 L10 5 L0 10 L2.6 5 Z"/></marker>
<marker id="ah-lp" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path class="ah-lp" d="M0 0 L10 5 L0 10 Z"/></marker>
</defs>
<g class="zones">{''.join(zones)}</g>
<g class="flows">{''.join(flows)}</g>
<g class="links">{''.join(link_svg)}</g>
{stock}
<g class="nodes">{''.join(node_svg)}</g>
<g class="loops">{''.join(loop_svg)}</g>
</svg>'''

chips = ['<button type="button" class="chip" data-loop="" aria-pressed="true">All loops</button>']
for lid, _, _, _, name, _ in LOOPS:
    chips.append(f'<button type="button" class="chip" data-loop="{lid}" aria-pressed="false">'
                 f'<b>{lid}</b> {esc(name)}</button>')

info_js = ',\n'.join(f'    {lid}: {{ name: {name!r}, text: {text!r} }}' for lid, _, _, _, name, text in LOOPS)

PAGE = f'''<title>Gambling Harm System Map</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap">
<style>
/* Layout: one wide figure on a card. Three tinted zones (market, harm, response) around a central stock-and-flow spine. */
:root {{
  --bg: #f4f5f8; --surface: #ffffff; --node: #ffffff;
  --ink: #1b2230; --muted: #5a6373; --hair: #d8dde6;
  --pos: #39465a; --neg: #c0432a;
  --pipe: #e3e7ee; --pipe-edge: #8b95a6;
  --mk: #95600f; --mk-tint: #faf4e9;
  --hm: #7a3d97; --hm-tint: #f6f0fa;
  --gv: #2b5aa3; --gv-tint: #edf2fa;
  --focus: #2b5aa3;
  --font-ui: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-display: "Space Grotesk", "Inter", system-ui, -apple-system, sans-serif;
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    --bg: #111419; --surface: #181c23; --node: #20262f;
    --ink: #e6e9ef; --muted: #9ba3b1; --hair: #2b323d;
    --pos: #c2cad7; --neg: #f08a6b;
    --pipe: #2a313c; --pipe-edge: #7a8598;
    --mk: #e3ae5e; --mk-tint: #1f1b14;
    --hm: #c99ce2; --hm-tint: #1e1824;
    --gv: #8ab0f0; --gv-tint: #151c28;
    --focus: #8ab0f0;
    color-scheme: dark;
  }}
}}
:root[data-theme="dark"] {{
  --bg: #111419; --surface: #181c23; --node: #20262f;
  --ink: #e6e9ef; --muted: #9ba3b1; --hair: #2b323d;
  --pos: #c2cad7; --neg: #f08a6b;
  --pipe: #2a313c; --pipe-edge: #7a8598;
  --mk: #e3ae5e; --mk-tint: #1f1b14;
  --hm: #c99ce2; --hm-tint: #1e1824;
  --gv: #8ab0f0; --gv-tint: #151c28;
  --focus: #8ab0f0;
  color-scheme: dark;
}}
body {{
  background: var(--bg); color: var(--ink);
  font: 400 15px/1.55 var(--font-ui);
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
  padding-block: 32px 56px;
}}
main {{ max-width: 1240px; margin-inline: auto; display: grid; gap: 18px; }}
.eyebrow {{ margin: 0 0 8px; font: 600 12px/1 var(--font-ui); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }}
h1 {{ margin: 0; font: 700 clamp(26px, 3.4vw, 38px)/1.08 var(--font-display); letter-spacing: -.015em; text-wrap: balance; }}
.lede {{ margin: 10px 0 0; max-width: 68ch; color: var(--muted); }}
.loops {{ display: flex; flex-wrap: wrap; gap: 8px; }}
.chip {{
  font: 500 13.5px/1 var(--font-ui); color: var(--ink); background: var(--surface);
  border: 1px solid var(--hair); border-radius: 999px; padding: 8px 13px; cursor: pointer;
}}
.chip b {{ font-family: var(--font-display); font-weight: 700; margin-right: 3px; }}
.chip:hover {{ border-color: var(--pipe-edge); }}
.chip[aria-pressed="true"] {{ background: var(--ink); color: var(--bg); border-color: var(--ink); }}
.chip:focus-visible {{ outline: 2px solid var(--focus); outline-offset: 2px; }}
#loop-note {{ margin: 0; min-height: 3.1em; max-width: 86ch; }}
#loop-note strong {{ font-family: var(--font-display); }}
figure {{ margin: 0; display: grid; gap: 10px; }}
.frame {{ overflow-x: auto; background: var(--surface); border: 1px solid var(--hair); border-radius: 14px; padding: 10px; }}
.frame svg {{ display: block; width: 100%; min-width: 900px; height: auto; }}
figcaption {{ color: var(--muted); font-size: 14px; max-width: 86ch; }}
.legend {{ list-style: none; margin: 4px 0 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px 24px; }}
.legend li {{ display: flex; align-items: center; gap: 10px; font-size: 13.5px; color: var(--muted); min-width: 0; }}
.legend svg {{ flex: none; width: 58px; height: 30px; }}
.legend b {{ color: var(--ink); font-weight: 600; }}

/* diagram */
.cld .zone.mk {{ fill: var(--mk-tint); }} .cld .zone.hm {{ fill: var(--hm-tint); }} .cld .zone.gv {{ fill: var(--gv-tint); }}
.cld .zt {{ font: 600 11.5px/1 var(--font-ui); letter-spacing: .09em; }}
.cld .zt.mk {{ fill: var(--mk); }} .cld .zt.hm {{ fill: var(--hm); }} .cld .zt.gv {{ fill: var(--gv); }}
.cld .nd rect {{ fill: var(--node); stroke-width: 1.4; }}
.cld .nd.mk rect {{ stroke: var(--mk); }} .cld .nd.hm rect {{ stroke: var(--hm); }} .cld .nd.gv rect {{ stroke: var(--gv); }}
.cld .nt {{ font: 500 14px var(--font-ui); fill: var(--ink); text-anchor: middle; dominant-baseline: central; }}
.cld .ln {{ fill: none; stroke-width: 1.6; stroke-linecap: round; }}
.cld .pos .ln {{ stroke: var(--pos); }}
.cld .neg .ln {{ stroke: var(--neg); stroke-dasharray: 6 4; }}
.cld .dl {{ stroke: var(--ink); stroke-width: 1.8; stroke-linecap: round; }}
.cld .ah-pos {{ fill: var(--pos); }} .cld .ah-neg {{ fill: var(--neg); }} .cld .ah-lp {{ fill: var(--ink); }}
.cld .bd circle {{ fill: var(--node); stroke-width: 1.3; }}
.cld .pos .bd circle {{ stroke: var(--pos); }} .cld .neg .bd circle {{ stroke: var(--neg); }}
.cld .bd text {{ font: 700 12.5px var(--font-ui); text-anchor: middle; dominant-baseline: central; }}
.cld .pos .bd text {{ fill: var(--pos); }} .cld .neg .bd text {{ fill: var(--neg); }}
.cld .pipe {{ fill: var(--pipe); stroke: var(--pipe-edge); stroke-width: 1; }}
.cld .pipe-head {{ fill: var(--pipe-edge); }}
.cld .valve {{ fill: var(--node); stroke: var(--ink); stroke-width: 1.4; stroke-linejoin: round; }}
.cld .fbox {{ fill: var(--node); stroke: var(--pipe-edge); stroke-width: 1; }}
.cld .ft {{ font: 600 13.5px var(--font-ui); fill: var(--ink); text-anchor: middle; dominant-baseline: central; }}
.cld .fs {{ font: 500 12px var(--font-ui); fill: var(--muted); text-anchor: middle; dominant-baseline: central; }}
.cld .cloud-o {{ fill: var(--pipe-edge); }} .cld .cloud-i {{ fill: var(--node); }}
.cld .st rect {{ fill: var(--node); stroke: var(--ink); stroke-width: 2.2; }}
.cld .stt {{ font: 700 17px var(--font-display); fill: var(--ink); text-anchor: middle; dominant-baseline: central; }}
.cld .sts {{ font: 500 12px var(--font-ui); fill: var(--muted); text-anchor: middle; dominant-baseline: central; }}
.cld .lp {{ cursor: pointer; }}
.cld .lp path {{ fill: none; stroke: var(--ink); stroke-width: 1.6; }}
.cld .lp text {{ font: 700 12.5px var(--font-display); fill: var(--ink); text-anchor: middle; dominant-baseline: central; }}
.cld .lp .hit {{ fill: transparent; }}
.cld .lp:focus {{ outline: none; }}
.cld .lp:focus-visible .hit {{ stroke: var(--focus); stroke-width: 2; }}
.cld [data-loops], .cld .cloud {{ transition: opacity .18s ease; }}
.cld.focus [data-loops]:not(.on), .cld.focus .cloud {{ opacity: .12; }}
.cld.focus .lk.on .ln {{ stroke-width: 2.6; }}
@media (prefers-reduced-motion: reduce) {{ .cld [data-loops], .cld .cloud {{ transition: none; }} }}
</style>

<main>
  <header>
    <p class="eyebrow">Causal loop and stock-flow diagram</p>
    <h1>Gambling harm system map</h1>
    <p class="lede">How Australian adults move into and out of at-risk gambling, and the six feedback loops that push that number up or down.</p>
  </header>

  <nav class="loops" aria-label="Trace a loop">
    {''.join(chips)}
  </nav>
  <p id="loop-note" aria-live="polite">Pick a loop to trace it through the diagram. A loop with an even number of − links reinforces itself (R); an odd number balances it (B).</p>

  <figure>
    <div class="frame">
{SVG}
    </div>
    <figcaption>At-risk gamblers is the stock. Market and social norms push people in, harm keeps them gambling, and awareness, help and regulation pull them back out.</figcaption>
  </figure>

  <ul class="legend">
    <li><svg class="cld" viewBox="0 0 58 30" aria-hidden="true"><g class="st"><rect x="6" y="6" width="46" height="18" rx="3"/></g></svg><span><b>Stock</b>: adults at risk right now</span></li>
    <li><svg class="cld" viewBox="0 0 58 30" aria-hidden="true"><rect class="pipe" x="2" y="12" width="44" height="6"/><polygon class="pipe-head" points="44,8 54,15 44,22"/><path class="valve" d="M 18 7 L 25 15 L 18 23 Z M 32 7 L 25 15 L 32 23 Z"/></svg><span><b>Flow</b>: adults per year moving in or out</span></li>
    <li><svg class="cld" viewBox="0 0 58 30" aria-hidden="true"><g class="pos"><path class="ln" d="M 3 15 L 46 15"/><polygon class="ah-pos" points="45,10.5 54,15 45,19.5 47.3,15"/><g class="bd"><circle cx="30" cy="15" r="7.5"/><text x="30" y="15.5">+</text></g></g></svg><span><b>Same direction</b>: more of A, more of B</span></li>
    <li><svg class="cld" viewBox="0 0 58 30" aria-hidden="true"><g class="neg"><path class="ln" d="M 3 15 L 46 15"/><polygon class="ah-neg" points="45,10.5 54,15 45,19.5 47.3,15"/><g class="bd"><circle cx="30" cy="15" r="7.5"/><text x="30" y="15.5">−</text></g></g></svg><span><b>Opposite direction</b>: more of A, less of B</span></li>
    <li><svg class="cld" viewBox="0 0 58 30" aria-hidden="true"><g class="pos"><path class="ln" d="M 3 15 L 46 15"/><polygon class="ah-pos" points="45,10.5 54,15 45,19.5 47.3,15"/><line class="dl" x1="21.6" y1="8.5" x2="21.6" y2="21.5"/><line class="dl" x1="26.4" y1="8.5" x2="26.4" y2="21.5"/></g></svg><span><b>Delay</b>: the effect builds up over months or years</span></li>
    <li><svg class="cld" viewBox="0 0 58 30" aria-hidden="true"><g class="lp"><path d="M 34 4.5 A 12 12 0 1 1 22 4.5"/><polygon class="ah-lp" points="20,1 26,5 20,9"/><text x="28" y="15.5">R</text></g></svg><span><b>Feedback loop</b>: R reinforces, B balances</span></li>
    <li><svg class="cld" viewBox="0 0 58 30" aria-hidden="true"><g class="fl"><rect class="fbox" x="3" y="6" width="52" height="18" rx="5"/><text class="fs" x="29" y="15.5">PGSI</text></g></svg><span><b>PGSI</b>: Problem Gambling Severity Index. 0 is no risk; 1+ is low, moderate or high risk</span></li>
  </ul>
</main>

<script>
(() => {{
  const svg = document.getElementById('cld');
  const note = document.getElementById('loop-note');
  const chips = Array.from(document.querySelectorAll('.chip'));
  const parts = Array.from(svg.querySelectorAll('[data-loops]'));
  const INFO = {{
{info_js}
  }};
  const DEFAULT = note.textContent;
  let active = '';
  function select(id) {{
    active = id && id !== active ? id : '';
    svg.classList.toggle('focus', Boolean(active));
    parts.forEach((el) => el.classList.toggle('on', Boolean(active) && el.dataset.loops.split(' ').includes(active)));
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.loop === active)));
    if (!active) {{ note.textContent = DEFAULT; return; }}
    const head = document.createElement('strong');
    head.textContent = active + ' \\u00b7 ' + INFO[active].name + '. ';
    note.replaceChildren(head, document.createTextNode(INFO[active].text));
  }}
  chips.forEach((c) => c.addEventListener('click', () => select(c.dataset.loop)));
  svg.querySelectorAll('.lp').forEach((g) => {{
    g.addEventListener('click', () => select(g.dataset.loops));
    g.addEventListener('keydown', (e) => {{
      if (e.key === 'Enter' || e.key === ' ') {{ e.preventDefault(); select(g.dataset.loops); }}
    }});
  }});
}})();
</script>
'''

script_part = PAGE[PAGE.index('<script>'):]
assert script_part.isascii(), 'keep the script ASCII-only'
PAGE = PAGE.encode('ascii', 'xmlcharrefreplace').decode('ascii')  # entities, so no charset can garble arrows or minus signs
with open(OUT, 'w', encoding='ascii') as f:
    f.write(PAGE)
print('wrote', OUT, len(PAGE), 'bytes,', len(warnings), 'warnings')

if '--ts' in sys.argv:
    import json
    ts_path = sys.argv[sys.argv.index('--ts') + 1]
    svg_sim = SVG.replace('<svg id="cld" class="cld"', '<svg id="cldMap" class="cld"', 1)
    svg_sim = svg_sim.encode('ascii', 'xmlcharrefreplace').decode('ascii')
    loops_js = json.dumps([{'id': lid, 'name': name, 'text': text} for lid, _, _, _, name, text in LOOPS], ensure_ascii=True)
    with open(ts_path, 'w', encoding='ascii') as f:
        f.write('// Generated by scripts/cld/build_map.py from the group causal loop diagram. Do not edit by hand.\n')
        f.write(f'export const CLD_SVG = {json.dumps(svg_sim)};\n')
        f.write(f'export const LOOP_INFO: {{ id: string; name: string; text: string }}[] = {loops_js};\n')
    print('wrote', ts_path)

if '--export' in sys.argv:
    # standalone light page for a PNG: title, diagram, legend and loop names (rendered with headless Chrome)
    exp_path = sys.argv[sys.argv.index('--export') + 1]
    css = PAGE[PAGE.index('<style>') + len('<style>'):PAGE.index('</style>')]
    legend = PAGE[PAGE.index('<ul class="legend">'):PAGE.index('</ul>', PAGE.index('<ul class="legend">')) + len('</ul>')]
    loops_key = ' &nbsp;·&nbsp; '.join(f'<b>{lid}</b> {esc(name)}' for lid, _, _, _, name, _ in LOOPS)
    html_out = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="color-scheme" content="light">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap">
<style>{css}
body {{ margin: 0; padding: 28px 32px 24px; background: #ffffff; }}
.wrap {{ width: 1536px; display: grid; gap: 14px; }}
.ttl {{ margin: 0; font: 700 28px/1.1 var(--font-display); color: var(--ink); }}
.sub {{ margin: 4px 0 0; color: var(--muted); font-size: 15px; }}
.wrap > svg {{ display: block; width: 100%; height: auto; }}
.legend {{ grid-template-columns: repeat(4, minmax(0, 1fr)); }}
.loopkey {{ margin: 0; font-size: 14px; color: var(--muted); }}
.loopkey b {{ color: var(--ink); font-family: var(--font-display); }}
</style></head><body><div class="wrap">
<div><h1 class="ttl">Gambling harm in Australia: causal loop diagram</h1>
<p class="sub">At-risk gamblers (PGSI 1+) is the stock. Market and social norms push people in, harm keeps them gambling, and awareness, help and regulation pull them back out.</p></div>
{SVG}
{legend}
<p class="loopkey">{loops_key}</p>
</div></body></html>'''
    with open(exp_path, 'w', encoding='ascii') as f:
        f.write(html_out.encode('ascii', 'xmlcharrefreplace').decode('ascii'))
    print('wrote', exp_path)
