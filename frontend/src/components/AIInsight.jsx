import { useEffect, useState } from 'react';
import './AIInsight.css';

/* ---------- Tiny helper for phrasing variety (feels more AI-like) ---------- */
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ---------- The analysis engine ---------- */
function analyzeRoutes(routes, selected) {
  if (!routes || routes.length < 2) return null;

  const others = routes.filter((r) => r.name !== selected.name);

  // Compute "best" per axis
  const cheapest = routes.reduce((a, b) => (a.fuel_tons <= b.fuel_tons ? a : b));
  const fastest = routes.reduce((a, b) => (a.days <= b.days ? a : b));
  const greenest = routes.reduce((a, b) => (a.co2_tons <= b.co2_tons ? a : b));
  const shortest = routes.reduce((a, b) => (a.distance_nm <= b.distance_nm ? a : b));

  const isBest = (axis) => {
    if (axis === 'fuel') return selected.name === cheapest.name;
    if (axis === 'time') return selected.name === fastest.name;
    if (axis === 'co2') return selected.name === greenest.name;
    if (axis === 'distance') return selected.name === shortest.name;
    return false;
  };

  const wins = [];
  const tradeoffs = [];

  // ---- FUEL ----
  if (isBest('fuel')) {
    const savings = others.reduce((s, r) => s + r.fuel_tons, 0) / others.length - selected.fuel_tons;
    wins.push({
      icon: '⛽',
      text: `Lowest fuel burn at ${selected.fuel_tons}t — saves ${savings.toFixed(1)}t vs the other options on average`,
    });
  } else {
    const delta = selected.fuel_tons - cheapest.fuel_tons;
    tradeoffs.push({
      icon: '⛽',
      text: `Burns ${delta.toFixed(1)}t more fuel than ${cheapest.name} (${((delta / cheapest.fuel_tons) * 100).toFixed(1)}% higher)`,
    });
  }

  // ---- TIME ----
  if (isBest('time')) {
    const savings = others.reduce((s, r) => s + r.days, 0) / others.length - selected.days;
    wins.push({
      icon: '⏱️',
      text: `Fastest arrival at ${selected.days} days — ${savings.toFixed(2)} days sooner than average`,
    });
  } else {
    const delta = selected.days - fastest.days;
    tradeoffs.push({
      icon: '⏱️',
      text: `Arrives ${delta.toFixed(2)} days later than ${fastest.name} — schedule slip for fuel or path gains`,
    });
  }

  // ---- CO₂ ----
  if (isBest('co2')) {
    wins.push({
      icon: '🌫️',
      text: `Cleanest emissions at ${selected.co2_tons}t CO₂ — best for IMO CII compliance and carbon reporting`,
    });
  } else {
    const delta = selected.co2_tons - greenest.co2_tons;
    tradeoffs.push({
      icon: '🌫️',
      text: `Emits ${delta.toFixed(0)}t more CO₂ than ${greenest.name}`,
    });
  }

  // ---- DISTANCE ----
  if (isBest('distance')) {
    wins.push({
      icon: '📏',
      text: `Shortest track at ${selected.distance_nm} nm — least waypoint load and lowest navigational exposure`,
    });
  } else if (selected.distance_nm > shortest.distance_nm + 50) {
    const delta = selected.distance_nm - shortest.distance_nm;
    tradeoffs.push({
      icon: '📏',
      text: `Adds ${delta.toFixed(0)} nm of extra track vs ${shortest.name} — a wider swing for marginal geometry gains`,
    });
  }

  // ---- VERDICT ----
  let verdict, verdictType, bestFor;
  const isEcon = isBest('fuel') && isBest('co2');
  const isSpeed = isBest('time');
  const isShort = isBest('distance');

  if (isEcon) {
    verdict = 'Economy Pick';
    verdictType = 'economy';
    bestFor = pick([
      'cost-sensitive voyages where schedule can flex by a day or two. Especially useful when fuel prices spike or bunker supply is tight.',
      'operators optimizing voyage P&L and carbon exposure simultaneously. Ideal for bulk cargo with flexible delivery windows.',
    ]);
  } else if (isSpeed) {
    verdict = 'Speed Pick';
    verdictType = 'speed';
    bestFor = pick([
      'time-critical cargo — perishables, just-in-time manufacturing inputs, or contract windows with hard delivery dates.',
      'schedules where late arrival triggers demurrage or port slot loss. Accept the fuel premium for arrival certainty.',
    ]);
  } else if (isShort) {
    verdict = 'Direct Route';
    verdictType = 'balanced';
    bestFor = pick([
      'voyages where total track length matters more than fuel curve — typically short passages or congested corridors.',
      'captains who prefer the most predictable geometry and fewest heading changes.',
    ]);
  } else {
    verdict = 'Balanced Pick';
    verdictType = 'balanced';
    bestFor = pick([
      'typical commercial voyages where both cost and schedule matter. Minimizes regret when the trade-off is uncertain.',
      'a middle-ground option when the operator is hedging between fuel budget and delivery window.',
    ]);
  }

  // ---- VS OTHERS (one line per alternative) ----
  const vsOthers = others.map((other) => {
    const fuelDelta = selected.fuel_tons - other.fuel_tons;
    const timeDelta = selected.days - other.days;

    let text;
    let outcome = 'neutral';

    if (fuelDelta < -1 && timeDelta < -0.05) {
      text = `Strictly beats ${other.name} on both fuel (−${Math.abs(fuelDelta).toFixed(1)}t) and time (−${Math.abs(timeDelta).toFixed(2)} days).`;
      outcome = 'better';
    } else if (fuelDelta > 1 && timeDelta > 0.05) {
      text = `${other.name} dominates on both axes — you burn ${fuelDelta.toFixed(1)}t more fuel and arrive ${timeDelta.toFixed(2)} days later.`;
      outcome = 'worse';
    } else if (fuelDelta < -1) {
      text = `Saves ${Math.abs(fuelDelta).toFixed(1)}t fuel vs ${other.name}, at the cost of ${timeDelta.toFixed(2)} extra days.`;
      outcome = 'tradeoff';
    } else if (timeDelta < -0.05) {
      text = `Arrives ${Math.abs(timeDelta).toFixed(2)} days sooner than ${other.name}, using ${fuelDelta.toFixed(1)}t extra fuel.`;
      outcome = 'tradeoff';
    } else {
      text = `Nearly identical to ${other.name} on this corridor — the choice is effectively a tie.`;
      outcome = 'tie';
    }
    return { route: other.name, text, outcome };
  });

  return { wins, tradeoffs, verdict, verdictType, bestFor, vsOthers };
}

