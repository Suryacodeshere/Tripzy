import express from 'express';
import { dbService, calculateDistanceKm } from '../dbService.js';
import { authenticateToken } from './auth.js';
import { socketEmitter } from '../socket.js';

const router = express.Router();

// Multi-Tier Vehicle Pricing Models (Differentiating Bike/Rapido vs Auto vs Sedan vs SUV)
export const VEHICLE_CONFIGS = {
  bike: {
    id: 'bike',
    name: 'Tripzy Moto (Bike)',
    baseFare: 20.00,
    perKm: 7.00,
    perMin: 1.00,
    co2PerKmGrams: 45, // Bike emits 45g CO2/km vs 150g for private car
    icon: '🛵',
    capacity: '1 Rider',
    description: 'Fastest through traffic • Lowest price'
  },
  auto: {
    id: 'auto',
    name: 'Tripzy Auto',
    baseFare: 30.00,
    perKm: 10.00,
    perMin: 1.50,
    co2PerKmGrams: 75, // CNG Auto emits 75g CO2/km
    icon: '🛺',
    capacity: '3 Riders',
    description: 'Everyday budget city commute'
  },
  sedan: {
    id: 'sedan',
    name: 'Tripzy Go (Sedan)',
    baseFare: 50.00,
    perKm: 13.00,
    perMin: 2.00,
    co2PerKmGrams: 140,
    icon: '🚗',
    capacity: '4 Riders',
    description: 'Comfortable air-conditioned ride'
  },
  suv: {
    id: 'suv',
    name: 'Tripzy Premier (SUV)',
    baseFare: 75.00,
    perKm: 17.00,
    perMin: 2.50,
    co2PerKmGrams: 180,
    icon: '🚙',
    capacity: '6 Riders',
    description: 'Spacious for groups and extra luggage'
  }
};

// Benchmark baseline: single occupancy private petrol car emits ~150g CO2/km
const BASELINE_CAR_CO2_PER_KM = 150;

export function calculateVehicleFare(vehicleType = 'sedan', distanceKm, durationMin, surge = 1.0) {
  const cfg = VEHICLE_CONFIGS[vehicleType] || VEHICLE_CONFIGS.sedan;
  const rawFare = (cfg.baseFare + (distanceKm * cfg.perKm) + (durationMin * cfg.perMin)) * surge;
  const fare = Math.round(rawFare);
  // Academic carbon offset metric (grams of CO2 saved compared to a single-occupancy petrol car)
  const carbonSavedGrams = Math.max(0, Math.round((BASELINE_CAR_CO2_PER_KM - cfg.co2PerKmGrams) * distanceKm));
  return { fare, carbonSavedGrams, config: cfg };
}

// Helper: Calculate route from OSRM or fallback
async function getRouteDetails(pickupCoords, dropCoords) {
  const [pickupLng, pickupLat] = pickupCoords;
  const [dropLng, dropLat] = dropCoords;

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${pickupLng},${pickupLat};${dropLng},${dropLat}?overview=full&geometries=geojson`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Tripzy-RideSharing-App/1.0' }
    });
    
    if (!response.ok) {
      throw new Error(`OSRM API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const distanceKm = +(route.distance / 1000).toFixed(2);
      const durationMin = +Math.round(route.duration / 60);
      const geometry = route.geometry; // GeoJSON geometry of the path
      return { distanceKm, durationMin, geometry };
    }
  } catch (error) {
    console.warn('⚠️ OSRM API failed, using Haversine fallback calculation:', error.message);
  }

  // Fallback: straight-line distance with estimation factor
  const straightDistance = calculateDistanceKm(pickupCoords, dropCoords);
  const estimatedDistance = +(straightDistance * 1.3).toFixed(2); // 30% detour factor for roads
  const estimatedDuration = +Math.round(estimatedDistance * 2); // 30 km/h average speed in city traffic (2 min per km)
  
  return {
    distanceKm: estimatedDistance,
    durationMin: estimatedDuration,
    geometry: {
      type: 'LineString',
      coordinates: [pickupCoords, dropCoords] // Straight line route fallback
    }
  };
}

