import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './VoyageSimulator.css';

/* ---------- Geo helpers ---------- */
const toRad = (d) => (d * Math.PI) / 180;

function haversine(lat1, lon1, lat2, lon2) {
  const R = 3440.065;
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function bearing(lat1, lon1, lat2, lon2) {
  const φ1 = toRad(lat1), φ2 = toRad(lat2), Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function formatDuration(hours) {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const d = Math.floor(hours / 24);
  const h = Math.floor(hours % 24);
  const m = Math.round((hours % 1) * 60);
  if (d > 0) return `${d}d ${h}h`;
  return `${h}h ${m}m`;
}

/* ---------- Segment preprocessing ---------- */
function buildSegments(waypoints) {
  const segs = [];
  let cum = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const [lat1, lon1] = waypoints[i];
    const [lat2, lon2] = waypoints[i + 1];
    const d = haversine(lat1, lon1, lat2, lon2);
    const b = bearing(lat1, lon1, lat2, lon2);
    segs.push({ a: waypoints[i], b: waypoints[i + 1], dist: d, bearing: b, cum });
    cum += d;
  }
  return { segs, total: cum };
}

/* ---------- Rotating ship marker ---------- */
function ShipMarker({ position, bearingDeg }) {
  const markerRef = useRef(null);
  const icon = useMemo(
    () =>
      L.divIcon({
        className: 'sim-ship-marker',
        html: `<div class="sim-ship-icon" style="transform: rotate(${bearingDeg}deg);">
          <svg viewBox="0 0 24 24" width="28" height="28">
            <path d="M12 2.5 L19 20 L12 17 L5 20 Z"
              fill="#0284c7" stroke="white" stroke-width="1.4" stroke-linejoin="round"/>
          </svg>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
    [bearingDeg]
  );
  return <Marker ref={markerRef} position={position} icon={icon} />;
}

/* ---------- Auto-follow helper ---------- */
function MapFollow({ position, enabled }) {
  const mapRef = useRef(null);
  // Grab map instance
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  // Pan at 2fps for smoothness
  useEffect(() => {
    if (!enabled || !position) return;
    const el = document.querySelector('.sim-map-container .leaflet-container');
    if (!el) return;
    // We can't access the map instance directly, so use CSS trick — alternate:
    // use the leafletMapRef passed from parent
  }, [position, enabled]);

  return null;
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */
const BASE_DURATION_MS = 45000; // 1x = 45 seconds

export default function VoyageSimulator({ route, origin, destination, ports, onClose }) {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speedMult, setSpeedMult] = useState(1);
  const [mapInstance, setMapInstance] = useState(null);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);

  // Precompute route geometry
  const { segs, total } = useMemo(() => buildSegments(route.waypoints), [route.waypoints]);

  // Look up port markers
  const oPort = ports?.find((p) => p.name === origin);
  const dPort = ports?.find((p) => p.name === destination);

  // ESC closes
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Animation loop
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const totalMs = BASE_DURATION_MS / speedMult;
    const initialProgress = progress;
    startTimeRef.current = performance.now() - initialProgress * totalMs;

    const tick = (now) => {
      const p = Math.min(1, (now - startTimeRef.current) / totalMs);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setPlaying(false);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speedMult]);

  // Derive current position + nav data from progress
  const nav = useMemo(() => {
    const traveled = progress * total;
    let idx = 0;
    for (let i = 0; i < segs.length; i++) {
      if (segs[i].cum + segs[i].dist >= traveled) { idx = i; break; }
      if (i === segs.length - 1) idx = i;
    }
    const s = segs[idx] || { a: route.waypoints[0], b: route.waypoints[0], dist: 0, bearing: 0, cum: 0 };
    const within = s.dist > 0 ? (traveled - s.cum) / s.dist : 0;
    const lat = s.a[0] + (s.b[0] - s.a[0]) * within;
    const lon = s.a[1] + (s.b[1] - s.a[1]) * within;
    const distToNext = Math.max(0, (s.cum + s.dist) - traveled);
    const distRemaining = Math.max(0, total - traveled);
    const hoursToNext = route.speed_kn > 0 ? distToNext / route.speed_kn : 0;
    const hoursRemaining = route.speed_kn > 0 ? distRemaining / route.speed_kn : 0;
    return {
      lat, lon,
      heading: s.bearing,
      sog: route.speed_kn,
      cog: s.bearing,
      distToNext, distRemaining,
      hoursToNext, hoursRemaining,
      waypointIdx: idx,
    };
  }, [progress, segs, total, route]);

  // Auto-pan map (throttled to 2fps)
  useEffect(() => {
    if (!mapInstance) return;
    const id = setInterval(() => {
      if (mapInstance) {
        mapInstance.panTo([nav.lat, nav.lon], { animate: true, duration: 0.5 });
      }
    }, 500);
    return () => clearInterval(id);
  }, [mapInstance, nav.lat, nav.lon]);

  // Traveled polyline (from route start to ship)
  const traveledPolyline = useMemo(() => {
    const pts = route.waypoints.slice(0, nav.waypointIdx + 1);
    pts.push([nav.lat, nav.lon]);
    return pts;
  }, [route.waypoints, nav.waypointIdx, nav.lat, nav.lon]);

  const center = oPort && dPort
    ? [(oPort.lat + dPort.lat) / 2, (oPort.lon + dPort.lon) / 2]
    : [12, 80];

  const reset = () => {
    setProgress(0);
    setPlaying(true);
  };

  return (
    <div className="sim-overlay">
      {/* MAP */}
      <div className="sim-map-container">
        <MapContainer
          center={center}
          zoom={4}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
          ref={setMapInstance}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
          />
          {/* Full route (dim) */}
          <Polyline
            positions={route.waypoints}
            pathOptions={{ color: route.color, weight: 3, opacity: 0.28, dashArray: '6,8' }}
          />
          {/* Traveled portion (bright) */}
          <Polyline
            positions={traveledPolyline}
            pathOptions={{ color: route.color, weight: 5, opacity: 0.95 }}
          />
          {/* Ship marker */}
          <ShipMarker position={[nav.lat, nav.lon]} bearingDeg={nav.heading} />
        </MapContainer>
      </div>

      {/* TOP BAR */}
      <div className="sim-top-bar">
        <button className="sim-close" onClick={onClose} aria-label="Close simulation">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
          <span>Exit</span>
        </button>

        <div className="sim-route-badge">
          <span className="sim-route-dot" style={{ background: route.color }}></span>
          <span className="sim-route-label">{route.name}</span>
          <span className="sim-route-route">{origin} → {destination}</span>
        </div>

        <div className="sim-speed-controls">
          {[1, 2, 4].map((s) => (
            <button
              key={s}
              className={`sim-speed-btn ${speedMult === s ? 'active' : ''}`}
              onClick={() => setSpeedMult(s)}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* COMPASS HUD (top-left below top bar) */}
      <div className="sim-compass-card">
        <div className="sim-compass-heading">{Math.round(nav.heading).toString().padStart(3, '0')}°</div>
        <svg viewBox="0 0 200 200" className="sim-compass-svg">
          <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.15" />
          <circle cx="100" cy="100" r="82" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.25" />
          {/* cardinal ticks */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const rad = (deg - 90) * Math.PI / 180;
            const isCardinal = deg % 90 === 0;
            const r1 = isCardinal ? 74 : 78;
            const r2 = 82;
            return (
              <line
                key={deg}
                x1={100 + r1 * Math.cos(rad)}
                y1={100 + r1 * Math.sin(rad)}
                x2={100 + r2 * Math.cos(rad)}
                y2={100 + r2 * Math.sin(rad)}
                stroke="currentColor"
                strokeWidth={isCardinal ? 2 : 1}
                opacity={isCardinal ? 0.5 : 0.25}
              />
            );
          })}
          {/* cardinal labels */}
          <text x="100" y="34" textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor" opacity="0.85">N</text>
          <text x="170" y="105" textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor" opacity="0.5">E</text>
          <text x="100" y="178" textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor" opacity="0.5">S</text>
          <text x="30" y="105" textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor" opacity="0.5">W</text>
          {/* rotating needle */}
          <g
            style={{
              transform: `rotate(${nav.heading}deg)`,
              transformOrigin: '100px 100px',
              transition: 'transform 0.3s ease',
            }}
          >
            <polygon points="100,26 108,100 100,94 92,100" fill="var(--primary)" />
            <polygon points="100,174 108,100 100,106 92,100" fill="currentColor" opacity="0.35" />
          </g>
          <circle cx="100" cy="100" r="5" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        </svg>
      </div>

      {/* NAV DATA HUD (bottom-right) */}
      <div className="sim-data-card">
        <div className="sim-data-row sim-data-primary">
          <div>
            <div className="sim-data-label">SOG</div>
            <div className="sim-data-value">{nav.sog.toFixed(1)}<span className="sim-data-unit">kn</span></div>
          </div>
          <div>
            <div className="sim-data-label">COG</div>
            <div className="sim-data-value">{Math.round(nav.cog).toString().padStart(3, '0')}<span className="sim-data-unit">°</span></div>
          </div>
        </div>
        <div className="sim-data-row sim-data-secondary">
          <div>
            <div className="sim-data-label">Next waypoint</div>
            <div className="sim-data-value-sm">{nav.distToNext.toFixed(1)} nm</div>
          </div>
          <div>
            <div className="sim-data-label">In</div>
            <div className="sim-data-value-sm">{formatDuration(nav.hoursToNext)}</div>
          </div>
        </div>
        <div className="sim-data-row sim-data-secondary">
          <div>
            <div className="sim-data-label">Remaining</div>
            <div className="sim-data-value-sm">{nav.distRemaining.toFixed(0)} nm</div>
          </div>
          <div>
            <div className="sim-data-label">ETA</div>
            <div className="sim-data-value-sm">{formatDuration(nav.hoursRemaining)}</div>
          </div>
        </div>
      </div>

      {/* PLAYBACK CONTROLS + PROGRESS (bottom) */}
      <div className="sim-playback">
        <button className="sim-play-btn" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <button className="sim-reset-btn" onClick={reset} aria-label="Reset">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>

        <div className="sim-progress-wrap">
          <div className="sim-progress-labels">
            <span>{origin}</span>
            <span>{Math.round(progress * 100)}%</span>
            <span>{destination}</span>
          </div>
          <div className="sim-progress-track">
            <div className="sim-progress-fill" style={{ width: `${progress * 100}%`, background: route.color }} />
            {route.waypoints.map((_, i) => {
              const pct = (i / (route.waypoints.length - 1)) * 100;
              return (
                <div key={i} className="sim-progress-tick" style={{ left: `${pct}%` }} />
              );
            })}
            <div className="sim-progress-ship" style={{ left: `${progress * 100}%`, background: route.color }} />
          </div>
        </div>
      </div>
    </div>
  );
}