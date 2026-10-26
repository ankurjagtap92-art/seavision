import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const form = new URLSearchParams();
      form.append('username', email);
      form.append('password', password);
      const res = await api.post('/token', form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      localStorage.setItem('token', res.data.access_token);
      nav('/dashboard');
    } catch (ex) {
      setErr(ex.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-panel">
        <div className="auth-panel-content">
          <h1>Navigate smarter.<br />Sail cheaper.</h1>
          <p className="lead">
            Three explained route options with full cost, time, risk, and CO₂
            transparency — enterprise-grade voyage planning, priced for small operators.
          </p>
          <ul className="auth-features">
            <li><span className="check">✓</span> 6 Indian & international ports</li>
            <li><span className="check">✓</span> 3 optimized routes per voyage</li>
            <li><span className="check">✓</span> CSV waypoint export for GPS</li>
            <li><span className="check">✓</span> Fleet management built-in</li>
          </ul>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-card">
          <h2>Welcome back</h2>
          <p className="subtitle">Sign in to plan your next voyage</p>
          <form onSubmit={submit}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-block" disabled={loading}>
              {loading ? <><span className="spinner"></span> Signing in…</> : 'Sign In'}
            </button>
            {err && <div className="error">{err}</div>}
          </form>
          <p className="switch-link">
            New here? <Link to="/register">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}