// POST /api/rides/estimate (Route preview without creating a ride - Public)
router.post('/estimate', async (req, res) => {
  const { pickupLoc, dropLoc } = req.body;

  if (!pickupLoc || !pickupLoc.coordinates || !dropLoc || !dropLoc.coordinates) {
    return res.status(400).json({ message: 'Pickup and drop-off coordinates are required for route estimation.' });
  }

  try {
    const { distanceKm, durationMin, geometry } = await getRouteDetails(
      pickupLoc.coordinates,
      dropLoc.coordinates
    );

    // Compute tiered fares and carbon metrics for all vehicle classes
    const estimates = {};
    for (const [key, cfg] of Object.entries(VEHICLE_CONFIGS)) {
      const calc = calculateVehicleFare(key, distanceKm, durationMin);
      estimates[key] = {
        vehicleType: key,
        name: cfg.name,
        icon: cfg.icon,
        capacity: cfg.capacity,
        description: cfg.description,
        fare: calc.fare,
        carbonSavedGrams: calc.carbonSavedGrams
      };
    }

    res.json({
      distanceKm,
      durationMin,
      routeGeometry: geometry,
      estimates
    });
  } catch (error) {
    console.error('Estimate error:', error);
    res.status(500).json({ message: 'Failed to calculate route estimate.' });
  }
});

// POST /api/rides (Request a Ride)
router.post('/', authenticateToken, async (req, res) => {
  const { pickupLoc, pickupAddress, dropLoc, dropAddress, vehicleType = 'sedan' } = req.body;

  if (!pickupLoc || !pickupLoc.coordinates || !dropLoc || !dropLoc.coordinates || !pickupAddress || !dropAddress) {
    return res.status(400).json({ message: 'Pickup and drop-off coordinates and addresses are required.' });
  }

  try {
    const { distanceKm, durationMin, geometry } = await getRouteDetails(
      pickupLoc.coordinates,
      dropLoc.coordinates
    );

    // Calculate vehicle-specific fare and green carbon metrics
    const { fare, carbonSavedGrams } = calculateVehicleFare(vehicleType, distanceKm, durationMin);

    // Generate 4-digit start OTP / PIN for safety & verification
    const startOtp = Math.floor(1000 + Math.random() * 9000).toString();

    const ride = await dbService.createRide({
      passengerId: req.user.userId,
      driverId: null,
      pickupLoc: {
        type: 'Point',
        coordinates: pickupLoc.coordinates
      },
      pickupAddress,
      dropLoc: {
        type: 'Point',
        coordinates: dropLoc.coordinates
      },
      dropAddress,
      vehicleType,
      startOtp,
      carbonSavedGrams,
      surgeMultiplier: 1.0,
      distanceKm,
      durationMin,
      fare,
      status: 'requested'
    });

    const rideObj = typeof ride.toObject === 'function' ? ride.toObject() : ride;
    const rideResponse = {
      ...rideObj,
      routeGeometry: geometry
    };

    // Find online drivers within 3km of pickup and notify them in real-time
    try {
      const nearbyDrivers = await dbService.findNearbyDrivers(pickupLoc.coordinates, 3);
      if (nearbyDrivers.length > 0) {
        nearbyDrivers.forEach(driver => {
          const driverId = driver.userId._id || driver.userId;
          socketEmitter.notifyDriverOfRideRequest(driverId.toString(), rideResponse);
        });
      } else {
        // Fallback: Notify all active drivers in the driver pool
        socketEmitter.notifyAllDrivers(rideResponse);
      }
    } catch (driverErr) {
      console.error('Error finding and notifying nearby drivers:', driverErr);
    }

    // Attach route geometry to response for map rendering
    res.status(201).json(rideResponse);

  } catch (error) {
    console.error('Create ride error:', error);
    res.status(500).json({ message: 'Server error creating ride request.' });
  }
});

// GET /api/rides/history (Fetch Ride History)
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const rides = await dbService.getRidesByUserId(req.user.userId, req.user.role);
    res.json(rides);
  } catch (error) {
    console.error('Fetch ride history error:', error);
    res.status(500).json({ message: 'Server error fetching ride history.' });
  }
});

// GET /api/rides/all (Fetch all rides - Admin)
router.get('/all', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }

  try {
    const rides = await dbService.getAllRides();
    res.json(rides);
  } catch (error) {
    console.error('Fetch all rides error:', error);
    res.status(500).json({ message: 'Server error fetching all rides.' });
  }
});

