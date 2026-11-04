import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';

export default function LandingPage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  // Booking Widget State
  const [pickup, setPickup] = useState('');
  const [drop, setDrop] = useState('');
  const [pickupLoc, setPickupLoc] = useState(null);
  const [dropLoc, setDropLoc] = useState(null);
  const [liveCoords, setLiveCoords] = useState(null); // [lon, lat]
  const [selectedService, setSelectedService] = useState('bike');
  
  const [suggestions, setSuggestions] = useState([]);
  const [activeSearch, setActiveSearch] = useState(''); // 'pickup' | 'drop' | ''
  const [loadingGeocode, setLoadingGeocode] = useState(false);
  const debounceTimer = useRef(null);

  // Auto-detect user live location for search biasing
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLiveCoords([pos.coords.longitude, pos.coords.latitude]),
        () => {},
        { timeout: 7000 }
      );
    }
  }, []);

  const services = [
    {
      id: 'bike',
      name: 'Bike-Taxi',
      tagline: 'Beat traffic, ride quicker',
      price: 'From ₹20',
      icon: (
        <svg viewBox="0 0 120 80" className="service-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="28" cy="54" r="18" stroke="#1F2937" strokeWidth="6" fill="#F3F4F6"/>
          <circle cx="28" cy="54" r="8" fill="#FBBF24"/>
          <circle cx="92" cy="54" r="18" stroke="#1F2937" strokeWidth="6" fill="#F3F4F6"/>
          <circle cx="92" cy="54" r="8" fill="#FBBF24"/>
          <path d="M28 54L48 34H68L80 54" stroke="#111827" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M48 34L40 18H54" stroke="#FBBF24" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M68 34L86 24H94" stroke="#111827" strokeWidth="4" strokeLinecap="round"/>
          <circle cx="56" cy="12" r="7" fill="#FBBF24"/>
          <path d="M50 20C50 20 54 28 66 28" stroke="#111827" strokeWidth="5" strokeLinecap="round"/>
        </svg>
      )
    },
    {
      id: 'auto',
      name: 'Auto',
      tagline: 'Everyday autos, made easy',
      price: 'From ₹30',
      icon: (
        <svg viewBox="0 0 120 80" className="service-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="26" cy="56" r="16" stroke="#1F2937" strokeWidth="6" fill="#F3F4F6"/>
          <circle cx="94" cy="56" r="16" stroke="#1F2937" strokeWidth="6" fill="#F3F4F6"/>
          <path d="M16 48L24 24H52L60 16H84L102 36V56H26" stroke="#059669" strokeWidth="4" fill="#10B981" fillOpacity="0.2"/>
          <path d="M30 24H50V40H22L30 24Z" fill="#FBBF24"/>
          <rect x="54" y="24" width="28" height="18" rx="2" fill="#93C5FD" fillOpacity="0.8"/>
          <path d="M18 46H102" stroke="#FBBF24" strokeWidth="4" strokeLinecap="round"/>
          <circle cx="26" cy="56" r="6" fill="#111827"/>
          <circle cx="94" cy="56" r="6" fill="#111827"/>
        </svg>
      )
    },
    {
      id: 'cab',
      name: 'Cab',
      tagline: 'Comfort for every journey',
      price: 'From ₹50',
      icon: (
        <svg viewBox="0 0 120 80" className="service-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="56" r="15" stroke="#1F2937" strokeWidth="5" fill="#F3F4F6"/>
          <circle cx="88" cy="56" r="15" stroke="#1F2937" strokeWidth="5" fill="#F3F4F6"/>
          <path d="M14 50L22 36L42 22H78L98 36L108 44V56H14V50Z" fill="#F9FAFB" stroke="#111827" strokeWidth="4"/>
          <rect x="44" y="16" width="32" height="6" rx="2" fill="#FBBF24"/>
          <path d="M44 26H58V38H28L44 26Z" fill="#93C5FD" fillOpacity="0.8"/>
          <path d="M62 26H76L90 38H62V26Z" fill="#93C5FD" fillOpacity="0.8"/>
          <circle cx="32" cy="56" r="6" fill="#FBBF24"/>
          <circle cx="88" cy="56" r="6" fill="#FBBF24"/>
          <path d="M14 44H108" stroke="#FBBF24" strokeWidth="3"/>
        </svg>
      )
    },
    {
      id: 'return',
      name: 'Return Lock',
      tagline: 'Guaranteed ride home, 0% surge',
      price: 'Surge Shield',
      icon: (
        <svg viewBox="0 0 120 80" className="service-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M60 12L88 24V44C88 60 60 72 60 72C60 72 32 60 32 44V24L60 12Z" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="4"/>
          <path d="M50 40L58 48L72 32" stroke="#D97706" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    }
  ];

  const handleSearchChange = (val, type) => {
    if (type === 'pickup') {
      setPickup(val);
      setPickupLoc(null);
    } else {
      setDrop(val);
      setDropLoc(null);
    }
    setActiveSearch(type);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!val || val.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const refCoords = (type === 'drop' && pickupLoc?.coordinates)
      ? pickupLoc.coordinates
      : (liveCoords || pickupLoc?.coordinates || null);

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

    debounceTimer.current = setTimeout(async () => {
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
        } catch (e) {}

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
      } catch (e) {
        console.error('Landing geocode error:', e);
      }
    }, 350);
  };

  const handleSelectSuggestion = (item, type) => {
    const coords = {
      type: 'Point',
      coordinates: [parseFloat(item.lon), parseFloat(item.lat)]
    };
    if (type === 'pickup') {
      setPickup(item.display_name);
      setPickupLoc(coords);
    } else {
      setDrop(item.display_name);
      setDropLoc(coords);
    }
    setSuggestions([]);
    setActiveSearch('');
  };

  const resolveGeocode = async (address) => {
    const biasParams = liveCoords ? `&lat=${liveCoords[1]}&lon=${liveCoords[0]}` : '';
    try {
      const res = await fetch(`/api/rides/geocode/search?q=${encodeURIComponent(address)}${biasParams}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0 && !data[0].display_name?.includes('(Simulated Location)')) {
          return {
            type: 'Point',
            coordinates: [parseFloat(data[0].lon), parseFloat(data[0].lat)]
          };
        }
      }
    } catch (e) {}

    try {
      const directRes = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(address)}${biasParams}&limit=1`);
      if (directRes.ok) {
        const data = await directRes.json();
        if (data.features && data.features.length > 0) {
          return {
            type: 'Point',
            coordinates: data.features[0].geometry.coordinates
          };
        }
      }
    } catch (e) {}

    return {
      type: 'Point',
      coordinates: [77.2177, 28.6304]
    };
  };

  const handleBookClick = async (overrideService) => {
    if (user?.role === 'driver') {
      navigate('/driver');
      return;
    }

    setLoadingGeocode(true);

    let finalPickup = pickup.trim();
    let finalDrop = drop.trim();
    let finalPickupLoc = pickupLoc;
    let finalDropLoc = dropLoc;

    if (!finalPickup) {
      finalPickup = 'Connaught Place, New Delhi';
      finalPickupLoc = { type: 'Point', coordinates: [77.2177, 28.6304] };
      setPickup(finalPickup);
      setPickupLoc(finalPickupLoc);
    }

    if (!finalDrop) {
      finalDrop = 'Delhi Airport (IGI T3)';
      finalDropLoc = { type: 'Point', coordinates: [77.1000, 28.5562] };
      setDrop(finalDrop);
      setDropLoc(finalDropLoc);
    }

    if (!finalPickupLoc) {
      finalPickupLoc = await resolveGeocode(finalPickup);
      setPickupLoc(finalPickupLoc);
    }

    if (!finalDropLoc) {
      finalDropLoc = await resolveGeocode(finalDrop);
      setDropLoc(finalDropLoc);
    }

    setLoadingGeocode(false);

    const vehicleTypeToPass = overrideService || (selectedService === 'cab' ? 'sedan' : selectedService);

    navigate('/passenger', {
      state: {
        pickupAddress: finalPickup,
        dropAddress: finalDrop,
        pickupLoc: finalPickupLoc,
        dropLoc: finalDropLoc,
        vehicleType: vehicleTypeToPass
      }
    });
  };

  return (
    <div className="rapido-theme-app">
      {/* 1. TOP NAVBAR (Matching Rapido's clean white & yellow bar) */}
      <header className="rapido-navbar">
        <div className="nav-container">
          <Link to="/" className="brand-logo">
            <span className="yellow-pill">tripzy</span>
          </Link>

          <nav className="nav-menu">
            <a href="#home" className="active">Home</a>
            <a href="#services">Our Services</a>
            <a href="#safety">Safety</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#driver-portal">Drive with Us</a>
            <a href="#contact">Contact Us</a>
          </nav>

          <div className="nav-actions">
            {token && user ? (
              <div className="user-action-group">
                <button
                  onClick={() => navigate(user.role === 'driver' ? '/driver' : user.role === 'admin' ? '/admin' : '/passenger')}
                  className="btn-rapido-yellow"
                >
                  {user.role === 'driver' ? 'Driver Console →' : user.role === 'admin' ? 'Operations →' : 'Book a Ride →'}
                </button>
                <div className="landing-profile-pill" title={`${user.name} (${user.role})`}>
                  <div className="landing-avatar">
                    {user.name ? (user.name.trim().split(/\s+/).length > 1 ? (user.name.trim().split(/\s+/)[0][0] + user.name.trim().split(/\s+/)[user.name.trim().split(/\s+/).length - 1][0]).toUpperCase() : user.name.substring(0, 2).toUpperCase()) : 'U'}
                  </div>
                  <span className="landing-user-name">{user.name}</span>
                </div>
                <button onClick={logout} className="btn-rapido-outline">
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="guest-action-group">
                <Link to="/login" className="btn-rapido-link">Login</Link>
                <Link to="/register?role=passenger" className="btn-rapido-outline" style={{ padding: '8px 16px', borderRadius: '20px', fontWeight: 600 }}>Sign Up</Link>
                <Link to="/register?role=driver" className="btn-rapido-outline" style={{ padding: '8px 16px', borderRadius: '20px', fontWeight: 600, background: '#FEF3C7', color: '#92400E', borderColor: '#FCD34D' }}>Drive with Us</Link>
                <button onClick={handleBookClick} className="btn-rapido-black">
                  Book Ride
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION (Exact layout of Image 3: Headline, Quick Inputs, Yellow Button + Fleet Graphic) */}
      <section id="home" className="rapido-hero-section">
        <div className="hero-container">
          {/* Left Column: Booking Form & Copy */}
          <div className="hero-left-column">
            <h1 className="hero-heading">
              India's #1<br />Ride-hailing App
            </h1>
            <p className="hero-tagline">
              Quick, Affordable rides at your doorstep
            </p>

            <div className="rapido-booking-card">
              {/* Pickup Input */}
              <div style={{ position: 'relative' }}>
                <div className="input-row">
                  <div className="input-icon-dot">●</div>
                  <input
                    type="text"
                    placeholder="Enter Pickup Location (e.g. Connaught Place)"
                    value={pickup}
                    onChange={(e) => handleSearchChange(e.target.value, 'pickup')}
                    onFocus={() => { if (pickup && suggestions.length) setActiveSearch('pickup'); }}
                  />
                  {pickup && (
                    <button
                      type="button"
                      onClick={() => { setPickup(''); setPickupLoc(null); setSuggestions([]); }}
                      style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '0.9rem' }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {activeSearch === 'pickup' && suggestions.length > 0 && (
                  <div className="landing-suggestions-dropdown">
                    {suggestions.map((item, idx) => (
                      <div
                        key={idx}
                        className="landing-suggestion-item"
                        onClick={() => handleSelectSuggestion(item, 'pickup')}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                          <span className="icon">📍</span>
                          <span className="text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.display_name}
                          </span>
                        </div>
                        {item.dist != null && (
                          <span style={{ fontSize: '0.72rem', background: '#FEF3C7', color: '#92400E', padding: '2px 7px', borderRadius: '10px', whiteSpace: 'nowrap', fontWeight: 600, marginLeft: '8px' }}>
                            {item.dist < 1 ? '< 1 km' : `${item.dist} km`}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Drop Input */}
              <div style={{ position: 'relative' }}>
                <div className="input-row">
                  <div className="input-icon-ring">○</div>
                  <input
                    type="text"
                    placeholder="Enter Drop Location (e.g. Airport T3)"
                    value={drop}
                    onChange={(e) => handleSearchChange(e.target.value, 'drop')}
                    onFocus={() => { if (drop && suggestions.length) setActiveSearch('drop'); }}
                  />
                  {drop && (
                    <button
                      type="button"
                      onClick={() => { setDrop(''); setDropLoc(null); setSuggestions([]); }}
                      style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '0.9rem' }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {activeSearch === 'drop' && suggestions.length > 0 && (
                  <div className="landing-suggestions-dropdown">
                    {suggestions.map((item, idx) => (
                      <div
                        key={idx}
                        className="landing-suggestion-item"
                        onClick={() => handleSelectSuggestion(item, 'drop')}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                          <span className="icon">🏁</span>
                          <span className="text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.display_name}
                          </span>
                        </div>
                        {item.dist != null && (
                          <span style={{ fontSize: '0.72rem', background: '#FEF3C7', color: '#92400E', padding: '2px 7px', borderRadius: '10px', whiteSpace: 'nowrap', fontWeight: 600, marginLeft: '8px' }}>
                            {item.dist < 1 ? '< 1 km' : `${item.dist} km`}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => handleBookClick()}
                className="btn-rapido-book-full"
                disabled={loadingGeocode}
              >
                {loadingGeocode ? 'Preparing Route...' : 'Book Ride →'}
              </button>
            </div>
          </div>

          {/* Right Column: Fleet Visual Graphic (Realistic Bike Taxi, Auto Rickshaw, Cab Vector Illustrations) */}
          <div className="hero-right-column">
            <div className="hero-image-card">
              <div className="city-backdrop">
                <div className="building b1"></div>
                <div className="building b2"></div>
                <div className="building b3"></div>
                <div className="building b4"></div>
              </div>

              {/* Dynamic Feature Floating Badges */}
              <div className="hero-floating-badges">
                <div className="hero-pill-badge badge-fast">⚡ 2-Min Fast Pickup</div>
                <div className="hero-pill-badge badge-pin">🛡️ 4-Digit Security PIN</div>
                <div className="hero-pill-badge badge-surge">🌿 0% Surge Return Shield</div>
              </div>

              {/* Composition of Real Vehicle Vector Illustrations */}
              <div className="fleet-illustration-wrapper">
                {/* 1. Bike Taxi (Rapido Motorcycle with Driver Helmet) */}
                <div className="fleet-card bike-card">
                  <div className="vehicle-tag">🛵 Bike-Taxi</div>
                  <svg viewBox="0 0 220 140" className="vehicle-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <ellipse cx="110" cy="132" rx="90" ry="6" fill="#000000" fillOpacity="0.14" />
                    {/* Rear Wheel */}
                    <circle cx="50" cy="105" r="28" fill="#1F2937" stroke="#111827" strokeWidth="3" />
                    <circle cx="50" cy="105" r="18" fill="#E5E7EB" stroke="#F59E0B" strokeWidth="4" />
                    <circle cx="50" cy="105" r="7" fill="#111827" />
                    <line x1="50" y1="87" x2="50" y2="123" stroke="#9CA3AF" strokeWidth="2" />
                    <line x1="32" y1="105" x2="68" y2="105" stroke="#9CA3AF" strokeWidth="2" />
                    {/* Front Wheel */}
                    <circle cx="170" cy="105" r="28" fill="#1F2937" stroke="#111827" strokeWidth="3" />
                    <circle cx="170" cy="105" r="18" fill="#E5E7EB" stroke="#F59E0B" strokeWidth="4" />
                    <circle cx="170" cy="105" r="7" fill="#111827" />
                    <line x1="170" y1="87" x2="170" y2="123" stroke="#9CA3AF" strokeWidth="2" />
                    <line x1="152" y1="105" x2="188" y2="105" stroke="#9CA3AF" strokeWidth="2" />
                    {/* Exhaust pipe */}
                    <path d="M75 106L110 106L130 96" stroke="#4B5563" strokeWidth="5" strokeLinecap="round" />
                    <path d="M42 112L90 112" stroke="#9CA3AF" strokeWidth="6" strokeLinecap="round" />
                    {/* Chassis & Engine */}
                    <path d="M50 105L85 85L120 100L100 110L65 110Z" fill="#374151" stroke="#111827" strokeWidth="2" />
                    <rect x="85" y="90" width="22" height="18" rx="3" fill="#1F2937" stroke="#4B5563" strokeWidth="2" />
                    <line x1="88" y1="94" x2="104" y2="94" stroke="#9CA3AF" strokeWidth="1.5" />
                    <line x1="88" y1="98" x2="104" y2="98" stroke="#9CA3AF" strokeWidth="1.5" />
                    <line x1="88" y1="102" x2="104" y2="102" stroke="#9CA3AF" strokeWidth="1.5" />
                    {/* Front Forks & Mudguard */}
                    <line x1="170" y1="105" x2="148" y2="52" stroke="#4B5563" strokeWidth="5" strokeLinecap="round" />
                    <line x1="170" y1="105" x2="150" y2="58" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
                    <path d="M148 85C155 78 175 78 188 88" stroke="#F59E0B" strokeWidth="5" strokeLinecap="round" />
                    {/* Fuel Tank */}
                    <path d="M102 62C108 52 126 50 144 58L148 68L112 75Z" fill="#FDB813" stroke="#111827" strokeWidth="3" strokeLinejoin="round" />
                    <path d="M112 56C122 54 135 56 142 62" stroke="#FEF08A" strokeWidth="2" strokeLinecap="round" />
                    {/* Seat */}
                    <path d="M68 66C75 60 92 60 112 68L110 74L70 72Z" fill="#111827" stroke="#111827" strokeWidth="2" />
                    {/* Handlebar & Headlamp */}
                    <path d="M148 52L142 42L132 44" stroke="#111827" strokeWidth="4" strokeLinecap="round" />
                    <circle cx="132" cy="44" r="3" fill="#F59E0B" />
                    <path d="M154 55L166 58V68L152 65Z" fill="#FEF08A" stroke="#111827" strokeWidth="2.5" />
                    {/* Rider with Yellow Helmet */}
                    <path d="M100 48L112 36C118 34 130 38 132 50L135 60L118 64L105 60Z" fill="#1E293B" stroke="#0F172A" strokeWidth="2" />
                    <path d="M120 40L138 48L142 44" stroke="#1E293B" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="142" cy="44" r="3.5" fill="#FDB813" />
                    <circle cx="118" cy="24" r="14" fill="#FDB813" stroke="#111827" strokeWidth="2.5" />
                    <path d="M120 18C126 18 132 23 131 29H120V18Z" fill="#0F172A" stroke="#111827" strokeWidth="1.5" />
                    <rect x="110" y="65" width="28" height="8" rx="2" fill="#111827" />
                    <text x="124" y="71" fill="#FDB813" fontSize="5" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">tripzy</text>
                  </svg>
                  <div className="vehicle-name-label">Fastest in Traffic</div>
                </div>

                {/* 2. Indian Auto Rickshaw (Iconic Yellow & Green Tuk-Tuk) */}
                <div className="fleet-card auto-card">
                  <div className="vehicle-tag">🛺 Auto Rickshaw</div>
                  <svg viewBox="0 0 220 140" className="vehicle-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <ellipse cx="110" cy="132" rx="85" ry="6" fill="#000000" fillOpacity="0.14" />
                    {/* Rear Wheel */}
                    <circle cx="65" cy="110" r="22" fill="#1F2937" stroke="#111827" strokeWidth="3" />
                    <circle cx="65" cy="110" r="13" fill="#E5E7EB" stroke="#F59E0B" strokeWidth="3" />
                    <circle cx="65" cy="110" r="5" fill="#111827" />
                    {/* Front Wheel */}
                    <circle cx="168" cy="110" r="22" fill="#1F2937" stroke="#111827" strokeWidth="3" />
                    <circle cx="168" cy="110" r="13" fill="#E5E7EB" stroke="#F59E0B" strokeWidth="3" />
                    <circle cx="168" cy="110" r="5" fill="#111827" />
                    <path d="M152 95C158 88 176 88 184 96" stroke="#111827" strokeWidth="5" strokeLinecap="round" />
                    <line x1="168" y1="110" x2="160" y2="76" stroke="#4B5563" strokeWidth="4" />
                    {/* Lower Body Green */}
                    <path d="M42 96L55 68H142L162 76L176 96L164 112H50L42 96Z" fill="#059669" stroke="#111827" strokeWidth="3" strokeLinejoin="round" />
                    <path d="M42 96H176" stroke="#FDB813" strokeWidth="4" />
                    {/* Passenger Cabin */}
                    <path d="M68 68V96H114V68H68Z" fill="#111827" />
                    <rect x="70" y="84" width="22" height="10" rx="2" fill="#D97706" />
                    <line x1="108" y1="68" x2="108" y2="96" stroke="#D1D5DB" strokeWidth="2.5" />
                    {/* Driver */}
                    <circle cx="138" cy="74" r="8" fill="#FDB813" stroke="#111827" strokeWidth="2" />
                    <path d="M132 82C132 82 138 94 148 94" stroke="#1E293B" strokeWidth="8" strokeLinecap="round" />
                    {/* Yellow Hood */}
                    <path d="M46 68C48 40 68 30 115 30C148 30 162 42 165 62L160 68H46Z" fill="#FDB813" stroke="#111827" strokeWidth="3" strokeLinejoin="round" />
                    <path d="M60 36C85 34 135 34 152 42" stroke="#FEF08A" strokeWidth="3" strokeLinecap="round" />
                    {/* Windshield */}
                    <path d="M136 64L148 42H160L155 64H136Z" fill="#BAE6FD" fillOpacity="0.85" stroke="#111827" strokeWidth="2" />
                    <line x1="146" y1="58" x2="152" y2="48" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
                    {/* Headlight */}
                    <circle cx="178" cy="85" r="7" fill="#FEF08A" stroke="#111827" strokeWidth="2" />
                    <path d="M185 80L205 74V96L185 90Z" fill="#FEF08A" fillOpacity="0.35" />
                    {/* Badge */}
                    <rect x="68" y="100" width="38" height="9" rx="2" fill="#111827" />
                    <text x="87" y="107" fill="#FDB813" fontSize="5.5" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">tripzy auto</text>
                  </svg>
                  <div className="vehicle-name-label">Budget City Rides</div>
                </div>

                {/* 3. City Cab (Modern Sedan Taxi) */}
                <div className="fleet-card cab-card">
                  <div className="vehicle-tag">🚕 City Cab</div>
                  <svg viewBox="0 0 220 140" className="vehicle-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <ellipse cx="110" cy="132" rx="95" ry="6" fill="#000000" fillOpacity="0.14" />
                    {/* Rear Wheel */}
                    <circle cx="58" cy="108" r="23" fill="#1F2937" stroke="#111827" strokeWidth="3" />
                    <circle cx="58" cy="108" r="14" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="3" />
                    <circle cx="58" cy="108" r="5" fill="#111827" />
                    {/* Front Wheel */}
                    <circle cx="166" cy="108" r="23" fill="#1F2937" stroke="#111827" strokeWidth="3" />
                    <circle cx="166" cy="108" r="14" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="3" />
                    <circle cx="166" cy="108" r="5" fill="#111827" />
                    {/* Main Sedan Body */}
                    <path d="M22 104L28 84L54 80L80 50H142L178 78L204 88L206 104L196 112H184C182 98 152 98 148 112H76C74 98 44 98 40 112H26L22 104Z" fill="#FFFFFF" stroke="#111827" strokeWidth="3" strokeLinejoin="round" />
                    {/* TAXI Roof Sign 3D */}
                    <path d="M96 50L102 38H126L132 50H96Z" fill="#FDB813" stroke="#111827" strokeWidth="2.5" />
                    <text x="114" y="47" fill="#111827" fontSize="7" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">TAXI</text>
                    {/* Windows */}
                    <path d="M58 78L80 54H106V78H58Z" fill="#BAE6FD" fillOpacity="0.8" stroke="#111827" strokeWidth="2" />
                    <path d="M112 54H138L166 78H112V54Z" fill="#BAE6FD" fillOpacity="0.8" stroke="#111827" strokeWidth="2" />
                    <circle cx="124" cy="66" r="6" fill="#1E293B" />
                    {/* Yellow Taxi Side Stripe */}
                    <path d="M24 92H204V100H24V92Z" fill="#FDB813" />
                    <text x="114" y="98" fill="#111827" fontSize="5.5" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">TRIPZY CAB</text>
                    {/* Headlights */}
                    <path d="M200 88L206 94V100L198 98Z" fill="#FEF08A" stroke="#111827" strokeWidth="1.5" />
                    <path d="M206 90L222 84V104L206 98Z" fill="#FEF08A" fillOpacity="0.3" />
                    <line x1="108" y1="54" x2="108" y2="108" stroke="#111827" strokeWidth="2" />
                  </svg>
                  <div className="vehicle-name-label">Air Conditioned Comfort</div>
                </div>
              </div>

              {/* Asphalt Road Surface with Painted Dashed Markings */}
              <div className="hero-fleet-road">
                <div className="road-stripes"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. OUR SERVICES SECTION (Exact layout of Image 3 with yellow bar & clean cards) */}
      <section id="services" className="rapido-services-section">
        <div className="services-container">
          <div className="services-header">
            <h2>Our Services</h2>
            <div className="yellow-underline-bar"></div>
          </div>

          <div className="services-grid">
            {services.map((item) => (
              <div
                key={item.id}
                className={`service-card ${selectedService === item.id ? 'active' : ''}`}
                onClick={() => { setSelectedService(item.id); handleBookClick(item.id === 'cab' ? 'sedan' : item.id); }}
              >
                <div className="service-text">
                  <h3>{item.name}</h3>
                  <p>{item.tagline}</p>
                  <span className="service-price-pill">{item.price}</span>
                </div>
                <div className="service-graphic">
                  {item.icon}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. SAFETY & KEY ADVANTAGES (Consumer-grade, Zero Academic Jargon) */}
      <section id="safety" className="rapido-safety-section">
        <div className="safety-container">
          <div className="services-header">
            <h2>Safety & Trust Every Ride</h2>
            <div className="yellow-underline-bar"></div>
            <p className="sub-desc">Built with verified drivers and instant safety protocols for complete peace of mind.</p>
          </div>

          <div className="safety-grid">
            <div className="safety-card">
              <div className="safety-icon-circle">🔐</div>
              <h3>4-Digit Security PIN</h3>
              <p>Your driver must enter your secret start PIN before beginning the trip. Never step into the wrong vehicle.</p>
            </div>

            <div className="safety-card">
              <div className="safety-icon-circle">🛡️</div>
              <h3>Guaranteed Return Ride</h3>
              <p>Heading to an event or airport? Pre-lock your return ride with verified drivers heading your way at 0% surge.</p>
            </div>

            <div className="safety-card">
              <div className="safety-icon-circle">❄️</div>
              <h3>Upfront AC & Comfort Pact</h3>
              <p>No awkward discussions over air conditioning. Drivers agree to your comfort preferences with zero extra haggling.</p>
            </div>

            <div className="safety-card">
              <div className="safety-icon-circle">🌿</div>
              <h3>Eco Carbon Offset</h3>
              <p>Track exact grams of CO₂ saved on every trip with our clean and shared mobility options.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. HOW IT WORKS (3 Simple Steps) */}
      <section id="how-it-works" className="rapido-steps-section">
        <div className="steps-container">
          <div className="services-header">
            <h2>How It Works</h2>
            <div className="yellow-underline-bar"></div>
          </div>

          <div className="steps-row">
            <div className="step-item">
              <div className="step-badge">1</div>
              <h4>Set Locations</h4>
              <p>Enter your pickup and destination in just 1 tap on the app.</p>
            </div>
            <div className="step-connector"></div>
            <div className="step-item">
              <div className="step-badge">2</div>
              <h4>Match & Get PIN</h4>
              <p>Get instant driver details and your secret 4-digit start PIN.</p>
            </div>
            <div className="step-connector"></div>
            <div className="step-item">
              <div className="step-badge">3</div>
              <h4>Ride & Pay</h4>
              <p>Track your driver live on the map and pay via UPI, Card, or Cash.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. DRIVE WITH US (Driver Partner Recruitment) */}
      <section id="driver-portal" className="rapido-driver-cta">
        <div className="driver-cta-container">
          <div className="driver-cta-card">
            <div className="cta-content">
              <span className="cta-pill">Partner With Us</span>
              <h2>Earn Up to ₹45,000 / Month</h2>
              <p>Own a Bike, Auto, or Car? Join Tripzy and take home 100% of your earnings with instant daily payouts.</p>
              <div className="cta-benefits">
                <span>✓ Zero Platform Commission</span>
                <span>✓ Pre-committed Return Rides</span>
                <span>✓ Flexible Hours</span>
              </div>
              <Link to="/register?role=driver" className="btn-rapido-black-large">
                Register as a Driver Partner ➔
              </Link>
            </div>
            <div className="cta-image-wrapper">
              <div className="earnings-badge">
                <span className="lbl">Guaranteed Fair Earnings</span>
                <span className="amt">₹1,500+ / day</span>
                <span className="sub">Flexible part-time or full-time</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FOOTER (Matching Clean Corporate Standards) */}
      <footer id="contact" className="rapido-footer">
        <div className="footer-inner">
          <div className="footer-brand-box">
            <span className="yellow-pill">tripzy</span>
            <p>India's trusted everyday ride-hailing app. Fast bike taxis, affordable autos, and comfortable cabs.</p>
            <span className="copy">© 2026 Tripzy Mobility Technologies Pvt. Ltd. All rights reserved.</span>
          </div>

          <div className="footer-links-group">
            <h5>Our Services</h5>
            <a href="#services">Bike Taxi</a>
            <a href="#services">City Auto</a>
            <a href="#services">Comfort Cabs</a>
            <a href="#services">Return Trip Lock</a>
          </div>

          <div className="footer-links-group">
            <h5>Safety & Trust</h5>
            <a href="#safety">4-Digit Security PIN</a>
            <a href="#safety">Zero Surge Shield</a>
            <a href="#safety">24/7 Support Helpline</a>
            <a href="#safety">Verified Drivers</a>
          </div>

          <div className="footer-links-group">
            <h5>Contact</h5>
            <p>📍 Indiranagar, Bangalore, Karnataka</p>
            <p>📧 support@tripzy.bike</p>
            <p>📞 1800-TRIPZY (Toll-Free)</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
