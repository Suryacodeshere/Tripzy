import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import io from 'socket.io-client';
import Auth from './pages/Auth.jsx';
import RiderDashboard from './pages/RiderDashboard.jsx';
import DriverDashboard from './pages/DriverDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';

// 1. Auth Context Creation
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// 2. Global Socket Instance Holder
let socket = null;
export const getSocket = () => socket;

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [driverProfile, setDriverProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('tripzy_token');
    const savedUser = localStorage.getItem('tripzy_user');
    const savedDriverProfile = localStorage.getItem('tripzy_driver_profile');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      if (savedDriverProfile) {
        setDriverProfile(JSON.parse(savedDriverProfile));
      }
      
      // Establish WebSocket
      connectWebSocket(savedToken, JSON.parse(savedUser), savedDriverProfile ? JSON.parse(savedDriverProfile) : null);
    }
    setLoading(false);
  }, []);

  const connectWebSocket = (authToken, authUser, authDriverProfile) => {
    if (socket) {
      socket.disconnect();
    }
    
    // Connect to the backend server (proxy or local port)
    const backendUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '/';
    socket = io(backendUrl);

    socket.on('connect', () => {
      console.log('🔌 WebSocket Connected to Server');
      // Authenticate socket session
      socket.emit('auth:join', {
        userId: authUser.id || authUser._id,
        role: authUser.role,
        name: authUser.name
      });
    });

    socket.on('disconnect', () => {
      console.log('🔌 WebSocket Disconnected');
    });
  };

  const login = (authToken, authUser, authDriverProfile) => {
    localStorage.setItem('tripzy_token', authToken);
    localStorage.setItem('tripzy_user', JSON.stringify(authUser));
    setToken(authToken);
    setUser(authUser);

    if (authDriverProfile) {
      localStorage.setItem('tripzy_driver_profile', JSON.stringify(authDriverProfile));
      setDriverProfile(authDriverProfile);
    } else {
      localStorage.removeItem('tripzy_driver_profile');
      setDriverProfile(null);
    }

    connectWebSocket(authToken, authUser, authDriverProfile);
  };

  const logout = () => {
    localStorage.removeItem('tripzy_token');
    localStorage.removeItem('tripzy_user');
    localStorage.removeItem('tripzy_driver_profile');
    setToken(null);
    setUser(null);
    setDriverProfile(null);
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#05060a' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  // Route Guards
  const ProtectedRoute = ({ children, allowedRoles }) => {
    if (!token || !user) {
      return <Navigate to="/login" replace />;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      return <Navigate to="/" replace />;
    }
    return children;
  };

  return (
    <AuthContext.Provider value={{ user, token, driverProfile, login, logout, setDriverProfile }}>
      <BrowserRouter>
        <div className="app-container">
          {/* Navigation Header */}
          {token && user && (
            <header className="navbar">
              <Link to="/" className="logo">
                <span>🚗</span> Tripzy
              </Link>
              <div className="nav-links">
                {user.role === 'admin' && <Link to="/admin" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>Admin Stats</Link>}
                <div className="user-info">
                  <span>{user.name}</span>
                  <span className={`badge ${user.role}`}>{user.role}</span>
                </div>
                <button onClick={logout} className="btn btn-secondary" style={{ padding: '8px 16px', borderRadius: '8px' }}>
                  Logout
                </button>
              </div>
            </header>
          )}

          <Routes>
            <Route path="/login" element={!token ? <Auth /> : <Navigate to="/" replace />} />
            
            <Route path="/" element={
              token && user ? (
                user.role === 'driver' ? (
                  <Navigate to="/driver" replace />
                ) : user.role === 'admin' ? (
                  <Navigate to="/admin" replace />
                ) : (
                  <Navigate to="/rider" replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            } />

            <Route path="/rider" element={
              <ProtectedRoute allowedRoles={['rider']}>
                <RiderDashboard />
              </ProtectedRoute>
            } />

            <Route path="/driver" element={
              <ProtectedRoute allowedRoles={['driver']}>
                <DriverDashboard />
              </ProtectedRoute>
            } />

            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