// GET /api/rides/:id (Fetch Single Ride Details)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const ride = await dbService.getRideById(req.params.id);
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found.' });
    }
    
    // Recalculate OSRM routing geometry to return to client if requested
    const pickupCoords = ride.pickupLoc.coordinates;
    const dropCoords = ride.dropLoc.coordinates;
    const { geometry } = await getRouteDetails(pickupCoords, dropCoords);

    const rideObj = typeof ride.toObject === 'function' ? ride.toObject() : ride;
    res.json({
      ...rideObj,
      routeGeometry: geometry
    });
  } catch (error) {
    console.error('Fetch ride details error:', error);
    res.status(500).json({ message: 'Server error fetching ride details.' });
  }
});

// POST /api/rides/:id/accept (Driver accepts a ride)
router.post('/:id/accept', authenticateToken, async (req, res) => {
  if (req.user.role !== 'driver') {
    return res.status(403).json({ message: 'Access denied. Only drivers can accept rides.' });
  }

  try {
    // 1. Fetch current ride status to verify it's still "requested"
    const ride = await dbService.getRideById(req.params.id);
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found.' });
    }

    if (ride.status !== 'requested') {
      return res.status(400).json({ message: 'This ride has already been accepted or cancelled.' });
    }

    // 2. Assign driver and transition status to "accepted" (atomic in real Mongoose via findOneAndUpdate)
    const updatedRide = await dbService.updateRide(req.params.id, {
      driverId: req.user.userId,
      status: 'accepted'
    });

    // 3. Mark driver profile online status
    await dbService.updateDriverProfile(req.user.userId, { isOnline: false }); // Busy during ride

    // Emit real-time status update to notify rider
    socketEmitter.emitRideStatusUpdate(updatedRide._id, 'accepted', updatedRide);

    res.json({
      message: 'Ride accepted successfully',
      ride: updatedRide
    });
  } catch (error) {
    console.error('Accept ride error:', error);
    res.status(500).json({ message: 'Server error accepting ride.' });
  }
});

// PATCH /api/rides/:id/status (Update Ride Status: arrived -> started -> completed -> cancelled)
router.patch('/:id/status', authenticateToken, async (req, res) => {
  const { status } = req.body;

  if (!status || !['arrived', 'started', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ message: 'Valid status update is required.' });
  }

  try {
    const ride = await dbService.getRideById(req.params.id);
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found.' });
    }

    // Check authorization: Passenger can cancel, Driver can transition arrived -> started -> completed
    const isDriver = req.user.userId.toString() === (ride.driverId ? ride.driverId._id || ride.driverId : '').toString();
    const isPassenger = req.user.userId.toString() === (ride.passengerId ? ride.passengerId._id || ride.passengerId : '').toString();

    if (!isDriver && !isPassenger) {
      return res.status(403).json({ message: 'Unauthorized to change status of this ride.' });
    }

    if (status === 'cancelled' && ride.status !== 'requested' && ride.status !== 'accepted') {
      return res.status(400).json({ message: 'Cannot cancel ride at this stage.' });
    }

    if (['arrived', 'started', 'completed'].includes(status) && !isDriver) {
      return res.status(403).json({ message: 'Only the assigned driver can update progress.' });
    }

    // Safety OTP verification before starting trip
    if (status === 'started' && ride.startOtp) {
      const providedOtp = (req.body.otp || req.body.startOtp || '').toString().trim();
      if (!providedOtp || providedOtp !== ride.startOtp.toString().trim()) {
        return res.status(400).json({ message: 'Invalid or missing 4-digit Security PIN. Please ask the passenger for their PIN.' });
      }
    }

    const updateFields = { status };
    if (status === 'completed') {
      updateFields.completedAt = new Date();
    }

    const updatedRide = await dbService.updateRide(req.params.id, updateFields);

    // If ride is finished or cancelled, free the driver online status again
    if (status === 'completed' || status === 'cancelled') {
      if (ride.driverId) {
        const driverId = ride.driverId._id || ride.driverId;
        await dbService.updateDriverProfile(driverId, { isOnline: true });
      }
    }

    // Emit live status update to notify all participants
    socketEmitter.emitRideStatusUpdate(updatedRide._id, status, updatedRide);

    res.json({
      message: `Ride status updated to ${status}`,
      ride: updatedRide
    });
  } catch (error) {
    console.error('Update ride status error:', error);
    res.status(500).json({ message: 'Server error updating ride status.' });
  }
});

