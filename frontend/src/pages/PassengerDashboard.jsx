import React, { useState, useEffect, useRef } from 'react';
import { useAuth, getSocket } from '../App.jsx';
import Map from '../components/Map.jsx';

export default function PassengerDashboard() {
  const { user, token } = useAuth();
  const socket = getSocket();

  // Route positions
  const [pickupLoc, setPickupLoc] = useState(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropLoc, setDropLoc] = useState(null);
  const [dropAddress, setDropAddress] = useState('');

  // Search suggestions states
  const [suggestions, setSuggestions] = useState([]);
  const [activeInput, setActiveInput] = useState(''); // 'pickup' or 'drop'
  const [searchQuery, setSearchQuery] = useState('');

  // Ride states
  const [distanceKm, setDistanceKm] = useState(0);
  const [durationMin, setDurationMin] = useState(0);
  const [fare, setFare] = useState(0);
  const [routeGeometry, setRouteGeometry] = useState(null);
  const [ride, setRide] = useState(null);
  const [driverLoc, setDriverLoc] = useState(null);
  
  // Idle drivers list
  const [nearbyDrivers, setNearbyDrivers] = useState([]);

  // UI state overlays
  const [searchingRoute, setSearchingRoute] = useState(false);
  const [requestingRide, setRequestingRide] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');

  // Refs for debouncing geocoding queries
  const debounceTimeout = useRef(null);

  // Fetch active rides / restore state on mount
  useEffect(() => {
    fetchActiveRide();
    fetchNearbyDriversList();
  }, []);

  // Set up WebSocket event listeners
  useEffect(() => {
    if (!socket) return;

    // Join user room on mount
    socket.emit('auth:join', { userId: user.id, role: 'passenger', name: user.name });

    // 1. Listen for real-time ride status transitions
    socket.on('ride:status_changed', (data) => {
      console.log('🚗 Status changed received:', data);
      const updatedRide = data.ride;
      setRide(updatedRide);

      if (updatedRide.status === 'accepted') {
        setRequestingRide(false);
        // Bind to this ride's tracking room
        socket.emit('ride:join', { rideId: updatedRide._id });
        if (updatedRide.driverProfile && updatedRide.driverProfile.currentLoc) {
          setDriverLoc(updatedRide.driverProfile.currentLoc);
        }
      } else if (updatedRide.status === 'completed') {
        setShowPaymentModal(true);
      } else if (updatedRide.status === 'paid') {
        setShowPaymentModal(false);
        setShowRatingModal(true);
      } else if (updatedRide.status === 'cancelled') {
        alert('Ride was cancelled.');
        resetDashboard();
      }
    });

    // 2. Listen for driver position tracking updates (when on trip)
    socket.on('location:update', (data) => {
      setDriverLoc({ coordinates: [data.lng, data.lat] });
    });

    // 3. Listen for idle driver position changes (to populate map icons)
    socket.on('driver:location_changed', (data) => {
      setNearbyDrivers(prev => {
        const index = prev.findIndex(d => d.userId.toString() === data.driverId.toString());
        if (index !== -1) {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            currentLoc: { type: 'Point', coordinates: data.coordinates }
          };
          return updated;
        } else {
          return [...prev, {
            userId: data.driverId,
            vehicleName: 'Driver Partner',
            vehicleType: data.vehicleType,
            rating: data.rating,
            currentLoc: { type: 'Point', coordinates: data.coordinates }
          }];
        }
      });
    });

    return () => {
      socket.off('ride:status_changed');
      socket.off('location:update');
      socket.off('driver:location_changed');
    };
  }, [socket]);

  // Sync route calculations when pickup & drop locations are filled
  useEffect(() => {
    if (pickupLoc && dropLoc) {
      calculateRoute();
    } else {
      setRouteGeometry(null);
      setFare(0);
    }
  }, [pickupLoc, dropLoc]);

  const fetchActiveRide = async () => {
    try {
      const res = await fetch('/api/rides/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const history = await res.json();
      // Find incomplete ride
      const active = history.find(r => ['requested', 'accepted', 'arrived', 'started', 'completed'].includes(r.status));
      if (active) {
        setRide(active);
        setPickupLoc(active.pickupLoc);
        setPickupAddress(active.pickupAddress);
        setDropLoc(active.dropLoc);
        setDropAddress(active.dropAddress);
        
        if (socket) {
          socket.emit('ride:join', { rideId: active._id });
        }

        if (active.status === 'accepted' || active.status === 'arrived' || active.status === 'started') {
          // Attempt to fetch current driver position from profile
          const detailsRes = await fetch(`/api/rides/${active._id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const details = await detailsRes.json();
          if (details.driverProfile && details.driverProfile.currentLoc) {
            setDriverLoc(details.driverProfile.currentLoc);
          }
          if (details.routeGeometry) {
            setRouteGeometry(details.routeGeometry);
          }
        } else if (active.status === 'completed') {
          setShowPaymentModal(true);
        }
      }
    } catch (err) {
      console.error('Error fetching active ride:', err);
    }
  };

  const fetchNearbyDriversList = async () => {
    try {
      // Simulate geolocation or query default nearby drivers
      const res = await fetch('/api/rides/geocode/search?q=MG Road Bangalore', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.length > 0) {
        const center = [parseFloat(data[0].lon), parseFloat(data[0].lat)];
        // Get nearby drivers from backend via socket or mock
        // Since we are running local, we will simulate a few idle drivers on map load
        setNearbyDrivers([
          {
            userId: 'driver1',
            vehicleName: 'WagonR Sedan',
            vehicleType: 'sedan',
            rating: 4.8,
            currentLoc: { type: 'Point', coordinates: [center[0] + 0.005, center[1] + 0.005] }
          },
          {
            userId: 'driver2',
            vehicleName: 'Splendor Bike',
            vehicleType: 'bike',
            rating: 4.9,
            currentLoc: { type: 'Point', coordinates: [center[0] - 0.008, center[1] + 0.004] }
          },
          {
            userId: 'driver3',
            vehicleName: 'Ape Auto',
            vehicleType: 'auto',
            rating: 4.7,
            currentLoc: { type: 'Point', coordinates: [center[0] + 0.003, center[1] - 0.006] }
          }
        ]);
      }
    } catch (err) {
      console.error('Error loading nearby idle drivers:', err);
    }
  };

  const calculateRoute = async () => {
    setSearchingRoute(true);
    try {
      const res = await fetch('/api/rides', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          pickupLoc,
          pickupAddress,
          dropLoc,
          dropAddress
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setDistanceKm(data.distanceKm);
        setDurationMin(data.durationMin);
        setFare(data.fare);
        setRouteGeometry(data.routeGeometry);
      } else {
        alert(data.message || 'Route calculation failed.');
      }
    } catch (err) {
      console.error('Routing calculation error:', err);
    } finally {
      setSearchingRoute(false);
    }
  };

  // Perform Address Search (Nominatim Proxy)
  const handleSearch = (val, type) => {
    setActiveInput(type);
    if (type === 'pickup') {
      setPickupAddress(val);
    } else {
      setDropAddress(val);
    }

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

    if (!val || val.length < 3) {
      setSuggestions([]);
      return;
    }

    debounceTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/rides/geocode/search?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        setSuggestions(data);
      } catch (err) {
        console.error('Suggestions error:', err);
      }
    }, 500);
  };

  const selectSuggestion = (item) => {
    const coords = {
      type: 'Point',
      coordinates: [parseFloat(item.lon), parseFloat(item.lat)]
    };

    if (activeInput === 'pickup') {
      setPickupLoc(coords);
      setPickupAddress(item.display_name);
    } else {
      setDropLoc(coords);
      setDropAddress(item.display_name);
    }
    setSuggestions([]);
    setActiveInput('');
  };

  // Click on Map to Drop Pin
  const handleMapClick = async (coords) => {
    if (ride) return; // Prevent pinning while on active trip

    const inputType = activeInput || 'pickup';
    const [lng, lat] = coords;

    try {
      const res = await fetch(`/api/rides/geocode/reverse?lat=${lat}&lon=${lng}`);
      const data = await res.json();
      
      const locPoint = { type: 'Point', coordinates: coords };
      
      if (inputType === 'pickup') {
        setPickupLoc(locPoint);
        setPickupAddress(data.display_name || `Coordinate (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      } else {
        setDropLoc(locPoint);
        setDropAddress(data.display_name || `Coordinate (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      }
    } catch (err) {
      console.error('Map reverse geocoding error:', err);
    }
  };

  const handleRequestRide = async () => {
    if (!pickupLoc || !dropLoc) return;
    setRequestingRide(true);

    try {
      // Backend automatically queries database for nearby drivers and triggers socket broadcasts.
      const res = await fetch('/api/rides', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          pickupLoc,
          pickupAddress,
          dropLoc,
          dropAddress
        })
      });

      const data = await res.json();
      if (res.ok) {
        setRide(data);
        if (socket) {
          socket.emit('ride:join', { rideId: data._id });
        }
      } else {
        alert(data.message || 'Ride request failed.');
        setRequestingRide(false);
      }
    } catch (err) {
      console.error('Ride request error:', err);
      setRequestingRide(false);
    }
  };

  // Payments logic (Razorpay integrations & fallback)
  const handlePayment = async () => {
    if (!ride) return;
    
    try {
      const res = await fetch(`/api/payments/${ride._id}/create-order`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const order = await res.json();
      setPaymentOrder(order);

      if (!order.isMock) {
        // Load Razorpay Script dynamically
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => {
          const options = {
            key: order.keyId,
            amount: order.amount,
            currency: order.currency,
            name: 'Tripzy Ride Sharing',
            description: `Payment for Ride #${ride._id.substring(18)}`,
            order_id: order.orderId,
            handler: async (response) => {
              // Verify on server
              const verifyRes = await fetch(`/api/payments/${ride._id}/verify-payment`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature
                })
              });
              const verifyData = await verifyRes.json();
              if (verifyRes.ok) {
                setRide(verifyData.ride);
                setShowPaymentModal(false);
                setShowRatingModal(true);
              } else {
                alert('Payment verification failed.');
              }
            },
            prefill: {
              name: user.name,
              email: user.email
            },
            theme: { color: '#6366f1' }
          };
          const rzp = new window.Razorpay(options);
          rzp.open();
        };
        document.body.appendChild(script);
      }
    } catch (err) {
      console.error('Payment creation error:', err);
    }
  };

  const completeMockPayment = async (type) => {
    if (!ride || !paymentOrder) return;
    try {
      const mockPayId = `pay_mock_${Math.random().toString(36).substring(2, 11)}`;
      const res = await fetch(`/api/payments/${ride._id}/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          isMockPayment: true,
          razorpay_payment_id: mockPayId,
          razorpay_order_id: paymentOrder.orderId
        })
      });
      const data = await res.json();
      if (res.ok) {
        setRide(data.ride);
        setShowPaymentModal(false);
        setShowRatingModal(true);
      } else {
        alert('Mock payment processing failed.');
      }
    } catch (err) {
      console.error('Mock payment error:', err);
    }
  };

  // Rating Submit
  const handleRatingSubmit = async () => {
    if (!ride) return;
    try {
      const res = await fetch(`/api/rides/${ride._id}/rating`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ rating, review })
      });
      if (res.ok) {
        setShowRatingModal(false);
        resetDashboard();
      } else {
        alert('Rating submission failed.');
      }
    } catch (err) {
      console.error('Rating error:', err);
    }
  };

  const handleCancelRide = async () => {
    if (!ride) return;
    try {
      const res = await fetch(`/api/rides/${ride._id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'cancelled' })
      });
      if (res.ok) {
        resetDashboard();
      }
    } catch (err) {
      console.error('Cancel ride error:', err);
    }
  };

  const resetDashboard = () => {
    setPickupLoc(null);
    setPickupAddress('');
    setDropLoc(null);
    setDropAddress('');
    setDistanceKm(0);
    setDurationMin(0);
    setFare(0);
    setRouteGeometry(null);
    setRide(null);
    setDriverLoc(null);
    setRequestingRide(false);
    setShowPaymentModal(false);
    setPaymentOrder(null);
    setShowRatingModal(false);
    setRating(5);
    setReview('');
  };

  return (
    <div className="dashboard-layout animate-fade">
      {/* Sidebar Controls */}
      <div className="panel-sidebar glass-panel">
        <h2 style={{ fontSize: '1.4rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
          Request a Ride
        </h2>

        {!ride && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Location Search Inputs */}
            <div className="search-box">
              <div className="search-input-wrapper">
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Pickup Location</label>
                  <input
                    type="text"
                    placeholder="Enter pickup address..."
                    value={pickupAddress}
                    onChange={(e) => handleSearch(e.target.value, 'pickup')}
                    onFocus={() => setActiveInput('pickup')}
                  />
                </div>
                {activeInput === 'pickup' && suggestions.length > 0 && (
                  <ul className="suggestions-list">
                    {suggestions.map((item) => (
                      <li key={item.place_id} onClick={() => selectSuggestion(item)}>
                        {item.display_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="search-input-wrapper">
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Drop-Off Destination</label>
                  <input
                    type="text"
                    placeholder="Enter drop-off address..."
                    value={dropAddress}
                    onChange={(e) => handleSearch(e.target.value, 'drop')}
                    onFocus={() => setActiveInput('drop')}
                  />
                </div>
                {activeInput === 'drop' && suggestions.length > 0 && (
                  <ul className="suggestions-list">
                    {suggestions.map((item) => (
                      <li key={item.place_id} onClick={() => selectSuggestion(item)}>
                        {item.display_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Route & Fare details */}
            {fare > 0 && (
              <div className="fare-quote-card animate-slide">
                <div className="route-summary">
                  <span>📏 {distanceKm} km</span>
                  <span>⏱️ {durationMin} mins</span>
                </div>
                <div className="fare-price">
                  <span>₹</span>{fare}
                  <span>est. fare</span>
                </div>
                <button
                  onClick={handleRequestRide}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '14px' }}
                >
                  Book Tripzy Now
                </button>
              </div>
            )}

            {!fare && (
              <div style={{ padding: '20px 10px', color: '#9ca3af', fontSize: '0.88rem', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '12px' }}>
                💡 Click on the map to set pins, or use search suggestions above to calculate route details.
              </div>
            )}
          </div>
        )}

        {/* Searching Radar Loader */}
        {ride && ride.status === 'requested' && (
          <div className="matching-loader animate-slide">
            <div className="radar-ring"></div>
            <h4>Matching Nearby Drivers...</h4>
            <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              Broadcasting your request to drivers within 3km.
            </p>
            <button
              onClick={handleCancelRide}
              className="btn btn-danger"
              style={{ width: '100%', marginTop: '10px' }}
            >
              Cancel Request
            </button>
          </div>
        )}

        {/* Active Ride Panel */}
        {ride && ['accepted', 'arrived', 'started', 'completed'].includes(ride.status) && (
          <div className="trip-active-panel animate-slide">
            <div className={`trip-status-badge status-${ride.status}`}>
              {ride.status === 'accepted' && 'Driver Assigned'}
              {ride.status === 'arrived' && 'Driver Arrived'}
              {ride.status === 'started' && 'Trip In Progress'}
              {ride.status === 'completed' && 'Trip Finished'}
            </div>

            {/* Driver Profile Summary */}
            {ride.driverId && (
              <div className="driver-card">
                <div className="driver-avatar">👨🏻‍✈️</div>
                <div className="driver-details">
                  <div className="name">{ride.driverId.name || 'Driver Partner'}</div>
                  <div className="rating">⭐ {ride.driverProfile?.rating || '5.0'} • {ride.driverId.phone}</div>
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px', textTransform: 'uppercase' }}>
                    🚘 {ride.driverProfile?.vehicleName} ({ride.driverProfile?.vehicleNumber})
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#9ca3af' }}>Route</div>
              <div style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>🟢 <strong>Pickup:</strong> {ride.pickupAddress}</div>
              <div style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>🔴 <strong>Drop:</strong> {ride.dropAddress}</div>
            </div>

            {ride.status === 'completed' && (
              <button onClick={handlePayment} className="btn btn-success pulse-success" style={{ padding: '14px' }}>
                Proceed to Pay ₹{ride.fare}
              </button>
            )}

            {(ride.status === 'accepted' || ride.status === 'arrived') && (
              <button onClick={handleCancelRide} className="btn btn-danger" style={{ width: '100%' }}>
                Cancel Trip
              </button>
            )}
          </div>
        )}
      </div>

      {/* Map View */}
      <div className="map-container">
        <Map
          pickupLoc={pickupLoc}
          dropLoc={dropLoc}
          driverLoc={driverLoc}
          nearbyDrivers={nearbyDrivers}
          routeGeometry={routeGeometry}
          onMapClick={handleMapClick}
          onMapLoaded={(coords) => {
            // Set default pickup to user position
            setPickupLoc({ type: 'Point', coordinates: coords });
          }}
        />
      </div>

      {/* Simulated Payment Gateway Modal */}
      {showPaymentModal && paymentOrder && paymentOrder.isMock && (
        <div className="payment-modal-overlay">
          <div className="payment-card glass-panel animate-slide">
            <h3>💳 Payment Checkout</h3>
            <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Secure simulated sandbox payment mode</p>
            
            <div className="fare-box">₹{ride?.fare}</div>

            <div className="payment-option-list">
              <button 
                onClick={() => completeMockPayment('upi')} 
                className="btn btn-primary"
                style={{ width: '100%', padding: '14px' }}
              >
                📲 Pay via Mock UPI (success@razorpay)
              </button>
              <button 
                onClick={() => completeMockPayment('card')} 
                className="btn btn-secondary"
                style={{ width: '100%', padding: '14px' }}
              >
                💳 Pay via Mock Card (4111 1111...)
              </button>
            </div>
            
            <p style={{ fontSize: '0.75rem', color: '#ef4444' }}>
              *This checkout is running in Test Mode (zero real transactions).
            </p>
          </div>
        </div>
      )}

      {/* Rating & Review Feedback Modal */}
      {showRatingModal && (
        <div className="payment-modal-overlay">
          <div className="payment-card glass-panel rating-card animate-slide">
            <h3>⭐ Trip Completed!</h3>
            <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Please rate your driver partner</p>
            
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
                placeholder="Write a review of your trip..." 
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
              Submit Feedback
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
