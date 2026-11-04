import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';

export default function Auth() {
  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const returnTo = location.state?.returnTo;
  const bookingData = location.state?.bookingData;

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [role, setRole] = useState('passenger'); // passenger or driver
  
  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [vehicleName, setVehicleName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('sedan');
  
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
        throw new Error(data.message || 'Authentication failed. Please try again.');
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
            name: demoRole === 'driver' ? 'Rahul Sharma (Driver)' : 'Amit Verma (Passenger)',
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
    <div className="auth-page">
      <div className="auth-card glass-panel animate-fade">
        <div className="auth-header">
          <h2>{isLoginMode ? 'Welcome Back' : 'Join Tripzy'}</h2>
          <p>{isLoginMode ? 'Login to your ride-sharing dashboard' : 'Create an account to request or accept rides'}</p>
        </div>

        {bookingData && bookingData.pickupAddress && (
          <div style={{
            padding: '10px 14px',
            background: '#FEF3C7',
            border: '1px solid #FCD34D',
            borderRadius: '10px',
            color: '#92400E',
            marginBottom: '16px',
            fontSize: '0.85rem',
            lineHeight: 1.4
          }}>
            <strong>📍 Preserved Trip:</strong> {bookingData.pickupAddress.slice(0, 28)}... → {bookingData.dropAddress?.slice(0, 28)}...
            <div style={{ fontSize: '0.78rem', marginTop: '2px', color: '#B45309' }}>Log in or sign up to finalize your ride.</div>
          </div>
        )}

        {error && (
          <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', color: '#fca5a5', marginBottom: '20px', fontSize: '0.9rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* Toggle between Passenger / Driver role selection in registration mode */}
        {!isLoginMode && (
          <div className="role-selector">
            <button 
              type="button" 
              className={role === 'passenger' ? 'active' : ''} 
              onClick={() => setRole('passenger')}
            >
              Passenger Account
            </button>
            <button 
              type="button" 
              className={role === 'driver' ? 'active' : ''} 
              onClick={() => setRole('driver')}
            >
              Driver Partner
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLoginMode && (
            <div className="input-group">
              <label>Full Name</label>
              <input 
                type="text" 
                placeholder="John Doe" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
              />
            </div>
          )}

          <div className="input-group">
            <label>Email Address</label>
            <input 
              type="email" 
              placeholder="name@example.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>

          {!isLoginMode && (
            <div className="input-group">
              <label>Phone Number</label>
              <input 
                type="tel" 
                placeholder="+91 9876543210" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                required 
              />
            </div>
          )}

          <div className="input-group">
            <label>Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>

          {/* Dynamic Driver Vehicle Fields */}
          {!isLoginMode && role === 'driver' && (
            <div className="animate-slide" style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)', marginBottom: '8px' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Vehicle Name / Model</label>
                <input 
                  type="text" 
                  placeholder="Suzuki Dzire / Honda Activa" 
                  value={vehicleName} 
                  onChange={(e) => setVehicleName(e.target.value)} 
                  required 
                />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Vehicle Registration Number</label>
                <input 
                  type="text" 
                  placeholder="DL-3C-AB-1234" 
                  value={vehicleNumber} 
                  onChange={(e) => setVehicleNumber(e.target.value)} 
                  required 
                />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Vehicle Category</label>
                <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                  <option value="sedan">🚗 Sedan (Economy)</option>
                  <option value="suv">🚙 SUV (Premium)</option>
                  <option value="auto">🛺 Auto Rickshaw</option>
                  <option value="bike">🏍️ Motorbike</option>
                </select>
              </div>
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={loading}>
            {loading ? (
              <div className="spinner"></div>
            ) : isLoginMode ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="auth-footer">
          {isLoginMode ? (
            <p>
              Don't have an account? 
              <span onClick={() => { setIsLoginMode(false); setError(''); }}>Sign Up</span>
            </p>
          ) : (
            <p>
              Already have an account? 
              <span onClick={() => { setIsLoginMode(true); setError(''); }}>Sign In</span>
            </p>
          )}
        </div>

        {/* 1-Click Demo Testing Access */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
          <div style={{ fontSize: '0.78rem', color: '#9CA3AF', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Instant Demo Logins (No Setup Required)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleQuickDemo('passenger')}
              disabled={loading}
              style={{
                padding: '8px 12px',
                background: '#F59E0B',
                color: '#111827',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              ⚡ Demo Passenger
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('driver')}
              disabled={loading}
              style={{
                padding: '8px 12px',
                background: '#1F2937',
                color: '#F9FAFB',
                border: '1px solid #374151',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              🚕 Demo Driver
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