// POST /api/rides/:id/rating (Submit rating after completion)
router.post('/:id/rating', authenticateToken, async (req, res) => {
  const { rating, review } = req.body;

  if (rating === undefined || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
  }

  try {
    const ride = await dbService.getRideById(req.params.id);
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found.' });
    }

    if (ride.status !== 'completed' && ride.status !== 'paid') {
      return res.status(400).json({ message: 'Can only rate completed rides.' });
    }

    const isDriver = req.user.role === 'driver';
    const isPassenger = req.user.role === 'passenger';

    let updatedRide;

    if (isPassenger) {
      // Passenger rates Driver
      updatedRide = await dbService.updateRide(req.params.id, {
        driverRating: rating,
        driverReview: review || ''
      });

      // Recalculate average driver rating
      if (ride.driverId) {
        const driverId = ride.driverId._id || ride.driverId;
        const profile = await dbService.getDriverProfileByUserId(driverId);
        if (profile) {
          const currentCount = profile.ratingCount || 0;
          const currentAvg = profile.rating || 5.0;
          const newAvg = +((currentAvg * currentCount + rating) / (currentCount + 1)).toFixed(1);
          await dbService.updateDriverProfile(driverId, {
            rating: newAvg,
            ratingCount: currentCount + 1
          });
        }
      }
    } else if (isDriver) {
      // Driver rates Passenger
      updatedRide = await dbService.updateRide(req.params.id, {
        passengerRating: rating,
        passengerReview: review || ''
      });
    } else {
      return res.status(400).json({ message: 'Invalid role for rating.' });
    }

    res.json({
      message: 'Rating submitted successfully',
      ride: updatedRide
    });
  } catch (error) {
    console.error('Submit rating error:', error);
    res.status(500).json({ message: 'Server error submitting rating.' });
  }
});

