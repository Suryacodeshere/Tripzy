import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../App.jsx';

export default function Auth({ defaultMode = 'login' }) {
  const { user, token, login, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const queryRole = searchParams.get('role');
  const queryMode = searchParams.get('mode');

  const returnTo = location.state?.returnTo;
  const bookingData = location.state?.bookingData;

  // Determine initial mode & role from URL params or props
  const [isLoginMode, setIsLoginMode] = useState(
    defaultMode === 'register' || queryMode === 'register' ? false : true
  );
  const [role, setRole] = useState(queryRole === 'driver' ? 'driver' : 'passenger');

  // Sync mode if query params change
  useEffect(() => {
    if (queryMode === 'register' || defaultMode === 'register') {
      setIsLoginMode(false);
    } else if (queryMode === 'login' || defaultMode === 'login') {
      setIsLoginMode(true);
    }
    if (queryRole === 'driver') {
      setRole('driver');
    } else if (queryRole === 'passenger') {
      setRole('passenger');
    }
  }, [queryMode, queryRole, defaultMode]);

  // If already logged in and simply visiting /login without specific register intent, redirect
  useEffect(() => {
    if (token && user && defaultMode !== 'register' && queryMode !== 'register' && !queryRole) {
      navigate(user.role === 'driver' ? '/driver' : '/passenger', { replace: true });
    }
  }, [token, user, defaultMode, queryMode, queryRole, navigate]);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [vehicleName, setVehicleName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('bike');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
    const payload = isLoginMode 
      ? { email, password }
      : { 
          name, 
          email, 
          phone, 
          password, 
          role,
          ...(role === 'driver' ? { vehicleName, vehicleNumber, vehicleType } : {})
        };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed. Please check your credentials.');
      }

      // Log user in
      login(data.token, data.user, data.driverProfile);

      if (returnTo) {
        navigate(returnTo, { state: bookingData, replace: true });
      } else if (data.user.role === 'driver') {
        navigate('/driver', { replace: true });
      } else {
        navigate('/passenger', { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (demoRole) => {
    setError('');
    setLoading(true);
    const demoEmail = demoRole === 'driver' ? 'driver@tripzy.demo' : 'passenger@tripzy.demo';
    const demoPassword = 'password123';

    try {
      let res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoEmail, password: demoPassword })
      });
      let data = await res.json();

      if (!res.ok) {
        res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: demoRole === 'driver' ? 'Rahul Sharma (Captain)' : 'Amit Verma (Passenger)',
            email: demoEmail,
            phone: '9876543210',
            password: demoPassword,
            role: demoRole,
            ...(demoRole === 'driver' ? {
              vehicleName: 'Honda Activa 6G',
              vehicleNumber: 'DL-01-AB-1234',
              vehicleType: 'bike'
            } : {})
          })
        });
        data = await res.json();
      }

      if (res.ok) {
        login(data.token, data.user, data.driverProfile);
        if (returnTo) {
          navigate(returnTo, { state: bookingData, replace: true });
        } else if (data.user.role === 'driver') {
          navigate('/driver', { replace: true });
        } else {
          navigate('/passenger', { replace: true });
        }
      } else {
        throw new Error(data.message || 'Demo login failed');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modern-auth-viewport">
      {/* Top Navigation Bar */}
      <div className="auth-top-nav">
        <Link to="/" className="back-home-link">
          <span className="arrow">←</span> Back to Homepage
        </Link>
        <Link to="/" className="auth-logo-badge">
          <span className="yellow-pill">tripzy</span>
        </Link>
      </div>

      <div className="auth-central-container">
        <div className="modern-auth-card">
          {/* Header */}
          <div className="modern-auth-header">
            <span className="auth-mini-chip">
              {isLoginMode ? '🔑 Member Login' : role === 'driver' ? '🚕 Driver Partner Onboarding' : '🚶 Passenger Sign Up'}
            </span>
            <h2>{isLoginMode ? 'Welcome Back!' : role === 'driver' ? 'Drive with Tripzy' : 'Create Your Account'}</h2>
            <p>
              {isLoginMode 
                ? 'Sign in to access your rides, tracking, and live earnings.' 
                : role === 'driver'
                  ? 'Earn up to ₹45,000/month with zero commission & instant daily payouts.'
                  : 'Join India\'s fastest-growing ride-hailing app in 30 seconds.'}
            </p>
          </div>

          {/* Active Session Notice (If already logged in but trying to register a driver account) */}
          {token && user && (
            <div className="active-session-banner">
              <div className="session-icon">👤</div>
              <div className="session-text">
                <strong>Signed in as {user.name}</strong> ({user.role})
                <p>Want to register a new {role === 'driver' ? 'Driver Partner' : 'Passenger'} account?</p>
              </div>
              <div className="session-actions">
                <button
                  type="button"
                  onClick={() => { logout(); setIsLoginMode(false); }}
                  className="btn-switch-account"
                >
                  Switch & Register →
                </button>
                <button
                  type="button"
                  onClick={() => navigate(user.role === 'driver' ? '/driver' : '/passenger')}
                  className="btn-session-dash"
                >
                  Map Dashboard
                </button>
              </div>
            </div>
          )}

          {/* Mode Switcher Tabs */}
          <div className="modern-mode-tabs">
            <button
              type="button"
              className={`mode-tab-btn ${isLoginMode ? 'active' : ''}`}
              onClick={() => { setIsLoginMode(true); setError(''); }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`mode-tab-btn ${!isLoginMode ? 'active' : ''}`}
              onClick={() => { setIsLoginMode(false); setError(''); }}
            >
              Register New Account
            </button>
          </div>

          {/* Role Selector (When in Register mode) */}
          {!isLoginMode && (
            <div className="modern-role-selector">
              <button 
                type="button" 
                className={`role-pill-btn ${role === 'passenger' ? 'active' : ''}`} 
                onClick={() => setRole('passenger')}
              >
                <span className="role-icon">🚶</span>
                <span className="role-label">Passenger (Rider)</span>
              </button>
              <button 
                type="button" 
                className={`role-pill-btn ${role === 'driver' ? 'active' : ''}`} 
                onClick={() => setRole('driver')}
              >
                <span className="role-icon">🚕</span>
                <span className="role-label">Driver Partner</span>
              </button>
            </div>
          )}

          {/* Preserved Booking Info from Landing Page */}
          {bookingData && bookingData.pickupAddress && (
            <div className="preserved-trip-banner">
              <span className="icon">📍</span>
              <div className="trip-summary">
                <div className="line"><strong>Trip Queued:</strong> {bookingData.pickupAddress.slice(0, 26)}... → {bookingData.dropAddress?.slice(0, 26)}...</div>
                <div className="sub">Complete login to dispatch your driver immediately.</div>
              </div>
            </div>
          )}

          {/* Error Message Alert */}
          {error && (
            <div className="modern-auth-error">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Main Form */}
          <form onSubmit={handleSubmit} className="modern-auth-form">
            {!isLoginMode && (
              <div className="modern-input-group">
                <label>Full Name</label>
                <div className="field-wrapper">
                  <span className="field-icon">👤</span>
                  <input 
                    type="text" 
                    placeholder="e.g. Rahul Sharma" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    required 
                  />
                </div>
              </div>
            )}

            <div className="modern-input-group">
              <label>Email Address</label>
              <div className="field-wrapper">
                <span className="field-icon">✉️</span>
                <input 
                  type="email" 
                  placeholder="name@example.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                />
              </div>
            </div>

            {!isLoginMode && (
              <div className="modern-input-group">
                <label>Mobile Number</label>
                <div className="field-wrapper">
                  <span className="field-icon">📱</span>
                  <input 
                    type="tel" 
                    placeholder="+91 98765 43210" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    required 
                  />
                </div>
              </div>
            )}

            <div className="modern-input-group">
              <label>Password</label>
              <div className="field-wrapper">
                <span className="field-icon">🔒</span>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                />
              </div>
            </div>

            {/* Dynamic Driver Vehicle Registration Section */}
            {!isLoginMode && role === 'driver' && (
              <div className="driver-onboarding-panel">
                <div className="panel-badge">🚕 Vehicle Registration Details</div>
                
                <div className="modern-input-group">
                  <label>Vehicle Model / Make</label>
                  <div className="field-wrapper">
                    <span className="field-icon">🛵</span>
                    <input 
                      type="text" 
                      placeholder="Honda Activa 6G / WagonR / Bajaj Auto" 
                      value={vehicleName} 
                      onChange={(e) => setVehicleName(e.target.value)} 
                      required 
                    />
                  </div>
                </div>

                <div className="modern-input-group">
                  <label>Vehicle Plate / Registration Number</label>
                  <div className="field-wrapper">
                    <span className="field-icon">🔢</span>
                    <input 
                      type="text" 
                      placeholder="DL-01-AB-1234" 
                      value={vehicleNumber} 
                      onChange={(e) => setVehicleNumber(e.target.value)} 
                      required 
                    />
                  </div>
                </div>

                <div className="modern-input-group">
                  <label>Vehicle Category</label>
                  <div className="field-wrapper">
                    <span className="field-icon">🚖</span>
                    <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                      <option value="bike">🏍️ Bike Taxi (Fastest through traffic)</option>
                      <option value="auto">🛺 Auto Rickshaw (Budget commute)</option>
                      <option value="sedan">🚗 Tripzy Go Sedan (AC Comfort)</option>
                      <option value="suv">🚙 Tripzy Premier SUV (Spacious)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <button type="submit" className="btn-modern-auth-submit" disabled={loading}>
              {loading ? (
                <span className="btn-loading-flex">
                  <span className="spinner-sm"></span> Processing...
                </span>
              ) : isLoginMode ? (
                'Sign In to Dashboard →'
              ) : role === 'driver' ? (
                'Register as Driver Partner ➔'
              ) : (
                'Create Passenger Account ➔'
              )}
            </button>
          </form>

          {/* Bottom Switch Link */}
          <div className="modern-auth-footer">
            {isLoginMode ? (
              <p>
                Don't have an account yet?{' '}
                <button 
                  type="button" 
                  className="link-btn" 
                  onClick={() => { setIsLoginMode(false); setError(''); }}
                >
                  Create Account
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button 
                  type="button" 
                  className="link-btn" 
                  onClick={() => { setIsLoginMode(true); setError(''); }}
                >
                  Sign In
                </button>
              </p>
            )}
          </div>

          {/* 1-Click Instant Demo Testing Section */}
          <div className="modern-demo-testing-box">
            <div className="demo-box-header">
              <span>⚡ 1-Click Instant Demo Evaluation</span>
            </div>
            <div className="demo-buttons-grid">
              <button
                type="button"
                onClick={() => handleQuickDemo('passenger')}
                disabled={loading}
                className="btn-demo-passenger"
              >
                <span className="icon">⚡</span>
                <span className="label">Demo Passenger</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo('driver')}
                disabled={loading}
                className="btn-demo-driver"
              >
                <span className="icon">🚕</span>
                <span className="label">Demo Driver Partner</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
