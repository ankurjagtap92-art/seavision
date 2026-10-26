import { useEffect, useState, useRef } from 'react';
import './IntroAnimation.css';

export default function IntroAnimation({ onComplete }) {
  const [exiting, setExiting] = useState(false);
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    setExiting(true);
    setTimeout(onComplete, 500);
  };

  // Auto-finish after 3.4s
  useEffect(() => {
    const t = setTimeout(finish, 3400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Skip on any key
  useEffect(() => {
    const onKey = () => finish();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`sv-intro ${exiting ? 'sv-intro-exit' : ''}`}
      onClick={finish}
      role="dialog"
      aria-label="SeaVision loading"
    >
      {/* Ambient background waves */}
      <div className="sv-intro-waves">
        <svg viewBox="0 0 1440 400" preserveAspectRatio="none">
          <path
            className="sv-wave sv-wave-a"
            d="M0,200 C240,150 480,250 720,200 C960,150 1200,250 1440,200 L1440,400 L0,400 Z"
          />
          <path
            className="sv-wave sv-wave-b"
            d="M0,250 C240,200 480,300 720,250 C960,200 1200,300 1440,250 L1440,400 L0,400 Z"
          />
          <path
            className="sv-wave sv-wave-c"
            d="M0,300 C240,250 480,350 720,300 C960,250 1200,350 1440,300 L1440,400 L0,400 Z"
          />
        </svg>
      </div>

      {/* Center content */}
      <div className="sv-intro-content">
        <svg className="sv-intro-logo" viewBox="0 0 120 120" aria-hidden="true">
          {/* Outer ring drawn with stroke animation */}
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.15"
          />
          <circle
            cx="60"
            cy="60"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.5"
            strokeDasharray="251"
            strokeDashoffset="251"
            className="sv-logo-ring"
          />
          {/* Three waves drawing in */}
          <path
            d="M22 76c7-5 15-5 22 0s15 5 22 0 15-5 22 0 12 5 16 2"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            strokeDasharray="140"
            strokeDashoffset="140"
            className="sv-logo-wave sv-logo-wave-1"
          />
          <path
            d="M26 64c7-5 15-5 22 0s15 5 22 0 15-5 22 0 12 5 16 2"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            strokeDasharray="140"
            strokeDashoffset="140"
            opacity="0.75"
            className="sv-logo-wave sv-logo-wave-2"
          />
          <path
            d="M30 52c7-5 15-5 22 0s15 5 22 0 15-5 22 0 12 5 16 2"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            strokeDasharray="140"
            strokeDashoffset="140"
            opacity="0.45"
            className="sv-logo-wave sv-logo-wave-3"
          />
        </svg>

        {/* Wordmark with per-letter reveal */}
        <h1 className="sv-intro-wordmark" aria-label="SeaVision">
          {'SeaVision'.split('').map((c, i) => (
            <span key={i} style={{ animationDelay: `${0.9 + i * 0.06}s` }}>
              {c}
            </span>
          ))}
        </h1>

        <p className="sv-intro-tagline">Maritime Route Intelligence</p>

        <div className="sv-intro-bar">
          <div className="sv-intro-bar-fill" />
        </div>
      </div>

      {/* Skip button */}
      <button
        className="sv-intro-skip"
        onClick={(e) => {
          e.stopPropagation();
          finish();
        }}
      >
        Skip →
      </button>
    </div>
  );
}