// GEOLOCATION PROXY (Photon + Nominatim with location bias and distance filtering)
router.get('/geocode/search', async (req, res) => {
  const { q, lat, lon } = req.query;
  if (!q) {
    return res.status(400).json({ message: 'Query query string (q) is required.' });
  }

  const userLat = lat ? parseFloat(lat) : null;
  const userLon = lon ? parseFloat(lon) : null;
  const hasUserCoords = userLat !== null && userLon !== null && !isNaN(userLat) && !isNaN(userLon);

  // 1. Try Photon first (high availability, OSM-based global search with proximity biasing)
  try {
    const biasParam = hasUserCoords ? `&lat=${userLat}&lon=${userLon}` : '';
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}${biasParam}&limit=12`;
    const pResponse = await fetch(photonUrl, {
      headers: { 'User-Agent': 'Tripzy-RideSharing/1.0' }
    });
    if (pResponse.ok) {
      const pData = await pResponse.json();
      if (Array.isArray(pData.features) && pData.features.length > 0) {
        let results = pData.features.map((f, idx) => {
          const fLat = f.geometry.coordinates[1];
          const fLon = f.geometry.coordinates[0];
          const dist = hasUserCoords ? +(calculateDistanceKm([userLon, userLat], [fLon, fLat])).toFixed(1) : null;
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

        // Filter and prioritize locations within metropolitan/city radius (< 75 km)
        if (hasUserCoords) {
          const localResults = results.filter(r => r.dist !== null && r.dist <= 75);
          if (localResults.length > 0) {
            localResults.sort((a, b) => a.dist - b.dist);
            return res.json(localResults.slice(0, 6));
          }
          results.sort((a, b) => (a.dist ?? 99999) - (b.dist ?? 99999));
        }

        return res.json(results.slice(0, 6));
      }
    }
  } catch (photonErr) {
    console.warn('⚠️ Photon search warning:', photonErr.message);
  }

  // 2. Try Nominatim with bounding viewbox if coordinates provided
  try {
    let nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=in&limit=8&email=tripzyapp@gmail.com`;
    if (hasUserCoords) {
      const delta = 0.65; // ~70 km radius
      const viewbox = `${userLon - delta},${userLat + delta},${userLon + delta},${userLat - delta}`;
      nomUrl += `&viewbox=${viewbox}`;
    }

    const response = await fetch(nomUrl, {
      headers: { 'User-Agent': 'TripzyApp/1.0 (https://tripzy-6xho.vercel.app; support@tripzy.com)' }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        let results = data.map(item => {
          const iLat = parseFloat(item.lat);
          const iLon = parseFloat(item.lon);
          const dist = hasUserCoords ? +(calculateDistanceKm([userLon, userLat], [iLon, iLat])).toFixed(1) : null;
          return {
            place_id: item.place_id,
            display_name: item.display_name,
            lat: String(item.lat),
            lon: String(item.lon),
            dist
          };
        });

        if (hasUserCoords) {
          const localResults = results.filter(r => r.dist !== null && r.dist <= 75);
          if (localResults.length > 0) {
            localResults.sort((a, b) => a.dist - b.dist);
            return res.json(localResults.slice(0, 6));
          }
          results.sort((a, b) => (a.dist ?? 99999) - (b.dist ?? 99999));
        }

        return res.json(results.slice(0, 6));
      }
    }
  } catch (error) {
    console.warn('⚠️ Nominatim search failed:', error.message);
  }

  // 3. Known hub fallback (real landmark locations across India, never labeled simulated)
  const query = q.toLowerCase();
  const mockLocations = [
    { name: 'Connaught Place, New Delhi', lat: 28.6304, lon: 77.2177 },
    { name: 'Gateway of India, Mumbai', lat: 18.9220, lon: 72.8347 },
    { name: 'Howrah Bridge, Kolkata', lat: 22.5851, lon: 88.3468 },
    { name: 'MG Road, Bangalore', lat: 12.9756, lon: 77.6068 },
    { name: 'Marina Beach, Chennai', lat: 13.0475, lon: 80.2824 },
    { name: 'Indiranagar, Bangalore', lat: 12.9719, lon: 77.6412 },
    { name: 'Koramangala, Bangalore', lat: 12.9352, lon: 77.6245 },
    { name: 'Whitefield, Bangalore', lat: 12.9698, lon: 77.7500 },
    { name: 'Aerocity, New Delhi', lat: 28.5476, lon: 77.1215 },
    { name: 'Barasat Junction, Kolkata', lat: 22.7214, lon: 88.4812 }
  ];

  const matched = mockLocations.filter(loc => loc.name.toLowerCase().includes(query));
  let formattedResponse = matched.map((loc, idx) => {
    const dist = hasUserCoords ? +(calculateDistanceKm([userLon, userLat], [loc.lon, loc.lat])).toFixed(1) : null;
    return {
      place_id: 1000 + idx,
      display_name: loc.name,
      lat: String(loc.lat),
      lon: String(loc.lon),
      dist
    };
  });

  if (hasUserCoords) {
    formattedResponse.sort((a, b) => (a.dist ?? 99999) - (b.dist ?? 99999));
  }

  return res.json(formattedResponse.slice(0, 6));
});

