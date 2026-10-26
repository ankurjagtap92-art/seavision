import './Landing.css';
import OceanCurrents from '../components/OceanCurrents';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import './Landing.css';

/* ---------- Utilities ---------- */
function useReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('reveal-on');
      }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.reveal').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

function useCountUp(target, duration = 1400) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const tick = (now) => {
          const p = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setVal(target * eased);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.4 });
    obs.observe(node);
    return () => obs.disconnect();
  }, [target, duration]);
  return [val, ref];
}

/* ---------- Small components ---------- */
function Stat({ value, suffix = '', prefix = '', label }) {
  const [val, ref] = useCountUp(value);
  return (
    <div className="lp-stat reveal">
      <div ref={ref} className="lp-stat-value">{prefix}{Math.round(val)}{suffix}</div>
      <div className="lp-stat-label">{label}</div>
    </div>
  );
}

function Formula({ icon, title, formula, desc }) {
  return (
    <div className="lp-formula reveal">
      <div className="lp-formula-icon">{icon}</div>
      <h4>{title}</h4>
      <div className="lp-formula-code">{formula}</div>
      <p>{desc}</p>
    </div>
  );
}

function Feature({ icon, title, desc, color = 'primary' }) {
  return (
    <div className="lp-feature reveal">
      <div className={`lp-feature-icon lp-feature-icon-${color}`}>{icon}</div>
      <h4>{title}</h4>
      <p>{desc}</p>
    </div>
  );
}

