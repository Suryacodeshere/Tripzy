import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';

export default function LandingPage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  // Booking Widget State
  const [activeTab, setActiveTab] = useState('sedan');
  const [pickup, setPickup] = useState('');
  const [drop, setDrop] = useState('');
  const [pickupDate, setPickupDate] = useState('Today');
  const [pickupTime, setPickupTime] = useState('Now (Instant)');
  const [passengerCount, setPassengerCount] = useState(1);
  const [quickFare, setQuickFare] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Sample fleet specifications
  const fleetData = [
    {
      id: 'bike',
      name: 'Tripzy Moto (Bike Taxi)',
      badge: 'Fastest in Traffic',
      icon: '🛵',
      rate: '₹7 / km',
      base: '₹20 base fare',
      capacity: '1 Passenger',
      luggage: 'Backpack only',
      features: ['Beats Peak Traffic', 'Instant 60s Dispatch', '🌿 Saves ~105g CO₂/km'],
      description: 'Ideal for solo daily office and college commutes through heavy metropolitan congestion.'
    },
    {
      id: 'auto',
      name: 'Tripzy City Auto',
      badge: 'Everyday Budget',
      icon: '🛺',
      rate: '₹10 / km',
      base: '₹30 base fare',
      capacity: '3 Passengers',
      luggage: 'Medium Bag',
      features: ['Meter-Honest Fares', 'Clean CNG Fleet', '🌿 Saves ~75g CO₂/km'],
      description: 'The quintessential Indian city ride with zero cancellation haggling and transparent rates.'
    },
    {
      id: 'sedan',
      name: 'Tripzy Comfort (Sedan)',
      badge: 'Most Popular',
      icon: '🚗',
      rate: '₹13 / km',
      base: '₹50 base fare',
      capacity: '4 Passengers',
      luggage: '2 Large Suitcases',
      features: ['Guaranteed AC Cabin', 'Silent Ride Option', 'Airport Luggage Boot'],
      description: 'Air-conditioned premium sedans with top-rated drivers for seamless family and business travel.'
    },
    {
      id: 'suv',
      name: 'Tripzy Premier (SUV)',
      badge: 'Luxury & Groups',
      icon: '🚙',
      rate: '₹17 / km',
      base: '₹75 base fare',
      capacity: '6 Passengers',
      luggage: '4 Large Suitcases',
      features: ['Executive Leather', 'Spacious Legroom', 'Outstation & Event Ready'],
      description: 'High-end spacious SUVs tailored for group travel, wedding events, and luxury airport shuttles.'
    }
  ];

  // Quick Fare Estimator
  const handleCalculateQuickFare = () => {
    if (!pickup || !drop) {
      alert('Please enter both pickup and destination locations to calculate fare.');
      return;
    }
    setIsCalculating(true);
    setTimeout(() => {
      // Approximate estimates based on vehicle tier
      const estimates = {
        bike: 85,
        auto: 130,
        sedan: 185,
        suv: 260
      };
      setQuickFare(estimates[activeTab] || 185);
      setIsCalculating(false);
    }, 400);
  };

  const handleBookNow = (vehicleType = activeTab) => {
    if (!token) {
      navigate('/login');
    } else if (user?.role === 'driver') {
      navigate('/driver');
    } else {
      navigate('/passenger');
    }
  };

  return (
    <div className="marlin-taxi-landing">
      {/* Top Banner Announcement */}
      <div className="top-taxi-banner">
        <div className="banner-content">
          <span>🚕 <strong>Tripzy Taxi Service:</strong> Guaranteed Zero-Cancellation Rides & Bilateral Return Surge Shield!</span>
          <span className="banner-contact">📞 24/7 Helpline: <strong>+91 800-TRIPZY</strong></span>
        </div>
      </div>

      {/* Marlin Style Sticky Header */}
      <header className="marlin-header">
        <div className="header-container">
          <Link to="/" className="marlin-logo">
            <span className="logo-badge">🚕</span>
            <div className="logo-text">
              <span className="brand-title">TRIPZY</span>
              <span className="brand-sub">TAXI & MOBILITY</span>
            </div>
          </Link>

          <nav className="marlin-nav">
            <a href="#hero">Home</a>
            <a href="#booking">Book Taxi</a>
            <a href="#fleet">Our Fleet</a>
            <a href="#differentiators">Why Tripzy</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#driver-cta">Drive With Us</a>
          </nav>

          <div className="header-actions">
            {token && user ? (
              <div className="logged-actions">
                <button
                  onClick={() => navigate(user.role === 'driver' ? '/driver' : user.role === 'admin' ? '/admin' : '/passenger')}
                  className="btn btn-taxi"
                >
                  Dashboard ({user.name.split(' ')[0]}) →
                </button>
                <button onClick={logout} className="btn btn-outline-light">
                  Logout
                </button>
              </div>
            ) : (
              <div className="guest-actions">
                <Link to="/login" className="btn btn-outline-light">Login</Link>
                <Link to="/login" className="btn btn-taxi">Book Taxi</Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* HERO SECTION with Marlin Floating Booking Widget */}
      <section id="hero" className="marlin-hero">
        <div className="hero-overlay"></div>
        <div className="hero-content-wrapper">
          <div className="hero-left">
            <div className="hero-badge">
              <span>🚖 Modern City Cab Booking</span>
            </div>
            <h1 className="hero-title">
              Fast, Safe & <span className="highlight-yellow">Transparent</span> City Taxi Rides
            </h1>
            <p className="hero-subtitle">
              Experience the next-generation ride-hailing platform with upfront zero-cancellation corridors, 
              verified safety PINs, and guaranteed return trip surge shields.
            </p>

            {/* Quick Hero Features List */}
            <div className="hero-feature-tags">
              <div className="tag-item"><span>⚡</span> 60s Fast Dispatch</div>
              <div className="tag-item"><span>🛡️</span> Zero Phantom Bookings</div>
              <div className="tag-item"><span>🌿</span> Carbon-Offset Commute</div>
              <div className="tag-item"><span>🔐</span> 4-Digit Security PIN</div>
            </div>

            <div className="hero-stats-row">
              <div className="stat-box">
                <strong>15K+</strong>
                <span>Happy Riders</span>
              </div>
              <div className="stat-separator"></div>
              <div className="stat-box">
                <strong>500+</strong>
                <span>Verified Drivers</span>
              </div>
              <div className="stat-separator"></div>
              <div className="stat-box">
                <strong>4.9 ★</strong>
                <span>Customer Rating</span>
              </div>
            </div>
          </div>

          {/* FLOATING MARLIN BOOKING WIDGET */}
          <div id="booking" className="hero-right">
            <div className="booking-widget-card glass-panel">
              <div className="widget-header">
                <h3>Book Your Taxi Online</h3>
                <p>Instant quotes & guaranteed pre-committed fares</p>
              </div>

              {/* Ride Type Selector Tabs */}
              <div className="vehicle-tab-row">
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'bike' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('bike'); setQuickFare(null); }}
                >
                  <span>🛵</span> Moto
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'auto' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('auto'); setQuickFare(null); }}
                >
                  <span>🛺</span> Auto
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'sedan' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('sedan'); setQuickFare(null); }}
                >
                  <span>🚗</span> Sedan
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'suv' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('suv'); setQuickFare(null); }}
                >
                  <span>🚙</span> SUV
                </button>
              </div>

              {/* Inputs Form */}
              <div className="widget-form">
                <div className="input-field-group">
                  <label>🟢 Pickup Location</label>
                  <input
                    type="text"
                    placeholder="Enter pickup address or landmark..."
                    value={pickup}
                    onChange={(e) => setPickup(e.target.value)}
                  />
                  <div className="quick-presets">
                    <span onClick={() => setPickup('Indiranagar 100ft Road')}>Indiranagar</span>
                    <span onClick={() => setPickup('Koramangala 5th Block')}>Koramangala</span>
                    <span onClick={() => setPickup('MG Road Metro Station')}>MG Road</span>
                  </div>
                </div>

                <div className="input-field-group">
                  <label>🔴 Drop-Off Destination</label>
                  <input
                    type="text"
                    placeholder="Enter destination, airport or venue..."
                    value={drop}
                    onChange={(e) => setDrop(e.target.value)}
                  />
                  <div className="quick-presets">
                    <span onClick={() => setDrop('Kempegowda International Airport')}>Airport T1</span>
                    <span onClick={() => setDrop('Electronic City Phase 1')}>Electronic City</span>
                    <span onClick={() => setDrop('Whitefield ITPL')}>Whitefield</span>
                  </div>
                </div>

                <div className="dual-inputs-row">
                  <div className="input-field-group">
                    <label>📅 Travel Date</label>
                    <select value={pickupDate} onChange={(e) => setPickupDate(e.target.value)}>
                      <option value="Today">Today</option>
                      <option value="Tomorrow">Tomorrow</option>
                      <option value="This Weekend">This Weekend</option>
                    </select>
                  </div>
                  <div className="input-field-group">
                    <label>⏱️ Departure</label>
                    <select value={pickupTime} onChange={(e) => setPickupTime(e.target.value)}>
                      <option value="Now (Instant)">Now (Instant)</option>
                      <option value="In 1 Hour">In 1 Hour</option>
                      <option value="Tonight (~11:00 PM)">Tonight (~11:00 PM)</option>
                    </select>
                  </div>
                </div>

                {/* Quick Fare Quote Output */}
                {quickFare && (
                  <div className="quick-fare-box animate-slide">
                    <div className="fare-left">
                      <span className="fare-title">Estimated Total Fare:</span>
                      <span className="fare-tag">0% Hidden Surge • Guaranteed</span>
                    </div>
                    <div className="fare-amount">
                      ₹{quickFare}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="widget-actions">
                  {!quickFare ? (
                    <button
                      type="button"
                      onClick={handleCalculateQuickFare}
                      disabled={isCalculating}
                      className="btn btn-outline-yellow"
                      style={{ width: '100%', padding: '12px' }}
                    >
                      {isCalculating ? 'Calculating Route...' : '🔍 Estimate Fare & Route'}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => handleBookNow(activeTab)}
                    className="btn btn-taxi-large pulse-primary"
                    style={{ width: '100%' }}
                  >
                    🚀 Confirm & Book Taxi Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS STRIP */}
      <section className="marlin-stats-strip">
        <div className="strip-container">
          <div className="strip-item">
            <span className="icon">⏱️</span>
            <div>
              <h4>Average 3.5 Min Pickup</h4>
              <p>Fastest driver dispatch in high-density corridors</p>
            </div>
          </div>
          <div className="strip-item">
            <span className="icon">🛡️</span>
            <div>
              <h4>Bilateral Return Shield</h4>
              <p>Lock return rides with pre-committed drivers</p>
            </div>
          </div>
          <div className="strip-item">
            <span className="icon">🌿</span>
            <div>
              <h4>Eco Carbon Offset</h4>
              <p>Track real-time grams of CO₂ saved on every trip</p>
            </div>
          </div>
          <div className="strip-item">
            <span className="icon">💳</span>
            <div>
              <h4>Transparent Fares</h4>
              <p>Direct UPI, Cards, or Cash with zero driver disputes</p>
            </div>
          </div>
        </div>
      </section>

      {/* OUR FLEET SHOWCASE */}
      <section id="fleet" className="marlin-fleet-section">
        <div className="section-header">
          <span className="sub-title">SELECT YOUR PREFERRED RIDE</span>
          <h2>Our Modern Taxi & Vehicle Fleet</h2>
          <p>From rapid traffic-beating two-wheelers to premium executive sedans, we have the perfect ride for every journey.</p>
        </div>

        <div className="fleet-grid">
          {fleetData.map((car) => (
            <div key={car.id} className="fleet-card glass-panel">
              <div className="card-top">
                <span className="fleet-badge">{car.badge}</span>
                <span className="vehicle-big-icon">{car.icon}</span>
              </div>
              <h3 className="car-name">{car.name}</h3>
              <p className="car-desc">{car.description}</p>

              <div className="car-specs">
                <div className="spec-item">
                  <span>👥</span> {car.capacity}
                </div>
                <div className="spec-item">
                  <span>🧳</span> {car.luggage}
                </div>
              </div>

              <div className="car-features-list">
                {car.features.map((feat, i) => (
                  <div key={i} className="feature-pill">✓ {feat}</div>
                ))}
              </div>

              <div className="card-footer">
                <div className="price-tag">
                  <span className="rate">{car.rate}</span>
                  <span className="base-note">{car.base}</span>
                </div>
                <button onClick={() => handleBookNow(car.id)} className="btn btn-taxi-small">
                  Select & Book
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DIFFERENTIATING ADVANTAGES (Why Choose Us vs Uber / Rapido) */}
      <section id="differentiators" className="marlin-features-section">
        <div className="section-header">
          <span className="sub-title">BUILT FOR TRUST & SUSTAINABILITY</span>
          <h2>Why Tripzy Beats Traditional Ride Apps</h2>
          <p>Engineered based on recent academic transport research to eliminate cancellations, hidden surges, and safety risks.</p>
        </div>

        <div className="features-grid">
          <div className="feature-box glass-panel">
            <div className="feature-icon">🛡️</div>
            <h3>Bilateral Return Surge Shield</h3>
            <p>
              Never get stranded at an airport or late-night concert. Lock your return ride in advance 
              with pre-committed backhaul drivers at guaranteed non-surge pricing.
            </p>
          </div>

          <div className="feature-box glass-panel">
            <div className="feature-icon">🔐</div>
            <h3>4-Digit Security PIN Verification</h3>
            <p>
              Eliminate ride mix-ups and unauthorized pickups. Drivers cannot start the trip until they 
              verify your unique secret 4-digit PIN generated on your screen.
            </p>
          </div>

          <div className="feature-box glass-panel">
            <div className="feature-icon">🌿</div>
            <h3>Green Routing & Carbon Metrics</h3>
            <p>
              Every ride calculates exact grams of CO₂ offset compared to single-occupancy petrol cars. 
              Help your city breathe cleaner with eco-optimized routing.
            </p>
          </div>

          <div className="feature-box glass-panel">
            <div className="feature-icon">❄️</div>
            <h3>Upfront Comfort & AC Agreement</h3>
            <p>
              Zero awkward driver arguments over air conditioning. Drivers agree to your pre-trip comfort 
              pact upfront with fair fuel compensation.
            </p>
          </div>

          <div className="feature-box glass-panel">
            <div className="feature-icon">📍</div>
            <h3>Live GPS & Route Polyline Guidance</h3>
            <p>
              Track your driver's real-time approach live on OpenStreetMap with sub-second WebSocket updates 
              and turn-by-turn OSRM routing.
            </p>
          </div>

          <div className="feature-box glass-panel">
            <div className="feature-icon">💳</div>
            <h3>Integrated Razorpay & UPI Payments</h3>
            <p>
              Seamless payment checkout with UPI, credit cards, or cash directly into the driver's payout, 
              eliminating the primary cause of driver cancellations.
            </p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="marlin-steps-section">
        <div className="section-header">
          <span className="sub-title">SIMPLE 3-STEP PROCESS</span>
          <h2>How To Book Your Ride in 60 Seconds</h2>
        </div>

        <div className="steps-container">
          <div className="step-card">
            <div className="step-number">01</div>
            <h4>Choose Route & Car</h4>
            <p>Enter your pickup and drop locations, pick your favorite vehicle tier, and see transparent fare quotes.</p>
          </div>
          <div className="step-arrow">➔</div>
          <div className="step-card">
            <div className="step-number">02</div>
            <h4>Match & Get PIN</h4>
            <p>Nearby drivers accept instantly. Receive your driver's details and your secret 4-digit start security PIN.</p>
          </div>
          <div className="step-arrow">➔</div>
          <div className="step-card">
            <div className="step-number">03</div>
            <h4>Enjoy the Journey</h4>
            <p>Track your route live on the map. Pay easily via UPI or cash upon arrival with zero hidden surcharges.</p>
          </div>
        </div>
      </section>

      {/* DRIVER CTA BANNER */}
      <section id="driver-cta" className="marlin-driver-banner">
        <div className="driver-banner-card glass-panel">
          <div className="banner-left">
            <span className="sub-badge">DRIVE & EARN</span>
            <h2>Earn More With Zero Platform Commission</h2>
            <p>
              Join 500+ driver partners who keep 100% of their fares. Benefit from pre-scheduled return trips 
              to eliminate deadheading and maximize your daily earnings.
            </p>
            <div className="driver-perks">
              <span>✓ Instant Daily UPI Payouts</span>
              <span>✓ Backhaul Return Corridor Matching</span>
              <span>✓ Zero Arbitrary Penalties</span>
            </div>
            <Link to="/login" className="btn btn-taxi-large">
              Apply as a Driver Partner ➔
            </Link>
          </div>
          <div className="banner-right">
            <div className="earnings-preview-card">
              <span className="preview-label">Average Monthly Driver Earnings</span>
              <span className="preview-amount">₹42,500+</span>
              <span className="preview-sub">Based on 6-8 trips/day in Bangalore & Delhi</span>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="marlin-footer">
        <div className="footer-container">
          <div className="footer-col brand-col">
            <div className="footer-logo">
              <span>🚕</span> TRIPZY TAXI
            </div>
            <p>The modern, reliable, and eco-conscious ride-sharing platform for Indian cities.</p>
            <div className="copyright-text">
              © 2026 Tripzy Technologies Inc. All rights reserved.
            </div>
          </div>

          <div className="footer-col">
            <h5>Our Services</h5>
            <ul>
              <li><a href="#fleet">Moto Bike Taxi</a></li>
              <li><a href="#fleet">City Auto Rickshaw</a></li>
              <li><a href="#fleet">Comfort Sedans</a></li>
              <li><a href="#fleet">Executive Premier SUVs</a></li>
              <li><a href="#booking">Airport Shuttles</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h5>Innovations</h5>
            <ul>
              <li><a href="#differentiators">Bilateral Return Shield</a></li>
              <li><a href="#differentiators">4-Digit Security PIN</a></li>
              <li><a href="#differentiators">Carbon Offset Calculator</a></li>
              <li><a href="#differentiators">Driver Backhaul Matching</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h5>Get in Touch</h5>
            <p>📍 Koramangala 4th Block, Bangalore, Karnataka</p>
            <p>📧 support@tripzytaxi.com</p>
            <p>📞 +91 800-TRIPZY (24/7 Helpline)</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
