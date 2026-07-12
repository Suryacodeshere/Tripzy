import { dbService } from './dbService.js';

let ioInstance = null;

// Track active socket connections: userId -> socketId
const activeConnections = new Map();

export function initSocket(io) {
  ioInstance = io;

  io.on('connection', (socket) => {
    // 1. Join user-specific room upon authentication
    socket.on('auth:join', (data) => {
      if (data && data.userId) {
        socket.userId = data.userId;
        socket.role = data.role;
        activeConnections.set(data.userId, socket.id);
        socket.join(`user_${data.userId}`);
        
        console.log(`🔌 User connected: ${data.name} (${data.role}) - Socket: ${socket.id}`);
        
        // If driver, join the active drivers pool room
        if (data.role === 'driver') {
          socket.join('drivers_pool');
        }
      }
    });

    // 2. Join a specific ride room to share tracking updates
    socket.on('ride:join', (data) => {
      if (data && data.rideId) {
        socket.join(`ride_${data.rideId}`);
        console.log(`🚗 Socket ${socket.id} joined ride room: ride_${data.rideId}`);
      }
    });

    // 3. Driver transmits GPS position updates
    socket.on('location:update', async (data) => {
      const { lat, lng, rideId, userId } = data;
      const driverUserId = userId || socket.userId;

      if (!driverUserId || lat === undefined || lng === undefined) return;

      const coordinates = [lng, lat]; // GeoJSON format: [longitude, latitude]

      try {
        if (rideId) {
          // Driver is on active trip: relay location in real-time to passenger
          io.to(`ride_${rideId}`).emit('location:update', {
            lat,
            lng,
            timestamp: new Date()
          });

          // Log location to database for history trace
          await dbService.logLocation({
            rideId,
            driverId: driverUserId,
            loc: {
              type: 'Point',
              coordinates
            }
          });
        } else {
          // Driver is online but idle: update their live profile position
          const updatedProfile = await dbService.updateDriverProfile(driverUserId, {
            currentLoc: {
              type: 'Point',
              coordinates
            },
            isOnline: true
          });

          // Broadcast to all clients (passengers) that a driver location updated
          if (updatedProfile) {
            io.emit('driver:location_changed', {
              driverId: driverUserId,
              coordinates,
              vehicleType: updatedProfile.vehicleType,
              rating: updatedProfile.rating
            });
          }
        }
      } catch (error) {
        console.error('Socket location update error:', error.message);
      }
    });

    // 4. Handle disconnection
    socket.on('disconnect', () => {
      if (socket.userId) {
        activeConnections.delete(socket.userId);
        console.log(`🔌 User disconnected: ${socket.userId} - Socket: ${socket.id}`);
      }
    });
  });
}

// Utility functions to emit messages from HTTP controllers
export const socketEmitter = {
  // Notify specific driver of a new ride request
  notifyDriverOfRideRequest(driverUserId, rideData) {
    if (ioInstance) {
      console.log(`📡 Sending ride request to driver user_${driverUserId}`);
      ioInstance.to(`user_${driverUserId}`).emit('ride:request', rideData);
    }
  },

  // Notify all participants in a ride room of a status change (accepted, arrived, started, completed)
  emitRideStatusUpdate(rideId, status, rideData) {
    if (ioInstance) {
      console.log(`🚗 Broadcasting ride:${status} for ride_${rideId}`);
      ioInstance.to(`ride_${rideId}`).emit('ride:status_changed', { status, ride: rideData });
      
      // Also broadcast generally to Passenger / Driver individual rooms as a fallback
      if (rideData.passengerId) {
        const passengerId = rideData.passengerId._id || rideData.passengerId;
        ioInstance.to(`user_${passengerId}`).emit('ride:status_changed', { status, ride: rideData });
      }
      if (rideData.driverId) {
        const driverId = rideData.driverId._id || rideData.driverId;
        ioInstance.to(`user_${driverId}`).emit('ride:status_changed', { status, ride: rideData });
      }
    }
  }
};
