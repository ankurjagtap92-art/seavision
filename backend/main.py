from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from jose import JWTError, jwt
import math
import io
import csv
import os
import json
import base64

import models
import auth
import database

app = FastAPI(title="SeaVision API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

models.Base.metadata.create_all(bind=database.engine)


# ---------- Load precomputed A* routes ----------
ROUTES_JSON_PATH = os.path.join(os.path.dirname(__file__), "routes_data.json")
PRECOMPUTED = {}
if os.path.exists(ROUTES_JSON_PATH):
    with open(ROUTES_JSON_PATH, "r") as f:
        PRECOMPUTED = json.load(f)
    print(f"[routes] Loaded {len(PRECOMPUTED)} precomputed pairs")
else:
    print(f"[routes] WARNING: {ROUTES_JSON_PATH} not found — routes will fail")


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


class RegisterRequest(BaseModel):
    email: str
    password: str


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


# ---------- Routes (from precomputed JSON) ----------
def haversine_nm(lat1, lon1, lat2, lon2):
    R = 3440.065
    la1, lo1, la2, lo2 = map(math.radians, [lat1, lon1, lat2, lon2])
    a = (math.sin((la2 - la1) / 2) ** 2
         + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(a))


def route_distance_nm(wps):
    return sum(haversine_nm(wps[i][0], wps[i][1], wps[i + 1][0], wps[i + 1][1])
               for i in range(len(wps) - 1))


def build_route(origin, destination, route_name):
    if route_name not in ("Direct", "Northern", "Southern"):
        raise HTTPException(400, "route_name must be Direct, Northern or Southern")
    a, b = sorted((origin, destination))
    key = f"{a}__{b}"
    if key not in PRECOMPUTED:
        raise HTTPException(500, f"No precomputed route for {a} ↔ {b}")
    pair = PRECOMPUTED[key]
    pts = pair[route_name]
    return pts if origin == a else pts[::-1]


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