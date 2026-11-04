import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import io from 'socket.io-client';
import Auth from './pages/Auth.jsx';
import LandingPage from './pages/LandingPage.jsx';
import PassengerDashboard from './pages/PassengerDashboard.jsx';
import DriverDashboard from './pages/DriverDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AppNavbar from './components/AppNavbar.jsx';

// Override fetch to support backend URL redirection in production and token expiration recovery
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  if (typeof input === 'string' && input.startsWith('/api')) {
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    if (backendUrl !== '/') {
      input = `${backendUrl.replace(/\/$/, '')}${input}`;
    }
  }
  
  const response = await originalFetch(input, init);

  // Auto-detect expired or invalid JWT token and trigger session cleanup
  if (response.status === 401 || response.status === 403) {
    try {
      const clone = response.clone();
      const errData = await clone.json();
      if (errData && errData.message && errData.message.toLowerCase().includes('token')) {
        console.warn('⚠️ Stale or invalid JWT token detected. Purging session.');
        localStorage.removeItem('tripzy_token');
        localStorage.removeItem('tripzy_user');
        localStorage.removeItem('tripzy_driver_profile');
        window.dispatchEvent(new CustomEvent('tripzy:session-expired', { detail: errData.message }));
      }
    } catch (e) {
      // Non-json response
    }
  }

  return response;
};

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

  // Restore session from localStorage on mount and listen for session expiration
  useEffect(() => {
    const handleSessionExpired = () => {
      setToken(null);
      setUser(null);
      setDriverProfile(null);
      if (socket) {
        socket.disconnect();
      }
    };
    window.addEventListener('tripzy:session-expired', handleSessionExpired);

    const savedToken = localStorage.getItem('tripzy_token');
    const savedUser = localStorage.getItem('tripzy_user');
    const savedDriverProfile = localStorage.getItem('tripzy_driver_profile');

    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser.role === 'rider') {
          parsedUser.role = 'passenger';
          localStorage.setItem('tripzy_user', JSON.stringify(parsedUser));
        }
        setToken(savedToken);
        setUser(parsedUser);
        if (savedDriverProfile) {
          setDriverProfile(JSON.parse(savedDriverProfile));
        }
        
        // Establish WebSocket
        connectWebSocket(savedToken, parsedUser, savedDriverProfile ? JSON.parse(savedDriverProfile) : null);
      } catch (err) {
        console.error('Failed to parse saved auth profile:', err);
        localStorage.removeItem('tripzy_token');
        localStorage.removeItem('tripzy_user');
      }
    }
    setLoading(false);

    return () => {
      window.removeEventListener('tripzy:session-expired', handleSessionExpired);
    };
  }, []);

  const connectWebSocket = (authToken, authUser, authDriverProfile) => {
    if (socket) {
      socket.disconnect();
    }
    
    // Connect to the backend server
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
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
          {/* Production App Navigation Header (Auto-hides on Landing & Auth pages) */}
          <AppNavbar />

          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Auth defaultMode="login" />} />
            <Route path="/register" element={<Auth defaultMode="register" />} />
            
            {/* Allow route preview for both guests and passengers; auth is verified on ride request */}
            <Route path="/passenger" element={<PassengerDashboard />} />

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
