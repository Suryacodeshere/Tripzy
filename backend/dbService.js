import mongoose from 'mongoose';
import { User, DriverProfile, Ride, LocationLog } from './models.js';

// Haversine formula to calculate distance in km between two [lng, lat] coordinates
export function calculateDistanceKm(coords1, coords2) {
  const [lng1, lat1] = coords1;
  const [lng2, lat2] = coords2;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// In-Memory Database for Demo Mode
const memoryDb = {
  users: [],
  driverProfiles: [],
  rides: [],
  locationLogs: []
};

// Flags
export let isDemoMode = true;

export async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('\n⚠️  WARNING: MONGODB_URI is not set. Running in Demo Mode (In-Memory DB). Data will not persist.\n');
    isDemoMode = true;
    return;
  }

  try {
    await mongoose.connect(uri);
    console.log('\n🟢 Connected to MongoDB successfully.\n');
    isDemoMode = false;
  } catch (error) {
    console.error(`\n🔴 Failed to connect to MongoDB: ${error.message}`);
    console.warn('⚠️  Falling back to Demo Mode (In-Memory DB).\n');
    isDemoMode = true;
  }
}

// Database Service Interface
export const dbService = {
  // USER OPERATIONS
  async createUser(userData) {
    if (isDemoMode) {
      const newUser = {
        _id: new mongoose.Types.ObjectId().toString(),
        createdAt: new Date(),
        ...userData
      };
      memoryDb.users.push(newUser);
      return newUser;
    }
    return await User.create(userData);
  },

  async findUserByEmail(email) {
    if (isDemoMode) {
      return memoryDb.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
    }
    return await User.findOne({ email });
  },

  async findUserById(id) {
    if (isDemoMode) {
      return memoryDb.users.find(u => u._id.toString() === id.toString()) || null;
    }
    return await User.findById(id);
  },

  async getAllUsers() {
    if (isDemoMode) {
      return memoryDb.users;
    }
    return await User.find({});
  },

  // DRIVER PROFILE OPERATIONS
  async createDriverProfile(profileData) {
    if (isDemoMode) {
      const newProfile = {
        _id: new mongoose.Types.ObjectId().toString(),
        isOnline: false,
        currentLoc: { type: 'Point', coordinates: [0, 0] },
        rating: 5.0,
        ratingCount: 0,
        ...profileData
      };
      memoryDb.driverProfiles.push(newProfile);
      return newProfile;
    }
    return await DriverProfile.create(profileData);
  },

  async getDriverProfileByUserId(userId) {
    if (isDemoMode) {
      const profile = memoryDb.driverProfiles.find(p => p.userId.toString() === userId.toString());
      if (profile) {
        // Hydrate user info
        const user = memoryDb.users.find(u => u._id.toString() === userId.toString());
        return { ...profile, userId: user };
      }
      return null;
    }
    return await DriverProfile.findOne({ userId }).populate('userId');
  },

  async updateDriverProfile(userId, updateData) {
    if (isDemoMode) {
      const profileIndex = memoryDb.driverProfiles.findIndex(p => p.userId.toString() === userId.toString());
      if (profileIndex === -1) return null;
      
      const current = memoryDb.driverProfiles[profileIndex];
      const updated = { ...current, ...updateData };
      
      // Special handle currentLoc coordinates nesting
      if (updateData.currentLoc && updateData.currentLoc.coordinates) {
        updated.currentLoc = {
          type: 'Point',
          coordinates: updateData.currentLoc.coordinates
        };
      }
      
      memoryDb.driverProfiles[profileIndex] = updated;
      
      // Hydrate user
      const user = memoryDb.users.find(u => u._id.toString() === userId.toString());
      return { ...updated, userId: user };
    }
    return await DriverProfile.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true }
    ).populate('userId');
  },

  async findNearbyDrivers(coordinates, maxDistanceKm = 3) {
    if (isDemoMode) {
      const activeDrivers = memoryDb.driverProfiles.filter(p => p.isOnline === true);
      const nearby = [];
      for (const d of activeDrivers) {
        const distance = calculateDistanceKm(coordinates, d.currentLoc.coordinates);
        if (distance <= maxDistanceKm) {
          const user = memoryDb.users.find(u => u._id.toString() === d.userId.toString());
          nearby.push({
            ...d,
            userId: user,
            distance: distance
          });
        }
      }
      // Sort by distance ascending
      return nearby.sort((a, b) => a.distance - b.distance);
    }

    // MongoDB Geospatial Query
    return await DriverProfile.find({
      isOnline: true,
      currentLoc: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: coordinates // [longitude, latitude]
          },
          $maxDistance: maxDistanceKm * 1000 // Convert km to meters
        }
      }
    }).populate('userId');
  },

  // RIDE OPERATIONS
  async createRide(rideData) {
    if (isDemoMode) {
      const newRide = {
        _id: new mongoose.Types.ObjectId().toString(),
        status: 'requested',
        razorpayOrderId: null,
        razorpayPaymentId: null,
        passengerRating: null,
        driverRating: null,
        passengerReview: '',
        driverReview: '',
        createdAt: new Date(),
        completedAt: null,
        ...rideData
      };
      memoryDb.rides.push(newRide);
      return newRide;
    }
    return await Ride.create(rideData);
  },

  async getRideById(id) {
    if (isDemoMode) {
      const ride = memoryDb.rides.find(r => r._id.toString() === id.toString());
      if (ride) {
        const passenger = memoryDb.users.find(u => u._id.toString() === ride.passengerId.toString());
        const driver = ride.driverId ? memoryDb.users.find(u => u._id.toString() === ride.driverId.toString()) : null;
        let driverProfile = null;
        if (ride.driverId) {
          driverProfile = memoryDb.driverProfiles.find(p => p.userId.toString() === ride.driverId.toString());
        }
        return { ...ride, passengerId: passenger, driverId: driver, driverProfile };
      }
      return null;
    }
    
    const ride = await Ride.findById(id).populate('passengerId').populate('driverId');
    if (ride && ride.driverId) {
      const driverProfile = await DriverProfile.findOne({ userId: ride.driverId._id });
      return { ...ride.toObject(), driverProfile };
    }
    return ride;
  },

  async updateRide(id, updateData) {
    if (isDemoMode) {
      const rideIndex = memoryDb.rides.findIndex(r => r._id.toString() === id.toString());
      if (rideIndex === -1) return null;
      const current = memoryDb.rides[rideIndex];
      const updated = { ...current, ...updateData };
      if (updateData.status === 'completed') {
        updated.completedAt = new Date();
      }
      memoryDb.rides[rideIndex] = updated;
      
      const passenger = memoryDb.users.find(u => u._id.toString() === updated.passengerId.toString());
      const driver = updated.driverId ? memoryDb.users.find(u => u._id.toString() === updated.driverId.toString()) : null;
      return { ...updated, passengerId: passenger, driverId: driver };
    }
    return await Ride.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    ).populate('passengerId').populate('driverId');
  },

  async getRidesByUserId(userId, role) {
    if (isDemoMode) {
      const key = role === 'driver' ? 'driverId' : 'passengerId';
      const filtered = memoryDb.rides.filter(r => r[key] && r[key].toString() === userId.toString());
      return filtered.map(ride => {
        const passenger = memoryDb.users.find(u => u._id.toString() === ride.passengerId.toString());
        const driver = ride.driverId ? memoryDb.users.find(u => u._id.toString() === ride.driverId.toString()) : null;
        return { ...ride, passengerId: passenger, driverId: driver };
      });
    }
    const query = role === 'driver' ? { driverId: userId } : { passengerId: userId };
    return await Ride.find(query).populate('passengerId').populate('driverId').sort({ createdAt: -1 });
  },

  async getAllRides() {
    if (isDemoMode) {
      return memoryDb.rides.map(ride => {
        const passenger = memoryDb.users.find(u => u._id.toString() === ride.passengerId.toString());
        const driver = ride.driverId ? memoryDb.users.find(u => u._id.toString() === ride.driverId.toString()) : null;
        return { ...ride, passengerId: passenger, driverId: driver };
      });
    }
    return await Ride.find({}).populate('passengerId').populate('driverId').sort({ createdAt: -1 });
  },

  // LOCATION LOG OPERATIONS
  async logLocation(logData) {
    if (isDemoMode) {
      const newLog = {
        _id: new mongoose.Types.ObjectId().toString(),
        timestamp: new Date(),
        ...logData
      };
      memoryDb.locationLogs.push(newLog);
      return newLog;
    }
    return await LocationLog.create(logData);
  },

  async getLocationLogs(rideId) {
    if (isDemoMode) {
      return memoryDb.locationLogs.filter(l => l.rideId.toString() === rideId.toString());
    }
    return await LocationLog.find({ rideId }).sort({ timestamp: 1 });
  }
};