/* ---------- Main component ---------- */
export default function AIInsight({ routes, selected, onSelect, onClose }) {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);

  // Re-analyze when the user switches routes
  useEffect(() => {
    setLoading(true);
    setAnalysis(null);
    const t = setTimeout(() => {
      setAnalysis(analyzeRoutes(routes, selected));
      setLoading(false);
    }, 650);
    return () => clearTimeout(t);
  }, [selected.name, routes]);

  // ESC to close
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="ai-backdrop" onClick={onClose}>
      <div className="ai-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ai-header">
          <div className="ai-header-left">
            <div className="ai-avatar">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1l2.1-2.1M17 7l2.1-2.1" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div>
              <div className="ai-title">Route Analyst</div>
              <div className="ai-subtitle">AI-powered voyage comparison</div>
            </div>
          </div>
          <button className="ai-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Route tabs */}
        <div className="ai-tabs">
          {routes.map((r) => (
            <button
              key={r.name}
              className={`ai-tab ${r.name === selected.name ? 'active' : ''}`}
              onClick={() => onSelect(r)}
            >
              <span className="ai-tab-dot" style={{ background: r.color }}></span>
              {r.name.replace(/\s*\(.*?\)/, '')}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="ai-body">
          {loading && (
            <div className="ai-loading">
              <div className="ai-loading-dots">
                <span></span><span></span><span></span>
              </div>
              <p>Analyzing voyage parameters…</p>
            </div>
          )}

          {!loading && analysis && (
            <>
              {/* Route being analyzed */}
              <div className="ai-route-context">
                <span className="ai-route-dot" style={{ background: selected.color }}></span>
                <span className="ai-route-name">{selected.name}</span>
                <span className="ai-route-meta">
                  {selected.distance_nm} nm · {selected.days}d · {selected.fuel_tons}t fuel
                </span>
              </div>

              {/* Verdict badge */}
              <div className={`ai-verdict ai-verdict-${analysis.verdictType}`}>
                <div className="ai-verdict-badge">
                  {analysis.verdictType === 'economy' && '💰'}
                  {analysis.verdictType === 'speed' && '⚡'}
                  {analysis.verdictType === 'balanced' && '⚖️'}
                  {' '}{analysis.verdict}
                </div>
                <p className="ai-verdict-line">
                  <strong>Best for:</strong> {analysis.bestFor}
                </p>
              </div>

              {/* Wins */}
              {analysis.wins.length > 0 && (
                <div className="ai-section">
                  <div className="ai-section-title">
                    <span className="ai-section-pill ai-section-pill-green">✓ Wins on</span>
                  </div>
                  <ul className="ai-list">
                    {analysis.wins.map((w, i) => (
                      <li key={i}>
                        <span className="ai-list-icon">{w.icon}</span>
                        <span>{w.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Trade-offs */}
              {analysis.tradeoffs.length > 0 && (
                <div className="ai-section">
                  <div className="ai-section-title">
                    <span className="ai-section-pill ai-section-pill-amber">⚠ Trade-offs</span>
                  </div>
                  <ul className="ai-list">
                    {analysis.tradeoffs.map((t, i) => (
                      <li key={i}>
                        <span className="ai-list-icon">{t.icon}</span>
                        <span>{t.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Head-to-head vs other routes */}
              <div className="ai-section">
                <div className="ai-section-title">
                  <span className="ai-section-pill ai-section-pill-blue">⚔ Head-to-head</span>
                </div>
                <div className="ai-vs-list">
                  {analysis.vsOthers.map((v, i) => (
                    <div key={i} className={`ai-vs ai-vs-${v.outcome}`}>
                      <span className="ai-vs-route">vs {v.route}</span>
                      <p>{v.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer action */}
              <div className="ai-footer">
                <div className="ai-footer-note">
                  Analysis is generated from route metrics — fuel curve, speed law, and land-safe geometry.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}