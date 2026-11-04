import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth, getSocket } from '../App.jsx';
import Map from '../components/Map.jsx';

export default function PassengerDashboard() {
  const { user, token, login } = useAuth();
  const socket = getSocket();
  const location = useLocation();
  const navigate = useNavigate();

  // Redirect driver users to driver dashboard
  useEffect(() => {
    if (user?.role === 'driver') {
      navigate('/driver', { replace: true });
    }
  }, [user, navigate]);

  // Route positions
  const [pickupLoc, setPickupLoc] = useState(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropLoc, setDropLoc] = useState(null);
  const [dropAddress, setDropAddress] = useState('');
  const [userLiveCoords, setUserLiveCoords] = useState(null); // [lon, lat]

  // Search suggestions states
  const [suggestions, setSuggestions] = useState([]);
  const [activeInput, setActiveInput] = useState(''); // 'pickup' or 'drop'
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-detect user live location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = [pos.coords.longitude, pos.coords.latitude];
          setUserLiveCoords(coords);
          if (!pickupLoc) {
            setPickupLoc({ type: 'Point', coordinates: coords });
          }
        },
        (err) => console.warn('Geolocation lookup notice:', err),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  // Ride states
  const [distanceKm, setDistanceKm] = useState(0);
  const [durationMin, setDurationMin] = useState(0);
  const [fare, setFare] = useState(0);
  const [routeGeometry, setRouteGeometry] = useState(null);
  const [ride, setRide] = useState(null);
  const [driverLoc, setDriverLoc] = useState(null);
  const [estimates, setEstimates] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState('bike');
  
  // Bilateral Return Trip Lock states
  const [lockReturnTrip, setLockReturnTrip] = useState(false);
  const [returnTimeWindow, setReturnTimeWindow] = useState('In 2 Hours (~10:30 PM)');
  const [checkingReturn, setCheckingReturn] = useState(false);
  const [returnDriverMatch, setReturnDriverMatch] = useState(null);
  const [lockedReturnRide, setLockedReturnRide] = useState(null);
  
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
  
  // Auth Modal for unauthenticated ride requests
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Refs for debouncing geocoding queries
  const debounceTimeout = useRef(null);

  // Initialize trip state from landing page navigation
  useEffect(() => {
    const initTripFromState = async () => {
      if (!location.state) return;
      const { pickupAddress: pAddr, dropAddress: dAddr, pickupLoc: pLoc, dropLoc: dLoc, vehicleType } = location.state;
      if (vehicleType) setSelectedVehicle(vehicleType);

      let finalPLoc = pLoc;
      let finalDLoc = dLoc;

      if (pAddr) setPickupAddress(pAddr);
      if (dAddr) setDropAddress(dAddr);

      // Auto-geocode if addresses exist but coordinates were not passed
      if (!finalPLoc && pAddr) {
        try {
          const res = await fetch(`/api/rides/geocode/search?q=${encodeURIComponent(pAddr)}`);
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0 && !data[0].display_name?.includes('(Simulated Location)')) {
            finalPLoc = { type: 'Point', coordinates: [parseFloat(data[0].lon), parseFloat(data[0].lat)] };
            setPickupLoc(finalPLoc);
          } else {
            // Direct client fallback to Photon
            const pRes = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(pAddr)}&limit=1`);
            const pData = await pRes.json();
            if (pData.features && pData.features.length > 0) {
              finalPLoc = { type: 'Point', coordinates: pData.features[0].geometry.coordinates };
              setPickupLoc(finalPLoc);
            }
          }
        } catch (e) {}
      } else if (finalPLoc) {
        setPickupLoc(finalPLoc);
      }

      if (!finalDLoc && dAddr) {
        try {
          const res = await fetch(`/api/rides/geocode/search?q=${encodeURIComponent(dAddr)}`);
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0 && !data[0].display_name?.includes('(Simulated Location)')) {
            finalDLoc = { type: 'Point', coordinates: [parseFloat(data[0].lon), parseFloat(data[0].lat)] };
            setDropLoc(finalDLoc);
          } else {
            // Direct client fallback to Photon
            const pRes = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(dAddr)}&limit=1`);
            const pData = await pRes.json();
            if (pData.features && pData.features.length > 0) {
              finalDLoc = { type: 'Point', coordinates: pData.features[0].geometry.coordinates };
              setDropLoc(finalDLoc);
            }
          }
        } catch (e) {}
      } else if (finalDLoc) {
        setDropLoc(finalDLoc);
      }

      // If both coordinates available, immediately trigger route calculation
      if (finalPLoc && finalDLoc) {
        calculateRoute(finalPLoc, finalDLoc);
      }
    };

    initTripFromState();
  }, [location.state]);

  // Fetch active rides / restore state on mount
  useEffect(() => {
    if (token) {
      fetchActiveRide();
    }
    fetchNearbyDriversList();
  }, [token]);

  // Set up WebSocket event listeners
  useEffect(() => {
    if (!socket) return;

    // Join user room on mount if authenticated
    if (user && user.id) {
      socket.emit('auth:join', { userId: user.id, role: 'passenger', name: user.name });
    }

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
  }, [socket, user]);

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
    if (!token) return;
    try {
      const res = await fetch('/api/rides/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const history = await res.json();
      if (!Array.isArray(history)) return;

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
          try {
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
          } catch (e) {}
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
      const res = await fetch('/api/rides/geocode/search?q=MG Road Bangalore');
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const center = [parseFloat(data[0].lon), parseFloat(data[0].lat)];
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

  const computeClientFallbackRoute = (pLoc, dLoc) => {
    const [lng1, lat1] = pLoc.coordinates;
    const [lng2, lat2] = dLoc.coordinates;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = +(R * c * 1.3).toFixed(2);
    const dur = Math.max(5, Math.round(dist * 2.2));

    const fallbackEstimates = {
      bike: { vehicleType: 'bike', name: 'Tripzy Moto (Bike)', icon: '🛵', capacity: '1 Rider', fare: Math.round(20 + dist * 7 + dur), carbonSavedGrams: Math.round(105 * dist) },
      auto: { vehicleType: 'auto', name: 'Tripzy Auto', icon: '🛺', capacity: '3 Riders', fare: Math.round(30 + dist * 10 + dur * 1.5), carbonSavedGrams: Math.round(75 * dist) },
      sedan: { vehicleType: 'sedan', name: 'Tripzy Go (Sedan)', icon: '🚗', capacity: '4 Riders', fare: Math.round(50 + dist * 13 + dur * 2), carbonSavedGrams: Math.round(10 * dist) },
      suv: { vehicleType: 'suv', name: 'Tripzy Premier (SUV)', icon: '🚙', capacity: '6 Riders', fare: Math.round(75 + dist * 17 + dur * 2.5), carbonSavedGrams: 0 }
    };

    setDistanceKm(dist);
    setDurationMin(dur);
    setRouteGeometry({
      type: 'LineString',
      coordinates: [pLoc.coordinates, dLoc.coordinates]
    });
    setEstimates(fallbackEstimates);
    setFare(fallbackEstimates[selectedVehicle]?.fare || fallbackEstimates.sedan.fare);
  };

  const calculateRoute = async (pLoc = pickupLoc, dLoc = dropLoc) => {
    if (!pLoc || !dLoc || !pLoc.coordinates || !dLoc.coordinates) return;
    setSearchingRoute(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/rides/estimate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          pickupLoc: pLoc,
          dropLoc: dLoc
        })
      });
      
      const data = await res.json();
      if (res.ok && data.estimates) {
        setDistanceKm(data.distanceKm);
        setDurationMin(data.durationMin);
        setRouteGeometry(data.routeGeometry);
        setEstimates(data.estimates);
        const currentFare = data.estimates[selectedVehicle]?.fare || data.estimates.sedan?.fare || 50;
        setFare(currentFare);
      } else {
        computeClientFallbackRoute(pLoc, dLoc);
      }
    } catch (err) {
      console.warn('Routing estimate error, using client fallback:', err);
      computeClientFallbackRoute(pLoc, dLoc);
    } finally {
      setSearchingRoute(false);
    }
  };

  const handleSelectVehicle = (vType) => {
    setSelectedVehicle(vType);
    if (estimates && estimates[vType]) {
      setFare(estimates[vType].fare);
    }
  };

  const handleToggleReturnLock = async (enabled) => {
    setLockReturnTrip(enabled);
    if (!enabled) {
      setReturnDriverMatch(null);
      return;
    }

    setCheckingReturn(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/rides/return-lock/check', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          returnPickupAddress: dropAddress,
          returnDropAddress: pickupAddress,
          targetTime: returnTimeWindow
        })
      });
      const data = await res.json();
      if (data.matched) {
        setReturnDriverMatch(data.driver);
      } else {
        setReturnDriverMatch(null);
      }
    } catch (err) {
      console.error('Check return lock error:', err);
    } finally {
      setCheckingReturn(false);
    }
  };

  // Perform Address Search (Robust Geocoding)
  const handleSearch = (val, type) => {
    setActiveInput(type);
    if (type === 'pickup') {
      setPickupAddress(val);
    } else {
      setDropAddress(val);
    }

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

    if (!val || val.length < 2) {
      setSuggestions([]);
      return;
    }

    // Determine reference coordinate for proximity bias (intra-city priority)
    const refCoords = (type === 'drop' && pickupLoc?.coordinates)
      ? pickupLoc.coordinates
      : (userLiveCoords || pickupLoc?.coordinates || null);
    
    const biasParams = refCoords ? `&lat=${refCoords[1]}&lon=${refCoords[0]}` : '';

    const haversineKm = (lon1, lat1, lon2, lat2) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return +(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
    };

    debounceTimeout.current = setTimeout(async () => {
      try {
        let results = [];
        try {
          const res = await fetch(`/api/rides/geocode/search?q=${encodeURIComponent(val)}${biasParams}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0 && !data[0].display_name?.includes('(Simulated Location)')) {
              results = data;
            }
          }
        } catch (backendErr) {
          console.warn('Backend geocode fetch failed, using direct client lookup:', backendErr);
        }

        // Direct browser fallback to Photon with proximity bias
        if (results.length === 0) {
          try {
            const directRes = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(val)}${biasParams}&limit=12`);
            if (directRes.ok) {
              const data = await directRes.json();
              results = (data.features || []).map((f, idx) => {
                const fLat = f.geometry.coordinates[1];
                const fLon = f.geometry.coordinates[0];
                const dist = refCoords ? haversineKm(refCoords[0], refCoords[1], fLon, fLat) : null;
                return {
                  place_id: f.properties.osm_id || (Date.now() + idx),
                  display_name: [
                    f.properties.name,
                    f.properties.housenumber ? ('#' + f.properties.housenumber) : null,
                    f.properties.street,
                    f.properties.district,
                    f.properties.city,
                    f.properties.state,
                    f.properties.country
                  ].filter(Boolean).join(', '),
                  lat: String(fLat),
                  lon: String(fLon),
                  dist
                };
              });

              if (refCoords) {
                const localResults = results.filter(r => r.dist !== null && r.dist <= 75);
                if (localResults.length > 0) {
                  localResults.sort((a, b) => a.dist - b.dist);
                  results = localResults;
                } else {
                  results.sort((a, b) => (a.dist ?? 99999) - (b.dist ?? 99999));
                }
              }
            }
          } catch (dErr) {}
        }

        setSuggestions(results.slice(0, 6));
      } catch (err) {
        console.error('Suggestions error:', err);
      }
    }, 350);
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
      let resolvedAddress = '';
      try {
        const res = await fetch(`/api/rides/geocode/reverse?lat=${lat}&lon=${lng}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.display_name) resolvedAddress = data.display_name;
        }
      } catch (e) {}

      if (!resolvedAddress) {
        try {
          const bdcRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
          if (bdcRes.ok) {
            const bdcData = await bdcRes.json();
            const parts = [bdcData.locality, bdcData.city, bdcData.principalSubdivision].filter(Boolean);
            if (parts.length > 0) resolvedAddress = parts.join(', ');
          }
        } catch (e) {}
      }

      const finalAddress = resolvedAddress || `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      const locPoint = { type: 'Point', coordinates: coords };
      
      if (inputType === 'pickup') {
        setPickupLoc(locPoint);
        setPickupAddress(finalAddress);
      } else {
        setDropLoc(locPoint);
        setDropAddress(finalAddress);
      }
    } catch (err) {
      console.error('Map reverse geocoding error:', err);
    }
  };

  const handleRequestRide = async () => {
    if (!pickupLoc || !dropLoc) {
      alert('Please select both pickup and drop-off locations.');
      return;
    }

    if (!token || !user) {
      setShowAuthModal(true);
      return;
    }

    executeRideBooking(token);
  };

  const executeRideBooking = async (activeAuthToken) => {
    setRequestingRide(true);

    try {
      const res = await fetch('/api/rides', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeAuthToken || token}`
        },
        body: JSON.stringify({
          pickupLoc,
          pickupAddress,
          dropLoc,
          dropAddress,
          vehicleType: selectedVehicle
        })
      });

      const data = await res.json();
      if (res.ok) {
        setRide(data);
        if (socket) {
          socket.emit('ride:join', { rideId: data._id });
        }

        // If Forward Contract Return Lock was agreed with committed driver, book return ride
        if (lockReturnTrip && returnDriverMatch) {
          try {
            const returnRes = await fetch('/api/rides/return-lock/book', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${activeAuthToken || token}`
              },
              body: JSON.stringify({
                outboundRideId: data._id,
                returnPickupLoc: dropLoc,
                returnPickupAddress: dropAddress,
                returnDropLoc: pickupLoc,
                returnDropAddress: pickupAddress,
                driverId: returnDriverMatch.driverId,
                returnScheduledTime: returnTimeWindow,
                lockedFare: returnDriverMatch.lockedFare
              })
            });
            const returnData = await returnRes.json();
            if (returnRes.ok) {
              setLockedReturnRide(returnData.returnRide);
            }
          } catch (returnErr) {
            console.error('Return trip booking error:', returnErr);
          }
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

  const handleAuthModalSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegisterMode
      ? { name: authName, email: authEmail, phone: authPhone || '9876543210', password: authPassword, role: 'passenger' }
      : { email: authEmail, password: authPassword };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Authentication failed');

      login(data.token, data.user, data.driverProfile);
      setShowAuthModal(false);
      executeRideBooking(data.token);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleQuickDemoPassenger = async () => {
    setAuthError('');
    setAuthLoading(true);
    const demoEmail = 'passenger@tripzy.demo';
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
            name: 'Amit Verma (Passenger)',
            email: demoEmail,
            phone: '9876543210',
            password: demoPassword,
            role: 'passenger'
          })
        });
        data = await res.json();
      }

      if (res.ok) {
        login(data.token, data.user, data.driverProfile);
        setShowAuthModal(false);
        executeRideBooking(data.token);
      } else {
        throw new Error(data.message || 'Demo login failed');
      }
    } catch (e) {
      setAuthError(e.message);
    } finally {
      setAuthLoading(false);
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && suggestions.length > 0) {
                        e.preventDefault();
                        selectSuggestion(suggestions[0]);
                      }
                    }}
                  />
                </div>
                {activeInput === 'pickup' && suggestions.length > 0 && (
                  <ul className="suggestions-list">
                    {suggestions.map((item) => (
                      <li
                        key={item.place_id}
                        onClick={() => selectSuggestion(item)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px' }}>
                          {item.display_name}
                        </span>
                        {item.dist != null && (
                          <span style={{ fontSize: '0.72rem', background: 'rgba(253, 184, 19, 0.15)', color: '#fdb813', padding: '2px 7px', borderRadius: '10px', whiteSpace: 'nowrap', fontWeight: 600 }}>
                            {item.dist < 1 ? '< 1 km' : `${item.dist} km`}
                          </span>
                        )}
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && suggestions.length > 0) {
                        e.preventDefault();
                        selectSuggestion(suggestions[0]);
                      }
                    }}
                  />
                </div>
                {activeInput === 'drop' && suggestions.length > 0 && (
                  <ul className="suggestions-list">
                    {suggestions.map((item) => (
                      <li
                        key={item.place_id}
                        onClick={() => selectSuggestion(item)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px' }}>
                          {item.display_name}
                        </span>
                        {item.dist != null && (
                          <span style={{ fontSize: '0.72rem', background: 'rgba(253, 184, 19, 0.15)', color: '#fdb813', padding: '2px 7px', borderRadius: '10px', whiteSpace: 'nowrap', fontWeight: 600 }}>
                            {item.dist < 1 ? '< 1 km' : `${item.dist} km`}
                          </span>
                        )}
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
                  <span>⏱️ ~{durationMin} mins</span>
                </div>

                {/* Academic Vehicle Category & Eco Selector */}
                {estimates && (
                  <div className="vehicle-selector-group">
                    {Object.values(estimates).map((v) => (
                      <div
                        key={v.vehicleType}
                        className={`vehicle-card ${selectedVehicle === v.vehicleType ? 'selected' : ''}`}
                        onClick={() => handleSelectVehicle(v.vehicleType)}
                      >
                        <div className="vehicle-left">
                          <span className="vehicle-icon">{v.icon}</span>
                          <div className="vehicle-info">
                            <span className="vehicle-name">{v.name}</span>
                            <span className="vehicle-desc">{v.capacity} • {v.description}</span>
                            {v.carbonSavedGrams > 0 && (
                              <span className="eco-tag">🌿 Saves ~{v.carbonSavedGrams}g CO₂</span>
                            )}
                          </div>
                        </div>
                        <div className="vehicle-right">
                          <span className="vehicle-fare">₹{v.fare}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bilateral Return Trip Shield Toggle (Bilateral Forward Contract) */}
                <div className="return-shield-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#fff' }}>Lock Return Trip (Surge Shield)</div>
                        <div style={{ fontSize: '0.74rem', color: '#9ca3af' }}>Only locks if a driver pre-committed availability • 0% Surge</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={lockReturnTrip}
                      onChange={(e) => handleToggleReturnLock(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#6366f1' }}
                    />
                  </div>

                  {lockReturnTrip && (
                    <div className="return-shield-details animate-slide">
                      <div style={{ fontSize: '0.78rem', color: '#c084fc', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>
                        Select Return Time Window:
                      </div>
                      <select
                        value={returnTimeWindow}
                        onChange={(e) => {
                          setReturnTimeWindow(e.target.value);
                          handleToggleReturnLock(true);
                        }}
                        style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', marginBottom: '8px', fontSize: '0.85rem' }}
                      >
                        <option value="In 2 Hours (~10:30 PM)">In 2 Hours (~10:30 PM)</option>
                        <option value="In 3 Hours (~11:30 PM)">In 3 Hours (~11:30 PM)</option>
                        <option value="Midnight (~12:00 AM)">Midnight (~12:00 AM)</option>
                        <option value="Late Night (~01:00 AM)">Late Night (~01:00 AM)</option>
                      </select>

                      {checkingReturn && (
                        <div style={{ fontSize: '0.82rem', color: '#fbbf24', textAlign: 'center', padding: '6px' }}>
                          🔍 Searching for pre-committed backhaul drivers in {dropAddress.split(',')[0]}...
                        </div>
                      )}

                      {!checkingReturn && returnDriverMatch && (
                        <div className="return-match-success animate-slide">
                          <div style={{ color: '#4ade80', fontWeight: 700, fontSize: '0.85rem' }}>
                            ✅ Pre-Committed Return Driver Found!
                          </div>
                          <div style={{ fontSize: '0.82rem', color: '#e5e7eb', marginTop: '4px' }}>
                            👨🏻‍✈️ <strong>{returnDriverMatch.name}</strong> • {returnDriverMatch.vehicleName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                            Corridor: {returnDriverMatch.headingZone} • ⭐ {returnDriverMatch.rating}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                            <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Guaranteed Return Fare:</span>
                            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#4ade80' }}>₹{returnDriverMatch.lockedFare} <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>(0% Surge)</span></span>
                          </div>
                        </div>
                      )}

                      {!checkingReturn && !returnDriverMatch && (
                        <div className="return-match-empty animate-slide">
                          <div style={{ color: '#f59e0b', fontSize: '0.82rem', fontWeight: 600 }}>
                            ℹ️ No driver pre-committed for this corridor yet.
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>
                            No upfront fees charged. Standard on-demand booking will be available for your return.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="fare-price">
                  <span>₹</span>{fare}
                  <span>est. total fare</span>
                </div>

                <button
                  onClick={handleRequestRide}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '14px' }}
                >
                  Book Tripzy {estimates ? estimates[selectedVehicle]?.name : 'Ride'}
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
              {ride.status === 'arrived' && 'Driver Arrived at Pickup'}
              {ride.status === 'started' && 'Trip In Progress'}
              {ride.status === 'completed' && 'Trip Finished'}
            </div>

            {/* Safety Verification PIN Card */}
            {ride.startOtp && (ride.status === 'accepted' || ride.status === 'arrived') && (
              <div className="security-pin-card animate-slide">
                <div className="pin-label">🔐 Start Trip Security PIN</div>
                <div className="pin-digits">{ride.startOtp}</div>
                <div className="pin-hint">Share this 4-digit PIN with your driver to start the trip securely</div>
              </div>
            )}

            {/* Academic Green Routing Eco Badge */}
            {ride.carbonSavedGrams > 0 && (
              <div className="eco-impact-banner">
                <span>🌱</span>
                <span><strong>Eco-Benefit:</strong> Offsetting ~{ride.carbonSavedGrams}g CO₂ compared to a private car ride!</span>
              </div>
            )}

            {/* Guaranteed Return Trip Confirmation */}
            {(lockedReturnRide || ride.isReturnLocked) && (
              <div style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.35)', borderRadius: '10px', padding: '10px 12px', fontSize: '0.82rem', color: '#c7d2fe' }} className="animate-slide">
                <div>🛡️ <strong>Guaranteed Return Ride:</strong> Trip Locked!</div>
                <div style={{ fontSize: '0.75rem', color: '#a5b4fc', marginTop: '3px' }}>
                  A verified driver is locked for your return at <strong>{lockedReturnRide?.returnScheduledTime || 'Tonight'}</strong> at <strong>₹{lockedReturnRide?.fare || 350}</strong> (0% Surge Guarantee).
                </div>
              </div>
            )}

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
            // Set default pickup to user position and save live coords
            setPickupLoc({ type: 'Point', coordinates: coords });
            setUserLiveCoords(coords);
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

      {/* 1-Click Guest Authentication Modal */}
      {showAuthModal && (
        <div className="payment-modal-overlay">
          <div className="payment-card glass-panel animate-slide" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>🚖 Confirm Your Ride</h3>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>
            
            <p style={{ color: '#9ca3af', fontSize: '0.88rem', margin: '0 0 16px 0' }}>
              {isRegisterMode ? 'Create a passenger profile to dispatch your driver' : 'Sign in to dispatch your driver'}
            </p>

            {authError && (
              <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5', fontSize: '0.82rem', marginBottom: '12px' }}>
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthModalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {isRegisterMode && (
                <>
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    required
                    style={{ padding: '10px 14px', borderRadius: '8px', background: '#1F2937', border: '1px solid #374151', color: 'white' }}
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    value={authPhone}
                    onChange={(e) => setAuthPhone(e.target.value)}
                    style={{ padding: '10px 14px', borderRadius: '8px', background: '#1F2937', border: '1px solid #374151', color: 'white' }}
                  />
                </>
              )}

              <input
                type="email"
                placeholder="Email Address"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
                style={{ padding: '10px 14px', borderRadius: '8px', background: '#1F2937', border: '1px solid #374151', color: 'white' }}
              />

              <input
                type="password"
                placeholder="Password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
                style={{ padding: '10px 14px', borderRadius: '8px', background: '#1F2937', border: '1px solid #374151', color: 'white' }}
              />

              <button
                type="submit"
                disabled={authLoading}
                className="btn btn-taxi"
                style={{ width: '100%', padding: '12px', marginTop: '6px' }}
              >
                {authLoading ? 'Signing In...' : isRegisterMode ? 'Create Account & Book' : 'Sign In & Book Ride'}
              </button>
            </form>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '0.82rem', color: '#9CA3AF' }}>
              <span
                onClick={() => { setIsRegisterMode(!isRegisterMode); setAuthError(''); }}
                style={{ color: '#FBBF24', cursor: 'pointer', textDecoration: 'underline' }}
              >
                {isRegisterMode ? 'Already have an account? Sign In' : 'New to Tripzy? Sign Up'}
              </span>
            </div>

            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
              <button
                type="button"
                onClick={handleQuickDemoPassenger}
                disabled={authLoading}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#374151',
                  color: '#FBBF24',
                  border: '1px solid #4B5563',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ⚡ 1-Click Instant Demo Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