/* ---------- Main ---------- */
export default function Landing() {
  const navigate = useNavigate();
  const isAuthed = !!localStorage.getItem('token');
  const launchTarget = isAuthed ? '/dashboard' : '/login';
  useReveal();

  return (
    <div className="landing">
        <OceanCurrents />
      {/* ============ NAVBAR ============ */}
      <nav className="lp-nav">
        <Link to="/" className="lp-nav-brand">
          <div className="lp-nav-logo">
            <svg viewBox="0 0 40 40" fill="none">
              <path d="M4 26c4-3 8-3 12 0s8 3 12 0 8-3 8-3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M4 18c4-3 8-3 12 0s8 3 12 0 8-3 8-3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
              <path d="M4 10c4-3 8-3 12 0s8 3 12 0 8-3 8-3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
            </svg>
          </div>
          <span>SeaVision</span>
        </Link>
        <div className="lp-nav-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#tech">Under the hood</a>
          <a href="#ports">Ports</a>
        </div>
        <div className="lp-nav-actions">
          <ThemeToggle />
          {!isAuthed && <Link to="/login" className="lp-nav-login">Sign in</Link>}
          <button className="lp-btn-primary lp-btn-sm" onClick={() => navigate(launchTarget)}>
            Launch Platform
          </button>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <section className="lp-hero">
        <div className="lp-hero-bg-grid"></div>
        <div className="lp-hero-inner">
          <div className="lp-hero-left">
            <div className="lp-hero-pill">
              <span className="lp-hero-pill-dot"></span>
              Now in public prototype
            </div>
            <h1 className="lp-hero-title">
              Maritime routing,<br />
              <span className="lp-hero-accent">finally within reach.</span>
            </h1>
            <p className="lp-hero-sub">
              Enterprise voyage optimization was priced at $50,000 per ship per year —
              out of reach for 60% of the industry. SeaVision brings multi-objective
              route planning, land-safe pathfinding, and CO₂ transparency to every
              operator, at a fraction of the cost.
            </p>
            <div className="lp-hero-actions">
              <button className="lp-btn-primary lp-btn-lg" onClick={() => navigate(launchTarget)}>
                Launch Platform
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
              <a href="#tech" className="lp-btn-secondary lp-btn-lg">See how it works</a>
            </div>
            <div className="lp-hero-trust">
              <div><strong>90%</strong> of world trade by sea</div>
              <span className="lp-dot"></span>
              <div><strong>3 routes</strong> per voyage</div>
              <span className="lp-dot"></span>
              <div><strong>Land-safe</strong> A* routing</div>
            </div>
          </div>

          {/* Product preview card */}
          <div className="lp-hero-right">
            <div className="lp-preview">
              <div className="lp-preview-bar">
                <span className="lp-preview-dot" style={{ background: '#ef4444' }}></span>
                <span className="lp-preview-dot" style={{ background: '#f59e0b' }}></span>
                <span className="lp-preview-dot" style={{ background: '#10b981' }}></span>
                <div className="lp-preview-url">seavision.app/planner</div>
              </div>
              <div className="lp-preview-map">
                <svg viewBox="0 0 400 240" className="lp-preview-map-svg">
                  <defs>
                    <linearGradient id="seaGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.1" />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.03" />
                    </linearGradient>
                  </defs>
                  <rect width="400" height="240" fill="url(#seaGrad)" />
                  <path d="M120,40 Q160,90 130,140 Q110,180 160,200" fill="none" stroke="var(--text-subtle)" strokeWidth="1.5" strokeDasharray="3,3" opacity="0.4" />
                  <path d="M0,60 Q60,80 40,140 Q30,200 80,240" fill="none" stroke="var(--text-subtle)" strokeWidth="1.5" strokeDasharray="3,3" opacity="0.3" />
                  <circle cx="60" cy="80" r="5" fill="var(--route-direct)" />
                  <circle cx="340" cy="180" r="5" fill="var(--route-northern)" />
                  <path d="M60,80 Q140,110 220,140 Q280,160 340,180" fill="none" stroke="var(--route-direct)" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M60,80 Q160,60 240,110 Q300,140 340,180" fill="none" stroke="var(--route-northern)" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
                  <path d="M60,80 Q120,160 200,180 Q280,200 340,180" fill="none" stroke="var(--route-southern)" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
                </svg>
                <div className="lp-preview-legend">
                  <div><span style={{ background: 'var(--route-direct)' }}></span>Direct</div>
                  <div><span style={{ background: 'var(--route-northern)' }}></span>Northern</div>
                  <div><span style={{ background: 'var(--route-southern)' }}></span>Southern</div>
                </div>
              </div>
              <div className="lp-preview-cards">
                <div className="lp-preview-card" style={{ borderLeftColor: 'var(--route-direct)' }}>
                  <div className="lp-preview-card-name">Direct</div>
                  <div className="lp-preview-card-metric">14.0 kn · 5.2 days</div>
                </div>
                <div className="lp-preview-card" style={{ borderLeftColor: 'var(--route-northern)' }}>
                  <div className="lp-preview-card-name">Northern</div>
                  <div className="lp-preview-card-metric">12.0 kn · 6.4 days</div>
                </div>
                <div className="lp-preview-card" style={{ borderLeftColor: 'var(--route-southern)' }}>
                  <div className="lp-preview-card-name">Southern</div>
                  <div className="lp-preview-card-metric">13.0 kn · 5.8 days</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ STATS BAR ============ */}
      <section className="lp-stats-bar">
        <div className="lp-stats-inner">
          <Stat value={90} suffix="%" label="of world trade moves by sea" />
          <Stat value={15} prefix="$" suffix="B" label="weather-related losses annually" />
          <Stat value={20} suffix="%" label="fuel wasted on suboptimal routing" />
          <Stat value={50} prefix="$" suffix="K" label="enterprise tools per ship/year" />
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="lp-section" id="features">
        <div className="lp-container">
          <div className="lp-section-head">
            <span className="lp-eyebrow">Features</span>
            <h2 className="lp-h2 reveal">Everything a captain needs.<br /><em>Nothing they don't.</em></h2>
          </div>
          <div className="lp-features-grid">
            <Feature
              icon="🎯"
              title="Three explained routes"
              desc="Not one black-box answer. Compare Direct, Northern, and Southern options with plain-language reasoning behind each."
              color="primary"
            />
            <Feature
              icon="🧭"
              title="Land-safe pathfinding"
              desc="A* search over a real 1 km water grid. Routes physically cannot cross land — round Sri Lanka like real merchant ships do."
              color="green"
            />
            <Feature
              icon="⛽"
              title="True voyage cost"
              desc="Fuel (cubic speed law) + time (charter rate) + risk (wave height). Ranked by what actually matters: total cost."
              color="orange"
            />
            <Feature
              icon="🌍"
              title="CO₂ transparency"
              desc="Every option shows its emissions footprint. Aligned with IMO Carbon Intensity Indicator methodology."
              color="primary"
            />
            <Feature
              icon="📥"
              title="GPS-ready CSV export"
              desc="Download the exact waypoints of your chosen route as a CSV file. Drop it straight into any navigation tool."
              color="green"
            />
            <Feature
              icon="🚢"
              title="Fleet management"
              desc="Add vessels by IMO number and type. Multi-tenant by design — each operator sees only their own fleet."
              color="orange"
            />
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="lp-section lp-section-alt" id="how">
        <div className="lp-container">
          <div className="lp-section-head">
            <span className="lp-eyebrow">Workflow</span>
            <h2 className="lp-h2 reveal">Three steps. Two minutes.</h2>
          </div>
          <div className="lp-steps">
            {[
              { n: '01', title: 'Register your fleet', desc: 'Add vessels with name, IMO number, and type. Attach an image. Isolated to your account.' },
              { n: '02', title: 'Select two ports', desc: 'Choose from six Indian and international ports. SeaVision computes three land-safe routes in under 2 seconds.' },
              { n: '03', title: 'Download your course', desc: 'Compare fuel, time, and CO₂ across all options. Export waypoints as a GPS-ready CSV file.' },
            ].map((s, i) => (
              <div key={i} className="lp-step reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="lp-step-num">{s.n}</div>
                <h4>{s.title}</h4>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TECH ============ */}
      <section className="lp-section" id="tech">
        <div className="lp-container">
          <div className="lp-section-head">
            <span className="lp-eyebrow">Under the hood</span>
            <h2 className="lp-h2 reveal">Every formula,<br />openly documented.</h2>
            <p className="lp-lede reveal">
              SeaVision is not a black box. These are the exact algorithms and
              formulas behind every route and metric in the app.
            </p>
          </div>
          <div className="lp-formulas-grid">
            <Formula
              icon="📐"
              title="Haversine distance"
              formula="d = 2R · arcsin(√[sin²(Δφ/2) + cos φ₁ · cos φ₂ · sin²(Δλ/2)])"
              desc="Great-circle distance between waypoints. R = 3440.065 nm (Earth's mean radius)."
            />
            <Formula
              icon="⛽"
              title="Cubic speed law"
              formula="F(v) = F₀ × (v / v₀)³"
              desc="Fuel scales with cube of speed. 14 → 12 knots cuts daily fuel by 37% for 17% time penalty."
            />
            <Formula
              icon="🌊"
              title="Weather penalty"
              formula="P(w) = 1 + 0.05 × max(0, w − 2.0)"
              desc="Added resistance from significant wave height w (metres). Calm seas incur none."
            />
            <Formula
              icon="🌫️"
              title="CO₂ emission factor"
              formula="E_CO₂ = F_fuel × 3.15"
              desc="IMO-standard HFO factor. 3.15 tonnes CO₂ per tonne of fuel burned."
            />
            <Formula
              icon="🧭"
              title="A* pathfinding"
              formula="f(n) = g(n) + h(n)"
              desc="Search over a 0.05° water grid (~3 nm per cell) with octile heuristic. Diagonal moves only through water."
            />
            <Formula
              icon="🗺️"
              title="Land-mask validation"
              formula="valid(wp) ⟺ ¬land(lat, lon) ∀ radius ≤ 1 km"
              desc="Every waypoint checked against global-land-mask at 1 km resolution, plus Palk Strait closure."
            />
          </div>

          <div className="lp-mock-notice reveal">
            <div className="lp-mock-badge">Demo Notice</div>
            <p>
              <strong>Route geometry is computed live</strong> against a real 1 km global land
              mask. All other metrics — fuel consumption, voyage duration, CO₂ emissions,
              vessel data, and port arrival predictions — are <strong>generated from
              representative mock parameters</strong> for demonstration purposes. They are not
              derived from live AIS, live weather feeds, or live fuel markets.
            </p>
          </div>
        </div>
      </section>

      {/* ============ PORTS ============ */}
      <section className="lp-section lp-section-alt" id="ports">
        <div className="lp-container">
          <div className="lp-section-head">
            <span className="lp-eyebrow">Network</span>
            <h2 className="lp-h2 reveal">Six ports. Two continents.</h2>
          </div>
          <div className="lp-ports-grid">
            {[
              { flag: '🇮🇳', name: 'JNPT', city: 'Nhava Sheva, India', coords: '18.95°N · 72.95°E' },
              { flag: '🇮🇳', name: 'Chennai', city: 'Chennai, India', coords: '13.08°N · 80.28°E' },
              { flag: '🇮🇳', name: 'Visakhapatnam', city: 'Andhra Pradesh, India', coords: '17.68°N · 83.22°E' },
              { flag: '🇮🇳', name: 'Mundra', city: 'Gujarat, India', coords: '22.75°N · 69.70°E' },
              { flag: '🇱🇰', name: 'Colombo', city: 'Colombo, Sri Lanka', coords: '6.95°N · 79.85°E' },
              { flag: '🇸🇬', name: 'Singapore', city: 'Singapore', coords: '1.26°N · 103.84°E' },
            ].map((p, i) => (
              <div key={p.name} className="lp-port reveal" style={{ transitionDelay: `${i * 50}ms` }}>
                <div className="lp-port-flag">{p.flag}</div>
                <div className="lp-port-name">{p.name}</div>
                <div className="lp-port-city">{p.city}</div>
                <div className="lp-port-coords">{p.coords}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="lp-cta">
        <div className="lp-cta-inner">
          <h2 className="lp-h2 reveal">Ready to sail?</h2>
          <p className="lp-lede reveal">Register in 20 seconds. Plan your first voyage in 2 minutes.</p>
          <button className="lp-btn-primary lp-btn-lg" onClick={() => navigate(launchTarget)}>
            Launch SeaVision
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      {/* ============ FOOTER ============ */}
<footer className="lp-footer">
  <div className="lp-footer-inner">
    <div className="lp-footer-grid">

      {/* Brand column */}
      <div className="lp-footer-col lp-footer-col-brand">
        <div className="lp-footer-brand">
          <div className="lp-nav-logo">
            <svg viewBox="0 0 40 40" fill="none">
              <path d="M4 26c4-3 8-3 12 0s8 3 12 0 8-3 8-3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M4 18c4-3 8-3 12 0s8 3 12 0 8-3 8-3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
              <path d="M4 10c4-3 8-3 12 0s8 3 12 0 8-3 8-3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
            </svg>
          </div>
          <span>SeaVision</span>
        </div>
        <p className="lp-footer-tagline">
          Maritime route intelligence for the operators enterprise tools priced out.
        </p>
      </div>

      {/* Product column */}
      <div className="lp-footer-col">
        <h4 className="lp-footer-heading">Product</h4>
        <a href="#features">Features</a>
        <a href="#how">How it works</a>
        <a href="#tech">Under the hood</a>
        <a href="#ports">Ports</a>
      </div>

      {/* Contact column */}
      <div className="lp-footer-col">
        <h4 className="lp-footer-heading">Contact</h4>
        <a href="mailto:ankurjagtap92@gmail.com" className="lp-footer-icon-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
          ankurjagtap92@gmail.com
        </a>
        <a
          href="https://www.linkedin.com/in/ankur-jagtap-55293641b/"
          target="_blank"
          rel="noopener noreferrer"
          className="lp-footer-icon-link"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
            <path d="M20.5 2h-17A1.5 1.5 0 0 0 2 3.5v17A1.5 1.5 0 0 0 3.5 22h17a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 20.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 1 1 8.3 6.5 1.78 1.78 0 0 1 6.5 8.25zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0 0 13 14.19a.66.66 0 0 0 0 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 0 1 2.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
          </svg>
          LinkedIn Profile
        </a>
      </div>

      {/* Built by column */}
      <div className="lp-footer-col">
        <h4 className="lp-footer-heading">Built by</h4>
        <div className="lp-footer-author">
          <div className="lp-footer-author-avatar">AM</div>
          <div>
            <div className="lp-footer-author-name">Ankur Mayur Jagtap</div>
            <div className="lp-footer-author-role">Creator &amp; Developer</div>
          </div>
        </div>
        <a href="mailto:ankurjagtap92@gmail.com" className="lp-footer-author-cta">
          Get in touch →
        </a>
      </div>
    </div>

    <div className="lp-footer-divider"></div>

    <div className="lp-footer-bottom">
      <p className="lp-footer-copy">
        © 2026 SeaVision · Built by Ankur Mayur Jagtap · All rights reserved
      </p>
      <p className="lp-footer-note">
        Prototype · Demo data · Not for actual navigation
      </p>
      <button
        className="lp-footer-top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Back to top"
      >
        Back to top ↑
      </button>
    </div>
  </div>
</footer>
    </div>
  );
}