import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';

export default function AppNavbar() {
  const { user, token, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // On Landing Page or Auth screens, do not render the dashboard header
  if (['/', '/login', '/register'].includes(location.pathname)) {
    return null;
  }

  // Only render when authenticated
  if (!token || !user) {
    return null;
  }

  // Compute initials e.g. "Amit Verma" -> "AV"
  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const isPassenger = user.role === 'passenger';
  const isDriver = user.role === 'driver';
  const isAdmin = user.role === 'admin';

  return (
    <header className="app-main-navbar">
      <div className="navbar-left">
        {/* Brand Logo */}
        <Link to="/" className="navbar-brand-link" title="Tripzy Home">
          <span className="brand-pill-logo">tripzy</span>
        </Link>

        {/* Section Tabs */}
        <nav className="navbar-tab-menu">
          {isPassenger && (
            <>
              <Link
                to="/passenger"
                className={`nav-tab-item ${location.pathname === '/passenger' ? 'active' : ''}`}
              >
                <span className="tab-icon">🚗</span>
                <span>Ride</span>
              </Link>
              <Link to="/#services" className="nav-tab-item">
                <span>Services</span>
              </Link>
              <a href="/#safety" className="nav-tab-item">
                <span className="tab-icon">🛡️</span>
                <span>Safety</span>
              </a>
            </>
          )}

          {isDriver && (
            <>
              <Link
                to="/driver"
                className={`nav-tab-item ${location.pathname === '/driver' ? 'active' : ''}`}
              >
                <span className="tab-icon">👨🏻‍✈️</span>
                <span>Driver Console</span>
              </Link>
              <Link to="/" className="nav-tab-item">
                <span>Website</span>
              </Link>
            </>
          )}

          {isAdmin && (
            <>
              <Link
                to="/admin"
                className={`nav-tab-item ${location.pathname === '/admin' ? 'active' : ''}`}
              >
                <span className="tab-icon">📊</span>
                <span>Operations</span>
              </Link>
              <Link to="/" className="nav-tab-item">
                <span>Website</span>
              </Link>
            </>
          )}
        </nav>
      </div>

      <div className="navbar-right">
        {/* 24x7 Safety indicator for passengers */}
        {isPassenger && (
          <div className="safety-badge-pill" title="24x7 In-Ride Safety Active">
            <span className="safety-dot">●</span>
            <span>Safety Shield Active</span>
          </div>
        )}

        {/* User Profile Card */}
        <div className="navbar-user-card">
          <div className="user-avatar-circle">
            {getInitials(user.name)}
          </div>
          <div className="user-details">
            <span className="user-name">{user.name}</span>
            <span className={`user-role-label ${user.role}`}>
              {isDriver ? 'Driver Partner' : isAdmin ? 'Administrator' : 'Passenger'}
            </span>
          </div>
        </div>

        {/* Clean Sign Out */}
        <button
          onClick={logout}
          className="btn-app-logout"
          title="Sign out of your account"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
