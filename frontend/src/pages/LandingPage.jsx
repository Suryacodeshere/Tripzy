import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';

const POPULAR_LOCATIONS = [
  { name: 'Connaught Place, New Delhi', lat: 28.6304, lon: 77.2177 },
  { name: 'Indiranagar, Bangalore', lat: 12.9719, lon: 77.6412 },
  { name: 'MG Road, Bangalore', lat: 12.9756, lon: 77.6068 },
  { name: 'Delhi Airport (IGI T3)', lat: 28.5562, lon: 77.1000 },
  { name: 'Cyber Hub, Gurugram', lat: 28.4986, lon: 77.0878 },
  { name: 'Koramangala, Bangalore', lat: 12.9352, lon: 77.6245 }
];

export default function LandingPage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  // Booking Widget State
  const [pickup, setPickup] = useState('');
  const [drop, setDrop] = useState('');
  const [pickupLoc, setPickupLoc] = useState(null);
  const [dropLoc, setDropLoc] = useState(null);
  const [selectedService, setSelectedService] = useState('bike');
  
  const [suggestions, setSuggestions] = useState([]);
  const [activeSearch, setActiveSearch] = useState(''); // 'pickup' | 'drop' | ''
  const [loadingGeocode, setLoadingGeocode] = useState(false);
  const debounceTimer = useRef(null);

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

    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/rides/geocode/search?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setSuggestions(data);
        }
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

  const handleQuickPick = (loc) => {
    const coords = {
      type: 'Point',
      coordinates: [loc.lon, loc.lat]
    };
    if (!pickup) {
      setPickup(loc.name);
      setPickupLoc(coords);
    } else {
      setDrop(loc.name);
      setDropLoc(coords);
    }
    setSuggestions([]);
    setActiveSearch('');
  };

  const resolveGeocode = async (address) => {
    try {
      const res = await fetch(`/api/rides/geocode/search?q=${encodeURIComponent(address)}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return {
          type: 'Point',
          coordinates: [parseFloat(data[0].lon), parseFloat(data[0].lat)]
        };
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
                  Dashboard ({user.name.split(' ')[0]}) →
                </button>
                <button onClick={logout} className="btn-rapido-outline">
                  Logout
                </button>
              </div>
            ) : (
              <div className="guest-action-group">
                <Link to="/login" className="btn-rapido-link">Login</Link>
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
                      >
                        <span className="icon">📍</span>
                        <span className="text">{item.display_name}</span>
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
                      >
                        <span className="icon">🏁</span>
                        <span className="text">{item.display_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Popular quick-pick pills */}
              <div className="landing-quick-pills">
                <span className="quick-label">⚡ Quick:</span>
                {POPULAR_LOCATIONS.map((loc, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="landing-pill-btn"
                    onClick={() => handleQuickPick(loc)}
                  >
                    {loc.name.split(',')[0]}
                  </button>
                ))}
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

          {/* Right Column: Fleet Visual Graphic (Bike, Auto, Cab) */}
          <div className="hero-right-column">
            <div className="hero-image-card">
              <div className="city-backdrop">
                <div className="building b1"></div>
                <div className="building b2"></div>
                <div className="building b3"></div>
                <div className="building b4"></div>
              </div>

              {/* Composition of Vehicles */}
              <div className="fleet-illustration-wrapper">
                {/* Bike Taxi Illustration */}
                <div className="fleet-vehicle bike-visual">
                  <div className="driver-helmet"></div>
                  <div className="bike-body">
                    <span className="badge-text">tripzy</span>
                  </div>
                  <div className="wheel wheel-front"></div>
                  <div className="wheel wheel-back"></div>
                </div>

                {/* Auto Rickshaw Illustration */}
                <div className="fleet-vehicle auto-visual">
                  <div className="auto-hood"></div>
                  <div className="auto-cabin">
                    <div className="windshield"></div>
                    <span className="auto-badge">tripzy auto</span>
                  </div>
                  <div className="auto-wheel front"></div>
                  <div className="auto-wheel back"></div>
                </div>

                {/* City Cab Illustration */}
                <div className="fleet-vehicle cab-visual">
                  <div className="cab-roof-sign">TAXI</div>
                  <div className="cab-glass"></div>
                  <div className="cab-body">
                    <span className="cab-badge">tripzy cab</span>
                  </div>
                  <div className="cab-wheel front"></div>
                  <div className="cab-wheel back"></div>
                </div>
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
              <Link to="/login" className="btn-rapido-black-large">
                Register as a Driver ➔
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
