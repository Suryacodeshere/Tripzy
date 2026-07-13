import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { connectDb } from './dbService.js';
import { initSocket } from './socket.js';
import authRoutes from './routes/auth.js';
import rideRoutes from './routes/rides.js';
import paymentRoutes from './routes/payments.js';

const app = express();
const server = http.createServer(app);

// Configure Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for development/testing
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    credentials: true
  }
});

// Save socket server instance to Express context so routes can access it if needed
app.set('io', io);

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/payments', paymentRoutes);

// Health Check / Welcome Endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the Tripzy Ride-Sharing API',
    status: 'online',
    time: new Date()
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error occurred.', error: err.message });
});

// Initialize real-time WebSocket socket manager
initSocket(io);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  console.log(`🚀 Tripzy Backend server running on port ${PORT}`);
  // Connect to Database
  await connectDb();
});
