import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-velocity/dist/leaflet-velocity.css';
import 'leaflet-velocity/dist/leaflet-velocity';

// ⚠️ REPLACE WITH YOUR OWN KEY FROM openweathermap.org
const OWM_API_KEY = 'c387511366f2d5e041534c4397868669';
const WIND_DATA_URL = 'https://onaci.github.io/leaflet-velocity/wind-global.json';

// Cache the wind JSON globally so we fetch it once per page load
let _windCachePromise = null;
function getWindData() {
  if (!_windCachePromise) {
    _windCachePromise = fetch(WIND_DATA_URL)
      .then((r) => r.json())
      .catch((e) => {
        console.error('Failed to load wind data:', e);
        return null;
      });
  }
  return _windCachePromise;
}

const createDotIcon = (color) =>
  L.divIcon({
    className: 'custom-dot',
    html: `<div style="width:18px;height:18px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

const PORT_COLORS = {
  origin: '#10b981',
  destination: '#ef4444',
  neutral: '#64748b',
};

/* ---------- Custom pane setup (so weather tiles escape the dark filter) ---------- */
function PaneSetup() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane('baseTiles')) map.createPane('baseTiles');
    if (!map.getPane('weatherTiles')) map.createPane('weatherTiles');
    map.getPane('baseTiles').style.zIndex = 200;
    map.getPane('weatherTiles').style.zIndex = 250;
    map.getPane('baseTiles').style.pointerEvents = 'none';
    map.getPane('weatherTiles').style.pointerEvents = 'none';
  }, [map]);
  return null;
}

/* ---------- Wind particle layer ---------- */
function WindLayer({ enabled }) {
  const map = useMap();
  const layerRef = useRef(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    getWindData().then((d) => { if (d) setData(d); });
  }, []);

  useEffect(() => {
    if (!map) return;
    // Tear down previous
    if (layerRef.current) {
      try { map.removeLayer(layerRef.current); } catch {}
      layerRef.current = null;
    }
    if (!enabled || !data) return;

    const layer = L.velocityLayer({
      displayValues: false,
      data,
      maxVelocity: 25,
      colorScale: [
        '#3b82f6', '#60a5fa', '#a5b4fc', '#67e8f9',
        '#6ee7b7', '#fde68a', '#fca5a5', '#f87171',
      ],
      lineWidth: 1.2,
      particleMultiplier: 1 / 450,
      frameRate: 15,
      particleAge: 90,
    });
    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      if (layerRef.current) {
        try { map.removeLayer(layerRef.current); } catch {}
        layerRef.current = null;
      }
    };
  }, [enabled, data, map]);

  return null;
}

/* ---------- Main component ---------- */
export default function MapView({ ports, routes, origin, destination }) {
  const [showTemp, setShowTemp] = useState(false);
  const [showPrecip, setShowPrecip] = useState(false);
  const [showWind, setShowWind] = useState(false);
  const [windLoading, setWindLoading] = useState(true);

  useEffect(() => {
    getWindData().then(() => setWindLoading(false));
  }, []);

  const oPort = ports.find((p) => p.name === origin);
  const dPort = ports.find((p) => p.name === destination);
  const center = oPort && dPort
    ? [(oPort.lat + dPort.lat) / 2, (oPort.lon + dPort.lon) / 2]
    : [12, 80];

  const getColor = (name) =>
    name === origin ? PORT_COLORS.origin
    : name === destination ? PORT_COLORS.destination
    : PORT_COLORS.neutral;

  return (
    <div style={{ position: 'relative' }}>
      <MapContainer
        center={center}
        zoom={4}
        style={{ height: '500px', width: '100%' }}
        scrollWheelZoom={false}
      >
        <PaneSetup />

        {/* Base map — filtered in dark mode */}
        <TileLayer
          pane="baseTiles"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />

        {/* Weather tiles — NOT filtered, natural colors preserved */}
        {showTemp && OWM_API_KEY !== 'YOUR_OPENWEATHERMAP_API_KEY' && (
          <TileLayer
            pane="weatherTiles"
            url={`https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`}
            attribution='&copy; OpenWeatherMap'
            opacity={0.7}
          />
        )}
        {showPrecip && OWM_API_KEY !== 'YOUR_OPENWEATHERMAP_API_KEY' && (
          <TileLayer
            pane="weatherTiles"
            url={`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`}
            attribution='&copy; OpenWeatherMap'
            opacity={0.6}
          />
        )}

        {/* Wind particles rendered in overlay pane */}
        <WindLayer enabled={showWind} />

        {/* Ports + routes always on top */}
        {ports.map((p) => (
          <Marker key={p.name} position={[p.lat, p.lon]} icon={createDotIcon(getColor(p.name))}>
            <Popup>
              <strong>{p.name}</strong>
              <br />
              {p.lat.toFixed(2)}°, {p.lon.toFixed(2)}°
            </Popup>
          </Marker>
        ))}
        {routes.map((r, i) => (
          <Polyline
            key={i}
            positions={r.waypoints}
            pathOptions={{ color: r.color, weight: 4, opacity: 0.85 }}
          />
        ))}
      </MapContainer>

      {/* CUSTOM LAYER CONTROL */}
      <div className="map-layer-controls">
        <div className="map-layer-controls-title">Weather Layers</div>

        <label className="map-layer-option">
          <input
            type="checkbox"
            checked={showTemp}
            onChange={(e) => setShowTemp(e.target.checked)}
          />
          <span>🌡️ Temperature</span>
        </label>

        <label className="map-layer-option">
          <input
            type="checkbox"
            checked={showPrecip}
            onChange={(e) => setShowPrecip(e.target.checked)}
          />
          <span>🌧️ Precipitation</span>
        </label>

        <label className="map-layer-option" style={{ opacity: windLoading ? 0.55 : 1 }}>
          <input
            type="checkbox"
            checked={showWind}
            onChange={(e) => setShowWind(e.target.checked)}
            disabled={windLoading}
          />
          <span>
            💨 Wind {windLoading && <small>(loading…)</small>}
          </span>
        </label>

        {OWM_API_KEY === 'YOUR_OPENWEATHERMAP_API_KEY' && (
          <div className="map-layer-hint">
            Add your OpenWeatherMap key to enable temperature & precipitation.
          </div>
        )}
      </div>
    </div>
  );
}