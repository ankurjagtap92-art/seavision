import { useEffect, useState } from 'react';
import api from '../api';
import MapView from '../components/MapView';
import VoyageSimulator from '../components/VoyageSimulator';
import AIInsight from '../components/AIInsight';

export default function Planner() {
  const [ports, setPorts] = useState([]);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [simRoute, setSimRoute] = useState(null);
  const [aiRoute, setAiRoute] = useState(null);   // ← MOVED inside the component

  useEffect(() => {
    api.get('/ports').then((r) => {
      setPorts(r.data);
      if (r.data.length >= 2) {
        setOrigin(r.data[0].name);
        setDestination(r.data[r.data.length - 1].name);
      }
    });
  }, []);

  const generate = async () => {
    setErr('');
    setLoading(true);
    try {
      const res = await api.get('/routes', { params: { origin, destination } });
      setRoutes(res.data.routes);
    } catch (ex) {
      setErr(ex.response?.data?.detail || 'Failed to generate routes');
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = async (route) => {
    try {
      const res = await api.get('/routes/download', {
        params: { origin, destination, route_name: route.name.split(' ')[0] },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${origin}_to_${destination}_${route.name.split(' ')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (ex) {
      alert('Download failed: ' + (ex.response?.data?.detail || ex.message));
    }
  };

  return (
    <div className="container">
      <div className="page-header">
        <h2>Route Planner</h2>
        <p>Choose two ports and generate three optimized voyage options</p>
      </div>

      <div className="card">
        <div className="planner-controls">
          <div className="field">
            <label>Origin Port</label>
            <select value={origin} onChange={(e) => setOrigin(e.target.value)}>
              {ports.map((p) => (
                <option key={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Destination Port</label>
            <select value={destination} onChange={(e) => setDestination(e.target.value)}>
              {ports.map((p) => (
                <option key={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
          <button
            className="btn"
            onClick={generate}
            disabled={loading || !origin || !destination || origin === destination}
          >
            {loading ? (
              <>
                <span className="spinner"></span> Generating…
              </>
            ) : (
              'Generate Routes'
            )}
          </button>
        </div>
        {err && <div className="error">{err}</div>}
      </div>

      {ports.length > 0 && (
        <div className="map-wrapper">
          <MapView ports={ports} routes={routes} origin={origin} destination={destination} />
          {routes.length > 0 && (
            <div className="map-legend">
              {routes.map((r) => (
                <div key={r.name} className="legend-item">
                  <div className="legend-dot" style={{ background: r.color }}></div>
                  {r.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && routes.length === 0 && (
        <div className="loading-box">
          <div className="big-spinner"></div>
          Computing optimal routes…
        </div>
      )}

      {routes.length > 0 && (
        <>
          <h3 style={{ marginBottom: 16 }}>Route Options</h3>
          <div className="grid-3">
            {routes.map((r) => {
              const isRecommended = r.name.toLowerCase().includes('cheap');
              return (
                <div key={r.name} className="route-card" style={{ borderLeftColor: r.color }}>
                  {isRecommended && <span className="route-badge">Recommended</span>}
                  <div className="route-header">
                    <div className="route-color-dot" style={{ background: r.color }}></div>
                    <h3>{r.name.replace(/\s*\(.*?\)/, '')}</h3>
                  </div>
                  <div className="route-stats">
                    <div className="route-stat">
                      <span className="label">Distance</span>
                      <span className="value">{r.distance_nm} nm</span>
                    </div>
                    <div className="route-stat">
                      <span className="label">Duration</span>
                      <span className="value">{r.days} days</span>
                    </div>
                    <div className="route-stat">
                      <span className="label">Speed</span>
                      <span className="value">{r.speed_kn} kn</span>
                    </div>
                    <div className="route-stat">
                      <span className="label">Fuel</span>
                      <span className="value">{r.fuel_tons} t</span>
                    </div>
                    <div className="route-stat">
                      <span className="label">CO₂</span>
                      <span className="value">{r.co2_tons} t</span>
                    </div>
                    <div className="route-stat">
                      <span className="label">Waypoints</span>
                      <span className="value">{r.waypoints.length}</span>
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary btn-block"
                    onClick={() => setAiRoute(r)}
                  >
                    🤖 Ask AI Why
                  </button>

                  <button
                    className="btn btn-secondary btn-block"
                    onClick={() => setSimRoute(r)}
                  >
                    ▶ Simulate Voyage
                  </button>

                  <button className="btn btn-block" onClick={() => downloadCSV(r)}>
                    ⬇ Download CSV
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* MODALS — rendered independently, not nested */}
      {simRoute && (
        <VoyageSimulator
          route={simRoute}
          origin={origin}
          destination={destination}
          ports={ports}
          onClose={() => setSimRoute(null)}
        />
      )}

      {aiRoute && (
        <AIInsight
          routes={routes}
          selected={aiRoute}
          onSelect={setAiRoute}
          onClose={() => setAiRoute(null)}
        />
      )}
    </div>
  );
}