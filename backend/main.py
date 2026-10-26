from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from jose import JWTError, jwt
import math
import io
import csv
import os
import base64

import heapq
from collections import deque
from functools import lru_cache
import numpy as np
# NOTE: global_land_mask is imported lazily inside functions to save startup memory

import models
import auth
import database

app = FastAPI(title="SeaVision API")

# ---------- CORS ----------
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:4173",
]
_frontend_url = os.getenv("FRONTEND_URL", "")
if _frontend_url:
    ALLOWED_ORIGINS.append(_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models.Base.metadata.create_all(bind=database.engine)


# ---------- Optional: static uploads (legacy support only) ----------
UPLOAD_DIR = "uploads"
if os.path.isdir(UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# ---------- Seed demo user ----------
def seed_demo_data():
    db = database.SessionLocal()
    try:
        if db.query(models.User).filter(models.User.email == "demo@seavision.com").first():
            return
        demo = models.User(
            email="demo@seavision.com",
            hashed_password=auth.get_password_hash("demo123"),
        )
        db.add(demo)
        db.commit()
        db.refresh(demo)
        db.add(models.Vessel(
            user_id=demo.id,
            name="MV Samudra",
            imo_number="9123456",
            vessel_type="Cargo",
            image_url="",
        ))
        db.commit()
        print("[seed] Demo user created: demo@seavision.com / demo123")
    except Exception as e:
        print(f"[seed] Failed: {e}")
    finally:
        db.close()

seed_demo_data()


# ---------- Dependencies ----------
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email = payload.get("sub")
        if email is None:
            raise cred_exc
    except JWTError:
        raise cred_exc
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise cred_exc
    return user


# ---------- Schemas ----------
class RegisterRequest(BaseModel):
    email: str
    password: str


# ---------- Ports ----------
PORTS = {
    "JNPT": (18.95, 72.95),
    "Chennai": (13.08, 80.28),
    "Visakhapatnam": (17.68, 83.22),
    "Mundra": (22.75, 69.70),
    "Colombo": (6.95, 79.85),
    "Singapore": (1.26, 103.84),
}


# ---------- Auth ----------
@app.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == req.email).first():
        raise HTTPException(400, "Email already registered")
    if len(req.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    user = models.User(email=req.email, hashed_password=auth.get_password_hash(req.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "User created", "id": user.id}


@app.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")
    token = auth.create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}


# ---------- Vessels ----------
@app.get("/vessels")
def list_vessels(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Vessel).filter(models.Vessel.user_id == current_user.id).all()


@app.post("/vessels")
def add_vessel(
    name: str = Form(...),
    imo_number: str = Form(...),
    vessel_type: str = Form(""),
    file: Optional[UploadFile] = File(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not imo_number.isdigit() or len(imo_number) != 7:
        raise HTTPException(400, "IMO number must be exactly 7 digits")

    image_data = ""
    if file is not None and file.filename:
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(400, "Uploaded file must be an image")
        contents = file.file.read()
        if len(contents) > 2 * 1024 * 1024:
            raise HTTPException(400, "Image must be under 2 MB")
        b64 = base64.b64encode(contents).decode("utf-8")
        image_data = f"data:{file.content_type};base64,{b64}"

    v = models.Vessel(
        user_id=current_user.id,
        name=name,
        imo_number=imo_number,
        vessel_type=vessel_type,
        image_url=image_data,
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


@app.delete("/vessels/{vessel_id}")
def delete_vessel(vessel_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    v = db.query(models.Vessel).filter(models.Vessel.id == vessel_id, models.Vessel.user_id == current_user.id).first()
    if not v:
        raise HTTPException(404, "Vessel not found")
    db.delete(v)
    db.commit()
    return {"message": "Deleted"}


@app.get("/ports")
def list_ports():
    return [{"name": k, "lat": v[0], "lon": v[1]} for k, v in PORTS.items()]


# =====================================================================
# SEA ROUTING — memory-optimized for 512MB containers
# =====================================================================
# Tightened region: only covers the ports + margin (was -2..26 lat, 65..108 lon)
LAT0, LAT1, LON0, LON1 = 0.0, 25.0, 68.0, 106.0
RES = 0.08              # coarser than 0.05 — saves ~70% grid memory
CLEAR = 0.03
NY = int(round((LAT1 - LAT0) / RES)) + 1
NX = int(round((LON1 - LON0) / RES)) + 1

PALK_BOX = (8.8, 10.4, 79.0, 80.3)

_NAV = None
_WIDE = None


def haversine_nm(lat1, lon1, lat2, lon2):
    R = 3440.065
    la1, lo1, la2, lo2 = map(math.radians, [lat1, lon1, lat2, lon2])
    a = (math.sin((la2 - la1) / 2) ** 2
         + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(a))


def route_distance_nm(wps):
    return sum(haversine_nm(wps[i][0], wps[i][1], wps[i + 1][0], wps[i + 1][1])
               for i in range(len(wps) - 1))


def _grids():
    """Build navigable-water grid lazily — only on first route request."""
    global _NAV, _WIDE
    if _NAV is not None:
        return _NAV, _WIDE

    from global_land_mask import globe  # lazy import = saves ~200MB until first route

    lats = LAT0 + np.arange(NY) * RES
    lons = LON0 + np.arange(NX) * RES
    # Use broadcasting instead of meshgrid — avoids allocating 2 extra full-size arrays
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

    # Flood-fill from open ocean to drop lakes/inlets
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
    for _ in range(2):  # erode 2 cells (was 3)
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
        raise ValueError("No sea path between the given points")
    path = [dst]
    while path[-1] != src:
        path.append(prev[path[-1]])
    return path[::-1]


def _clear_line(a, b, clr, step=0.02):
    from global_land_mask import globe
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
        dists.append(dists[-1] + haversine_nm(p[0], p[1], q[0], q[1]))
    mid = next(p for p, s in zip(direct, dists) if s >= dists[-1] / 2)
    dlat, dlon = d[0] - o[0], d[1] - o[1]
    norm = math.hypot(dlat, dlon) or 1.0
    pl, po = -dlon / norm, dlat / norm
    if pl < -1e-9 or (abs(pl) < 1e-9 and po < 0):
        pl, po = -pl, -po
    off = min(3.0, max(1.0, 0.12 * norm))
    return (mid[0] + sign * pl * off, mid[1] + sign * po * off)


@lru_cache(maxsize=None)
def _compute_pair(a, b):
    o, d = PORTS[a], PORTS[b]
    direct = _sea_path(o, d, offshore_cost=4.0)
    variants = {"Direct": direct}
    for name, sign, cost in (("Northern", +1, 4.0), ("Southern", -1, 12.0)):
        try:
            variants[name] = _sea_path(o, d, via=_variant_via(direct, o, d, sign), offshore_cost=cost)
        except ValueError:
            variants[name] = direct
    return {k: _densify(v) for k, v in variants.items()}


def build_route(origin, destination, route_name):
    if route_name not in ("Direct", "Northern", "Southern"):
        raise HTTPException(400, "route_name must be Direct, Northern or Southern")
    a, b = sorted((origin, destination))
    pts = _compute_pair(a, b)[route_name]
    return pts if origin == a else pts[::-1]


# ---------- Routes ----------
@app.get("/routes")
def get_routes(origin: str, destination: str, current_user=Depends(get_current_user)):
    if origin not in PORTS or destination not in PORTS:
        raise HTTPException(400, "Invalid port")
    if origin == destination:
        raise HTTPException(400, "Origin and destination must differ")

    def pack(wps, speed, label, color):
        dist = route_distance_nm(wps)
        days = dist / (speed * 24)
        fpd = 30 * (speed / 14) ** 3
        fuel = fpd * days
        return {
            "name": label,
            "color": color,
            "waypoints": wps,
            "distance_nm": round(dist, 1),
            "speed_kn": speed,
            "days": round(days, 2),
            "fuel_tons": round(fuel, 1),
            "co2_tons": round(fuel * 3.15, 1),
        }

    return {
        "origin": origin,
        "destination": destination,
        "routes": [
            pack(build_route(origin, destination, "Direct"), 14, "Direct (Fastest)", "#22c55e"),
            pack(build_route(origin, destination, "Northern"), 12, "Northern (Cheapest)", "#3b82f6"),
            pack(build_route(origin, destination, "Southern"), 13, "Southern (Safest)", "#f97316"),
        ],
    }


@app.get("/routes/download")
def download_route(origin: str, destination: str, route_name: str, current_user=Depends(get_current_user)):
    if origin not in PORTS or destination not in PORTS:
        raise HTTPException(400, "Invalid port")
    if origin == destination:
        raise HTTPException(400, "Origin and destination must differ")

    wps = build_route(origin, destination, route_name)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["lat", "lon"])
    for pt in wps:
        writer.writerow(pt)
    buf.seek(0)

    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{origin}_{destination}_{route_name}.csv"'},
    )