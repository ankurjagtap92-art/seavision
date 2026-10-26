"""
Run this LOCALLY once. Generates routes_data.json with all 45 route variants
computed by the A* + land-mask router. The output JSON is committed to the repo
and served by main.py at runtime — no computation needed on the server.

Requires locally:  pip install numpy global-land-mask
"""
import math
import json
import heapq
from collections import deque
import numpy as np
from global_land_mask import globe

PORTS = {
    "JNPT": (18.95, 72.95),
    "Chennai": (13.08, 80.28),
    "Visakhapatnam": (17.68, 83.22),
    "Mundra": (22.75, 69.70),
    "Colombo": (6.95, 79.85),
    "Singapore": (1.26, 103.84),
}

LAT0, LAT1, LON0, LON1 = -2.0, 26.0, 65.0, 108.0
RES = 0.05
CLEAR = 0.03
NY = int(round((LAT1 - LAT0) / RES)) + 1
NX = int(round((LON1 - LON0) / RES)) + 1
PALK_BOX = (8.8, 10.4, 79.0, 80.3)

_NAV = None
_WIDE = None


def _grids():
    global _NAV, _WIDE
    if _NAV is not None:
        return _NAV, _WIDE
    lats = LAT0 + np.arange(NY) * RES
    lons = LON0 + np.arange(NX) * RES
    lat_col = lats[:, np.newaxis]
    lon_row = lons[np.newaxis, :]
    ok = np.ones((NY, NX), dtype=bool)
    for dy, dx in [(0, 0), (CLEAR, 0), (-CLEAR, 0), (0, CLEAR), (0, -CLEAR)]:
        ok &= ~globe.is_land(lat_col + dy, lon_row + dx)
    a, b, c, d = PALK_BOX
    LA = lat_col + np.zeros((1, NX))
    LO = lon_row + np.zeros((NY, 1))
    ok &= ~((LA >= a) & (LA <= b) & (LO >= c) & (LO <= d))
    del LA, LO

    seed = (int(round((10.0 - LAT0) / RES)), int(round((88.0 - LON0) / RES)))
    seen = np.zeros(ok.shape, bool)
    seen[seed] = True
    q = deque([seed])
    while q:
        y, x = q.popleft()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                ny, nx = y + dy, x + dx
                if (0 <= ny < NY and 0 <= nx < NX and ok[ny, nx] and not seen[ny, nx]
                        and (not (dy and dx) or (ok[y + dy, x] and ok[y, x + dx]))):
                    seen[ny, nx] = True
                    q.append((ny, nx))

    wide = seen.copy()
    for _ in range(3):
        e = wide.copy()
        e[1:, :] &= wide[:-1, :]
        e[:-1, :] &= wide[1:, :]
        e[:, 1:] &= wide[:, :-1]
        e[:, :-1] &= wide[:, 1:]
        wide = e
    _NAV, _WIDE = seen, wide
    return _NAV, _WIDE


def _cell(lat, lon):
    return int(round((lat - LAT0) / RES)), int(round((lon - LON0) / RES))


def _ll(c):
    return LAT0 + c[0] * RES, LON0 + c[1] * RES


def _snap(lat, lon, maxr=60):
    nav, _ = _grids()
    y0, x0 = _cell(lat, lon)
    for r in range(maxr):
        best = None
        for y in range(max(0, y0 - r), min(NY, y0 + r + 1)):
            for x in range(max(0, x0 - r), min(NX, x0 + r + 1)):
                if max(abs(y - y0), abs(x - x0)) == r and nav[y, x]:
                    d = (y - y0) ** 2 + (x - x0) ** 2
                    if best is None or d < best[0]:
                        best = (d, (y, x))
        if best:
            return best[1]
    raise ValueError(f"No navigable water near {lat},{lon}")


_NB = [(-1, 0, 1.0), (1, 0, 1.0), (0, -1, 1.0), (0, 1, 1.0),
       (-1, -1, 1.4142), (-1, 1, 1.4142), (1, -1, 1.4142), (1, 1, 1.4142)]