// GEOLOCATION REVERSE PROXY (Nominatim + BigDataCloud)
router.get('/geocode/reverse', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ message: 'Latitude (lat) and longitude (lon) are required.' });
  }

  // 1. Try Nominatim with contact email
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&email=tripzyapp@gmail.com`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'TripzyApp/1.0 (https://tripzy-6xho.vercel.app; support@tripzy.com)' }
    });
    if (response.ok) {
      const data = await response.json();
      if (data && data.display_name) {
        return res.json(data);
      }
    }
  } catch (error) {
    console.warn('⚠️ Nominatim reverse failed:', error.message);
  }

  // 2. Try BigDataCloud reverse geocode client API (no auth required, global locality lookup)
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const bdcRes = await fetch(bdcUrl);
    if (bdcRes.ok) {
      const bdcData = await bdcRes.json();
      const parts = [
        bdcData.locality,
        bdcData.city,
        bdcData.principalSubdivision,
        bdcData.countryName
      ].filter(Boolean);
      if (parts.length > 0) {
        return res.json({ display_name: parts.join(', ') });
      }
    }
  } catch (bdcErr) {
    console.warn('⚠️ BigDataCloud reverse warning:', bdcErr.message);
  }

  // 3. Graceful fallback
  res.json({
    display_name: `Location (${parseFloat(lat).toFixed(4)}, ${parseFloat(lon).toFixed(4)})`
  });
});

// -------------------------------------------------------------
// BILATERAL FORWARD CONTRACT: BACKHAUL RETURN TRIP SHIELD ROUTES
// -------------------------------------------------------------

// POST /api/rides/return-lock/commit (Driver registers backhaul availability)
router.post('/return-lock/commit', authenticateToken, async (req, res) => {
  if (req.user.role !== 'driver') {
    return res.status(403).json({ message: 'Only driver partners can register backhaul return commitments.' });
  }

  const { sourceZone, headingZone, availableTime, approxFairFare, notes, isActive = true } = req.body;

  try {
    const updatedProfile = await dbService.updateDriverProfile(req.user.userId, {
      backhaulCommitment: {
        isActive,
        sourceZone: sourceZone || 'Airport / Event Suburb',
        headingZone: headingZone || 'City Center Corridor',
        availableTime: availableTime || 'Tonight ~11:00 PM',
        approxFairFare: Number(approxFairFare) || 250,
        notes: notes || 'Zero surge guaranteed backhaul ride'
      }
    });

    res.json({
      message: 'Backhaul return commitment registered successfully!',
      commitment: updatedProfile.backhaulCommitment
    });
  } catch (error) {
    console.error('Backhaul commit error:', error);
    res.status(500).json({ message: 'Failed to register backhaul commitment.' });
  }
});

// POST /api/rides/return-lock/check (Rider queries if a driver pre-committed for their return corridor - Public)
router.post('/return-lock/check', async (req, res) => {
  const { returnPickupAddress, returnDropAddress } = req.body;

  try {
    // Find driver profiles where backhaul is active and source zone matches destination
    const committedDrivers = await dbService.findCommittedBackhaulDrivers({
      sourceZone: returnPickupAddress,
      headingZone: returnDropAddress
    });

    if (!committedDrivers || committedDrivers.length === 0) {
      return res.json({
        matched: false,
        message: 'No driver has pre-registered for this return corridor yet. Regular spot booking will be available.'
      });
    }

    // Pick top matched driver (or highest rating)
    const matched = committedDrivers[0];
    const commitment = matched.backhaulCommitment;
    const driverUser = matched.userId || {};

    res.json({
      matched: true,
      message: 'Driver found with pre-committed return availability!',
      driver: {
        driverId: driverUser._id || matched.userId,
        name: driverUser.name || 'Verified Driver Partner',
        vehicleName: matched.vehicleName,
        vehicleNumber: matched.vehicleNumber,
        rating: matched.rating || 5.0,
        availableTime: commitment.availableTime,
        lockedFare: commitment.approxFairFare,
        headingZone: commitment.headingZone,
        sourceZone: commitment.sourceZone
      }
    });
  } catch (error) {
    console.error('Check return lock error:', error);
    res.status(500).json({ message: 'Error checking for backhaul drivers.' });
  }
});

// POST /api/rides/return-lock/book (Lock the forward contract return ride)
router.post('/return-lock/book', authenticateToken, async (req, res) => {
  const {
    outboundRideId,
    returnPickupLoc,
    returnPickupAddress,
    returnDropLoc,
    returnDropAddress,
    driverId,
    returnScheduledTime,
    lockedFare
  } = req.body;

  if (!returnPickupLoc || !returnDropLoc || !driverId) {
    return res.status(400).json({ message: 'Return pickup, drop location and committed driver are required.' });
  }

  try {
    const returnRide = await dbService.createRide({
      passengerId: req.user.userId,
      driverId: driverId,
      pickupLoc: returnPickupLoc,
      pickupAddress: returnPickupAddress,
      dropLoc: returnDropLoc,
      dropAddress: returnDropAddress,
      distanceKm: 12.0,
      durationMin: 25,
      fare: lockedFare,
      vehicleType: 'sedan',
      status: 'accepted', // Pre-accepted by bilateral contract
      isReturnLocked: true,
      returnScheduledTime: returnScheduledTime || 'Tonight ~11:00 PM',
      returnDriverId: driverId,
      returnLockFare: lockedFare,
      startOtp: Math.floor(1000 + Math.random() * 9000).toString(),
      carbonSavedGrams: 350
    });

    // Notify driver of locked forward booking via socket
    try {
      socketEmitter.notifyDriverOfRideRequest(driverId.toString(), returnRide);
    } catch (e) {
      // socket non-blocking
    }

    res.status(201).json({
      message: 'Return trip successfully locked at guaranteed non-surge fare!',
      returnRide
    });
  } catch (error) {
    console.error('Book return lock error:', error);
    res.status(500).json({ message: 'Failed to book return lock.' });
  }
});

export default router;
