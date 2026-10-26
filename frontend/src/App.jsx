import { useState } from 'react';
import { Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Planner from './pages/Planner';
import Landing from './pages/Landing';
import IntroAnimation from './components/IntroAnimation';
import ThemeToggle from './components/ThemeToggle';

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('token');
  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="navbar">
      <Link to={token ? '/dashboard' : '/'} className="navbar-brand" style={{ textDecoration: 'none' }}>
        <div className="logo-icon">🌊</div>
        SeaVision
      </Link>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {token && (
          <nav>
            <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>
              🚢 Dashboard
            </Link>
            <Link to="/planner" className={location.pathname === '/planner' ? 'active' : ''}>
              🗺️ Route Planner
            </Link>
            <button onClick={logout}>Logout</button>
          </nav>
        )}
        <ThemeToggle />
      </div>
    </div>
  );
}

function Protected({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" />;
}

export default function App() {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  // ── HARDCODED: always show intro on every load ──
  const [introDone, setIntroDone] = useState(false);

  return (
    <>
      {!introDone && <IntroAnimation onComplete={() => setIntroDone(true)} />}
      {!isLanding && <Navbar />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/planner" element={<Protected><Planner /></Protected>} />
      </Routes>
    </>
  );
}