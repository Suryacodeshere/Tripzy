import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';

export default function AppNavbar() {
  const { user, token, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showSafetyModal, setShowSafetyModal] = useState(false);

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
    <>
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
                <button
                  type="button"
                  onClick={() => setShowSafetyModal(true)}
                  className="nav-tab-item btn-tab-action"
                  title="View safety protocols & emergency assistance"
                >
                  <span className="tab-icon">🛡️</span>
                  <span>Safety</span>
                </button>
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
                <button
                  type="button"
                  onClick={() => setShowSafetyModal(true)}
                  className="nav-tab-item btn-tab-action"
                >
                  <span className="tab-icon">🛡️</span>
                  <span>Safety Protocols</span>
                </button>
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
            <div
              className="safety-badge-pill"
              title="Click to view Safety Protocols & Emergency SOS"
              onClick={() => setShowSafetyModal(true)}
              style={{ cursor: 'pointer' }}
            >
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

      {/* Safety & Emergency SOS Modal */}
      {showSafetyModal && (
        <div className="safety-modal-overlay" onClick={() => setShowSafetyModal(false)}>
          <div className="safety-modal-dialog animate-slide" onClick={(e) => e.stopPropagation()}>
            <div className="safety-modal-header">
              <div className="safety-title-box">
                <span className="safety-icon-large">🛡️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#111827', fontWeight: 800 }}>
                    Tripzy Safety & SOS Center
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#6B7280' }}>
                    Active 24x7 safety protocols on every trip
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-safety-close"
                onClick={() => setShowSafetyModal(false)}
              >
                ✕
              </button>
            </div>

            {/* Emergency SOS Banner */}
            <div className="safety-sos-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>🚨</span>
                <strong style={{ color: '#991B1B', fontSize: '0.95rem' }}>Emergency Assistance</strong>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: '0.84rem', color: '#7F1D1D', lineHeight: 1.4 }}>
                If you feel unsafe or require immediate emergency assistance, contact local authorities or our 24x7 support desk:
              </p>
              <div className="safety-sos-actions">
                <a href="tel:112" className="btn-sos-emergency">
                  📞 Call Police (112)
                </a>
                <a href="tel:18001239876" className="btn-sos-support">
                  🛡️ Tripzy Helpline
                </a>
              </div>
            </div>

            {/* Key Safety Pillars */}
            <div className="safety-points-list">
              <div className="safety-point-card">
                <div className="point-icon">🔐</div>
                <div>
                  <div className="point-title">4-Digit Security Start PIN</div>
                  <div className="point-desc">
                    Your driver cannot start the trip without entering your private 4-digit PIN. Never step into the wrong vehicle.
                  </div>
                </div>
              </div>

              <div className="safety-point-card">
                <div className="point-icon">📍</div>
                <div>
                  <div className="point-title">Live GPS Telemetry Tracking</div>
                  <div className="point-desc">
                    Every meter of your trip is monitored via real-time satellite telemetry with automated route deviation alerts.
                  </div>
                </div>
              </div>

              <div className="safety-point-card">
                <div className="point-icon">👮</div>
                <div>
                  <div className="point-title">100% Verified Captains</div>
                  <div className="point-desc">
                    Driver partners undergo strict multi-point background verifications, government KYC, and vehicle checks.
                  </div>
                </div>
              </div>

              <div className="safety-point-card">
                <div className="point-icon">❄️</div>
                <div>
                  <div className="point-title">Zero-Surge Return Trip Shield</div>
                  <div className="point-desc">
                    Guaranteed return trips with backhaul driver partners at fair upfront pricing, preventing late-night surge price spikes.
                  </div>
                </div>
              </div>
            </div>

            <div className="safety-modal-footer">
              <button
                type="button"
                className="btn-safety-dismiss"
                onClick={() => setShowSafetyModal(false)}
              >
                Return to Ride
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
