import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await api.post('/register', { email, password });
      setOk('Account created! Redirecting to sign in…');
      setTimeout(() => nav('/login'), 1200);
    } catch (ex) {
      setErr(ex.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-panel">
        <div className="auth-panel-content">
          <h1>Start planning.<br />Start saving.</h1>
          <p className="lead">
            Join SeaVision and get professional-grade maritime route optimization
            for a fraction of enterprise pricing.
          </p>
          <ul className="auth-features">
            <li><span className="check">✓</span> Free to try — no credit card</li>
            <li><span className="check">✓</span> Multi-objective route engine</li>
            <li><span className="check">✓</span> IMO-compliant CO₂ tracking</li>
            <li><span className="check">✓</span> Instant CSV waypoint export</li>
          </ul>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-card">
          <h2>Create your account</h2>
          <p className="subtitle">Set up your fleet in under a minute</p>
          <form onSubmit={submit}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6} required placeholder="At least 6 characters" />
            </div>
            <button type="submit" className="btn btn-block" disabled={loading}>
              {loading ? <><span className="spinner"></span> Creating…</> : 'Create Account'}
            </button>
            {err && <div className="error">{err}</div>}
            {ok && <div className="success">{ok}</div>}
          </form>
          <p className="switch-link">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}