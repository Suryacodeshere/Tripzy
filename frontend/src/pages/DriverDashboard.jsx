import React, { useState, useEffect, useRef } from 'react';
import { useAuth, getSocket } from '../App.jsx';
import Map from '../components/Map.jsx';

export default function DriverDashboard() {
  const { user, token, driverProfile, setDriverProfile } = useAuth();
  const socket = getSocket();

  // Online / Offline states
  const [isOnline, setIsOnline] = useState(driverProfile?.isOnline || false);
  const [driverCoords, setDriverCoords] = useState([77.5946, 12.9716]); // Default center Bangalore

  // Ride state managers
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [activeRide, setActiveRide] = useState(null);
  const [routeGeometry, setRouteGeometry] = useState(null);
  
  // Timer for incoming request accept countdown
  const [countdown, setCountdown] = useState(15);
  const countdownTimer = useRef(null);

  // Watch position tracker reference
  const geoWatchId = useRef(null);

  // Ratings overlay
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');

  // Sync state with local profile
  useEffect(() => {
    fetchActiveRide();

    // Start geolocation immediately if already online
    if (isOnline) {
      startLocationTracking();
    }

    return () => {
      stopLocationTracking();
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  }, []);

  // WebSockets Event Listeners
  useEffect(() => {
    if (!socket) return;

    // Join driver channel
    socket.emit('auth:join', { userId: user.id, role: 'driver', name: user.name });

    // 1. Listen for incoming ride request broadcasts from Passenger within 3km
    socket.on('ride:request', (data) => {
      console.log('🚗 Ride request broadcast received:', data);
      if (activeRide || !isOnline) return; // Ignore if busy or offline

      // Show popup alert with 15 sec countdown
      setIncomingRequest(data);
      setCountdown(15);

      if (countdownTimer.current) clearInterval(countdownTimer.current);
      countdownTimer.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimer.current);
            setIncomingRequest(null);
            return 15;
          }
          return prev - 1;
        });
      }, 1000);
    });

    // 2. Listen for ride status updates (specifically Passenger paying)
    socket.on('ride:status_changed', (data) => {
      console.log('🚗 Status changed received in Driver:', data);
      const updatedRide = data.ride;
      
      if (updatedRide._id === activeRide?._id || updatedRide._id === rideIdFromState()) {
        setActiveRide(updatedRide);
        if (updatedRide.status === 'paid') {
          // Trigger Rating modal for driver to rate passenger
          setShowRatingModal(true);
        }
      }
    });

    return () => {
      socket.off('ride:request');
      socket.off('ride:status_changed');
    };
  }, [socket, activeRide, isOnline]);

  const rideIdFromState = () => {
    return activeRide?._id;
  };

  const fetchActiveRide = async () => {
    try {
      const res = await fetch('/api/rides/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const history = await res.json();
      const active = history.find(r => ['accepted', 'arrived', 'started', 'completed'].includes(r.status));
      if (active) {
        setActiveRide(active);
        
        // Fetch full ride details to load route geometry
        const detailsRes = await fetch(`/api/rides/${active._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const details = await detailsRes.json();
        if (details.routeGeometry) {
          setRouteGeometry(details.routeGeometry);
        }

        if (socket) {
          socket.emit('ride:join', { rideId: active._id });
        }

        // If completed but unpaid, keep showing wait panel
        if (active.status === 'completed') {
          // If passenger already paid, show rating
          if (active.status === 'paid') {
            setShowRatingModal(true);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching active ride:', err);
    }
  };

  // Toggle Driver Online / Offline state
  const handleOnlineToggle = async () => {
    const nextState = !isOnline;
    setIsOnline(nextState);

    try {
      // Toggle backend online status
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const meData = await res.json();

      const profileUpdate = {
        ...meData.driverProfile,
        isOnline: nextState
      };
      setDriverProfile(profileUpdate);
      localStorage.setItem('tripzy_driver_profile', JSON.stringify(profileUpdate));

      if (nextState) {
        startLocationTracking();
      } else {
        stopLocationTracking();
      }
    } catch (err) {
      console.error('Toggle online status error:', err);
    }
  };

  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported in this browser.');
      return;
    }

    // Set watcher to track coords in real-time
    geoWatchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        const coords = [longitude, latitude];
        setDriverCoords(coords);

        // Emit location update via WebSockets to backend
        if (socket) {
          socket.emit('location:update', {
            lat: latitude,
            lng: longitude,
            rideId: activeRide ? activeRide._id : null,
            userId: user.id
          });
        }
      },
      (error) => {
        console.warn('Error fetching device geolocation coordinates:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const stopLocationTracking = () => {
    if (geoWatchId.current) {
      navigator.geolocation.clearWatch(geoWatchId.current);
      geoWatchId.current = null;
    }
  };

  // Accept incoming ride request
  const handleAcceptRide = async () => {
    if (!incomingRequest) return;
    
    // Clear countdown
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    const rideId = incomingRequest._id;
    setIncomingRequest(null);

    try {
      const res = await fetch(`/api/rides/${rideId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      
      if (res.ok) {
        setActiveRide(data.ride);
        setRouteGeometry(incomingRequest.routeGeometry);
        
        if (socket) {
          socket.emit('ride:join', { rideId: data.ride._id });
        }
      } else {
        alert(data.message || 'Ride accept failed. This ride might have been taken by another driver.');
      }
    } catch (err) {
      console.error('Accept ride error:', err);
    }
  };

  const handleDeclineRide = () => {
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    setIncomingRequest(null);
  };

  // Update Ride Status (arrived -> started -> completed)
  const handleUpdateStatus = async (nextStatus) => {
    if (!activeRide) return;

    try {
      const res = await fetch(`/api/rides/${activeRide._id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (res.ok) {
        setActiveRide(data.ride);
      } else {
        alert(data.message || 'Failed to update ride status.');
      }
    } catch (err) {
      console.error('Update status error:', err);
    }
  };

  // Rate Passenger
  const handleRatingSubmit = async () => {
    if (!activeRide) return;
    try {
      const res = await fetch(`/api/rides/${activeRide._id}/rating`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ rating, review })
      });
      if (res.ok) {
        setShowRatingModal(false);
        setActiveRide(null);
        setRouteGeometry(null);
        setRating(5);
        setReview('');
      } else {
        alert('Rating submission failed.');
      }
    } catch (err) {
      console.error('Submit rating error:', err);
    }
  };

  return (
    <div className="dashboard-layout animate-fade">
      {/* Sidebar Controls */}
      <div className="panel-sidebar glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
          <h2 style={{ fontSize: '1.4rem' }}>Driver Panel</h2>
          
          {/* Online/Offline Badge toggle */}
          <button 
            onClick={handleOnlineToggle}
            className={`btn ${isOnline ? 'btn-success pulse-success' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', borderRadius: '30px', fontSize: '0.8rem', textTransform: 'uppercase' }}
          >
            {isOnline ? '🟢 Online' : '⚪ Offline'}
          </button>
        </div>

        {/* Offline notice */}
        {!isOnline && !activeRide && (
          <div style={{ padding: '30px 10px', color: '#9ca3af', fontSize: '0.9rem', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '12px' }}>
            📴 You are currently offline. Toggle status to Online at the top to start receiving ride requests!
          </div>
        )}

        {/* Online idle state */}
        {isOnline && !activeRide && !incomingRequest && (
          <div className="matching-loader animate-slide" style={{ borderStyle: 'solid', borderColor: '#10b981', background: 'rgba(16, 185, 129, 0.03)' }}>
            <div className="radar-ring pulse-success"></div>
            <h4>Waiting for Ride Requests...</h4>
            <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              Your live coordinates are broadcasting to passengers within 3km.
            </p>
          </div>
        )}

        {/* Active Ride controls */}
        {activeRide && (
          <div className="trip-active-panel animate-slide">
            <div className={`trip-status-badge status-${activeRide.status}`}>
              {activeRide.status === 'accepted' && 'En-Route to Pickup'}
              {activeRide.status === 'arrived' && 'Arrived at Pickup'}
              {activeRide.status === 'started' && 'Ride In Progress'}
              {activeRide.status === 'completed' && 'Trip Finished'}
            </div>

            {/* Passenger profile info */}
            {activeRide.passengerId && (
              <div className="driver-card">
                <div className="driver-avatar">👤</div>
                <div className="driver-details">
                  <div className="name">{activeRide.passengerId.name || 'Passenger Customer'}</div>
                  <div className="rating">📞 {activeRide.passengerId.phone}</div>
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>
                    💰 Est. Fare: <strong>₹{activeRide.fare}</strong> • {activeRide.distanceKm} km
                  </div>
                </div>
              </div>
            )}

            {/* Route path */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#9ca3af' }}>Route</div>
              <div style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>🟢 <strong>Pickup:</strong> {activeRide.pickupAddress}</div>
              <div style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>🔴 <strong>Drop:</strong> {activeRide.dropAddress}</div>
            </div>

            {/* Workflow state buttons */}
            <div style={{ marginTop: '10px' }}>
              {activeRide.status === 'accepted' && (
                <button
                  onClick={() => handleUpdateStatus('arrived')}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '14px' }}
                >
                  📍 I Have Arrived
                </button>
              )}

              {activeRide.status === 'arrived' && (
                <button
                  onClick={() => handleUpdateStatus('started')}
                  className="btn btn-success"
                  style={{ width: '100%', padding: '14px' }}
                >
                  🚀 Start Ride Trip
                </button>
              )}

              {activeRide.status === 'started' && (
                <button
                  onClick={() => handleUpdateStatus('completed')}
                  className="btn btn-danger"
                  style={{ width: '100%', padding: '14px' }}
                >
                  🏁 Complete Ride Trip
                </button>
              )}

              {activeRide.status === 'completed' && (
                <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px', textAlign: 'center', color: '#fbbf24', fontWeight: 600 }}>
                  ⏳ Waiting for Passenger to pay ₹{activeRide.fare}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Map area */}
      <div className="map-container">
        <Map
          pickupLoc={activeRide?.pickupLoc}
          dropLoc={activeRide?.dropLoc}
          driverLoc={{ coordinates: driverCoords }}
          routeGeometry={routeGeometry}
          onMapClick={() => {}}
        />
      </div>

      {/* Incoming Request Alert Panel overlay */}
      {incomingRequest && (
        <div className="incoming-ride-modal animate-slide">
          <div className="ride-request-header">
            <h3>⚡ New Ride Request</h3>
            <span className="timer">Decline in {countdown}s</span>
          </div>

          <div className="route-addresses">
            <div className="address-point">
              <span className="icon">🟢</span>
              <span><strong>Pickup:</strong> {incomingRequest.pickupAddress}</span>
            </div>
            <div className="address-point">
              <span className="icon">🔴</span>
              <span><strong>Drop-off:</strong> {incomingRequest.dropAddress}</span>
            </div>
          </div>

          <div className="ride-meta">
            <div className="meta-item">
              Fare Quote
              <strong>₹{incomingRequest.fare}</strong>
            </div>
            <div className="meta-item">
              Distance
              <strong>{incomingRequest.distanceKm} km</strong>
            </div>
            <div className="meta-item">
              Est. Time
              <strong>{incomingRequest.durationMin} mins</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleDeclineRide} className="btn btn-secondary" style={{ flex: 1 }}>
              Decline
            </button>
            <button onClick={handleAcceptRide} className="btn btn-primary" style={{ flex: 2 }}>
              Accept Request
            </button>
          </div>
        </div>
      )}

      {/* Rating & Review Feedback Modal for Customer */}
      {showRatingModal && (
        <div className="payment-modal-overlay">
          <div className="payment-card glass-panel rating-card animate-slide">
            <h3>⭐ Trip Completed & Paid!</h3>
            <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Please rate the passenger customer</p>
            
            <div className="stars-row">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className={`star-btn ${rating >= star ? 'filled' : ''}`}
                >
                  ★
                </button>
              ))}
            </div>

            <div className="input-group">
              <label>Review comments (optional)</label>
              <textarea 
                placeholder="Write a review of your customer..." 
                rows="3"
                value={review}
                onChange={(e) => setReview(e.target.value)}
                style={{ resize: 'none', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: 'white', padding: '12px' }}
              />
            </div>

            <button 
              onClick={handleRatingSubmit} 
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '10px' }}
            >
              Submit Rating & Resume
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
