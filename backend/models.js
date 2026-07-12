import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// User Schema
const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['rider', 'driver', 'admin'], required: true },
  createdAt: { type: Date, default: Date.now }
});

// Driver Profile Schema (1:1 mapping with User of role 'driver')
const driverProfileSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  vehicleName: { type: String, required: true },
  vehicleNumber: { type: String, required: true },
  vehicleType: { type: String, enum: ['auto', 'bike', 'sedan', 'suv'], default: 'sedan' },
  isOnline: { type: Boolean, default: false },
  // currentLoc: GeoJSON Point: { type: "Point", coordinates: [longitude, latitude] }
  currentLoc: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
  rating: { type: Number, default: 5.0 },
  ratingCount: { type: Number, default: 0 }
});

// Create 2dsphere index on currentLoc for geospatial queries ($near, $geoWithin)
driverProfileSchema.index({ currentLoc: '2dsphere' });

// Ride Schema
const rideSchema = new Schema({
  riderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  pickupLoc: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  pickupAddress: { type: String, required: true },
  dropLoc: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  dropAddress: { type: String, required: true },
  status: {
    type: String,
    enum: ['requested', 'accepted', 'arrived', 'started', 'completed', 'paid', 'cancelled'],
    default: 'requested'
  },
  distanceKm: { type: Number, required: true },
  durationMin: { type: Number, required: true },
  fare: { type: Number, required: true },
  razorpayOrderId: { type: String, default: null },
  razorpayPaymentId: { type: String, default: null },
  riderRating: { type: Number, default: null },
  driverRating: { type: Number, default: null },
  riderReview: { type: String, default: '' },
  driverReview: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null }
});

rideSchema.index({ pickupLoc: '2dsphere' });
rideSchema.index({ dropLoc: '2dsphere' });

// Location Log Schema (append-only location streams)
const locationLogSchema = new Schema({
  rideId: { type: Schema.Types.ObjectId, ref: 'Ride', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  loc: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  timestamp: { type: Date, default: Date.now }
});

locationLogSchema.index({ loc: '2dsphere' });

export const User = model('User', userSchema);
export const DriverProfile = model('DriverProfile', driverProfileSchema);
export const Ride = model('Ride', rideSchema);
export const LocationLog = model('LocationLog', locationLogSchema);
