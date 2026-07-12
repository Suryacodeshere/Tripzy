import express from 'express';
import { dbService, calculateDistanceKm } from '../dbService.js';
import { authenticateToken } from './auth.js';
import { socketEmitter } from '../socket.js';

const router = express.Router();

// Fare configurations
const FARE_BASE = 50.00; // Base fare in INR
const FARE_PER_KM = 12.00; // Fare per km in INR
const FARE_PER_MIN = 2.00; // Fare per minute in INR

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

// POST /api/rides (Request a Ride)
router.post('/', authenticateToken, async (req, res) => {
  const { pickupLoc, pickupAddress, dropLoc, dropAddress } = req.body;

  if (!pickupLoc || !pickupLoc.coordinates || !dropLoc || !dropLoc.coordinates || !pickupAddress || !dropAddress) {
    return res.status(400).json({ message: 'Pickup and drop-off coordinates and addresses are required.' });
  }

  try {
    const { distanceKm, durationMin, geometry } = await getRouteDetails(
      pickupLoc.coordinates,
      dropLoc.coordinates
    );

    // Calculate Fare
    const fare = +(FARE_BASE + (distanceKm * FARE_PER_KM) + (durationMin * FARE_PER_MIN)).toFixed(2);

    const ride = await dbService.createRide({
      passengerId: req.user.userId,
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
      distanceKm,
      durationMin,
      fare,
      status: 'requested'
    });

    const rideResponse = {
      ...ride,
      routeGeometry: geometry
    };

    // Find online drivers within 3km of pickup and notify them in real-time
    try {
      const nearbyDrivers = await dbService.findNearbyDrivers(pickupLoc.coordinates, 3);
      nearbyDrivers.forEach(driver => {
        const driverId = driver.userId._id || driver.userId;
        socketEmitter.notifyDriverOfRideRequest(driverId.toString(), rideResponse);
      });
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

    res.json({
      ...ride,
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

// GEOLOCATION PROXY (Nominatim)
router.get('/geocode/search', async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ message: 'Query query string (q) is required.' });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=5`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Tripzy-RideSharing-App/1.0' }
    });
    
    if (!response.ok) {
      throw new Error(`Nominatim geocoding error: ${response.statusText}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.warn('⚠️ Nominatim search failed, returning simulated address search fallback:', error.message);
    
    // Simulate some simple locations for fallback
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
      { name: 'Aerocity, New Delhi', lat: 28.5476, lon: 77.1215 }
    ];

    const matched = mockLocations.filter(loc => loc.name.toLowerCase().includes(query));
    
    // If no exact match, mock one search result with the query name centered at MG Road
    if (matched.length === 0) {
      matched.push({
        name: `${q} (Simulated Location)`,
        lat: 12.9716 + (Math.random() - 0.5) * 0.05,
        lon: 77.5946 + (Math.random() - 0.5) * 0.05
      });
    }

    const formattedResponse = matched.map((loc, idx) => ({
      place_id: 1000 + idx,
      display_name: loc.name,
      lat: String(loc.lat),
      lon: String(loc.lon)
    }));

    res.json(formattedResponse);
  }
});

// GEOLOCATION REVERSE PROXY (Nominatim)
router.get('/geocode/reverse', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ message: 'Latitude (lat) and longitude (lon) are required.' });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Tripzy-RideSharing-App/1.0' }
    });
    if (!response.ok) {
      throw new Error(`Nominatim reverse geocoding error: ${response.statusText}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.warn('⚠️ Nominatim reverse failed, returning mock reverse fallback:', error.message);
    res.json({
      display_name: `Location near (${parseFloat(lat).toFixed(4)}, ${parseFloat(lon).toFixed(4)})`
    });
  }
});

export default router;