def _astar(src, dst, offshore_cost):
    nav, wide = _grids()
    def h(c):
        dy, dx = abs(c[0] - dst[0]), abs(c[1] - dst[1])
        return max(dy, dx) + 0.4142 * min(dy, dx)
    openq = [(h(src), 0.0, src)]
    best = {src: 0.0}
    prev = {}
    while openq:
        _, g, c = heapq.heappop(openq)
        if c == dst:
            break
        if g > best.get(c, 1e18):
            continue
        for dy, dx, w in _NB:
            n = (c[0] + dy, c[1] + dx)
            if not (0 <= n[0] < NY and 0 <= n[1] < NX) or not nav[n]:
                continue
            if dy and dx and not (nav[c[0] + dy, c[1]] and nav[c[0], c[1] + dx]):
                continue
            ng = g + w * (1.0 if wide[n] else offshore_cost)
            if ng < best.get(n, 1e18):
                best[n] = ng
                prev[n] = c
                heapq.heappush(openq, (ng + h(n), ng, n))
    if src != dst and dst not in prev:
        raise ValueError("No sea path")
    path = [dst]
    while path[-1] != src:
        path.append(prev[path[-1]])
    return path[::-1]


def _clear_line(a, b, clr, step=0.01):
    n = max(1, int(max(abs(b[0] - a[0]), abs(b[1] - a[1])) / step))
    t = np.linspace(0, 1, n + 1)
    la = a[0] + (b[0] - a[0]) * t
    lo = a[1] + (b[1] - a[1]) * t
    for dy, dx in [(0, 0), (clr, 0), (-clr, 0), (0, clr), (0, -clr)]:
        if globe.is_land(la + dy, lo + dx).any():
            return False
    a_, b_, c_, d_ = PALK_BOX
    if ((la >= a_) & (la <= b_) & (lo >= c_) & (lo <= d_)).any():
        return False
    return True


def _smooth(pts, clr=0.10):
    out, i = [pts[0]], 0
    while i < len(pts) - 1:
        j = len(pts) - 1
        while j > i + 1 and not _clear_line(pts[i], pts[j], clr):
            j -= 1
        out.append(pts[j])
        i = j
    return out


def _sea_path(o, d, via=None, offshore_cost=4.0):
    pts = [o] + ([via] if via else []) + [d]
    cells = [_snap(*p) for p in pts]
    full = []
    for a, b in zip(cells, cells[1:]):
        seg = _astar(a, b, offshore_cost)
        full += seg if not full else seg[1:]
    return [o] + _smooth([_ll(c) for c in full]) + [d]


def _densify(points, max_step=0.2):
    out = []
    for (la1, lo1), (la2, lo2) in zip(points, points[1:]):
        n = max(1, int(max(abs(la2 - la1), abs(lo2 - lo1)) / max_step))
        for j in range(n):
            f = j / n
            out.append([round(la1 + (la2 - la1) * f, 4), round(lo1 + (lo2 - lo1) * f, 4)])
    out.append([round(points[-1][0], 4), round(points[-1][1], 4)])
    return out


def _variant_via(direct, o, d, sign):
    dists = [0.0]
    for p, q in zip(direct, direct[1:]):
        dists.append(dists[-1] + math.hypot(p[0]-q[0], p[1]-q[1]))
    mid = next(p for p, s in zip(direct, dists) if s >= dists[-1] / 2)
    dlat, dlon = d[0] - o[0], d[1] - o[1]
    norm = math.hypot(dlat, dlon) or 1.0
    pl, po = -dlon / norm, dlat / norm
    if pl < -1e-9 or (abs(pl) < 1e-9 and po < 0):
        pl, po = -pl, -po
    off = min(3.0, max(1.0, 0.12 * norm))
    return (mid[0] + sign * pl * off, mid[1] + sign * po * off)


def compute_pair(a, b):
    o, d = PORTS[a], PORTS[b]
    print(f"  Computing {a} → {b} Direct...")
    direct = _sea_path(o, d, offshore_cost=4.0)
    result = {"Direct": direct}
    for name, sign, cost in (("Northern", +1, 4.0), ("Southern", -1, 12.0)):
        print(f"  Computing {a} → {b} {name}...")
        try:
            result[name] = _sea_path(o, d, via=_variant_via(direct, o, d, sign), offshore_cost=cost)
        except ValueError as e:
            print(f"    ✗ {name} failed: {e}, using Direct")
            result[name] = direct
    return {k: _densify(v) for k, v in result.items()}


def main():
    print("Building land grid...")
    _grids()
    print(f"Grid built: {NY}×{NX} cells\n")

    result = {}
    ports = list(PORTS.keys())
    for i, a in enumerate(ports):
        for b in ports[i+1:]:
            key = f"{a}__{b}"
            result[key] = compute_pair(a, b)

    with open("routes_data.json", "w") as f:
        json.dump(result, f, separators=(",", ":"))

    total_pts = sum(len(v) for pair in result.values() for v in pair.values())
    print(f"\n✅ Done!")
    print(f"   Pairs: {len(result)}")
    print(f"   Total waypoints: {total_pts}")
    print(f"   Output: routes_data.json")


if __name__ == "__main__":
    main()