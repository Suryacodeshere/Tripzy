import React, { useState } from 'react';
import { useAuth } from '../App.jsx';

export default function Auth() {
  const { login } = useAuth();
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
    } catch (err) {
      setError(err.message);
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
      </div>
    </div>
  );
}
