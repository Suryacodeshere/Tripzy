import express from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { dbService } from '../dbService.js';
import { authenticateToken } from './auth.js';
import { socketEmitter } from '../socket.js';


const router = express.Router();

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'tripzy_webhook_secret_123';

let razorpayInstance = null;

if (KEY_ID && KEY_SECRET) {
  try {
    razorpayInstance = new Razorpay({
      key_id: KEY_ID,
      key_secret: KEY_SECRET
    });
    console.log('💳 Razorpay initialized in live/test mode with provided keys.');
  } catch (error) {
    console.error('Failed to initialize Razorpay:', error.message);
  }
} else {
  console.warn('⚠️ Razorpay credentials not provided. Payment will operate in SIMULATED DEMO mode.');
}

// POST /api/rides/:id/create-order (Create Razorpay Order)
router.post('/:id/create-order', authenticateToken, async (req, res) => {
  try {
    const ride = await dbService.getRideById(req.params.id);
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found.' });
    }

    const amountInPaise = Math.round(ride.fare * 100);

    if (razorpayInstance) {
      // Real Razorpay Order Creation
      const options = {
        amount: amountInPaise,
        currency: 'INR',
        receipt: `ride_${ride._id}`,
        notes: {
          passengerId: ride.passengerId._id ? ride.passengerId._id.toString() : ride.passengerId.toString(),
          rideId: ride._id.toString()
        }
      };

      const order = await razorpayInstance.orders.create(options);
      
      // Save Razorpay Order ID on Ride
      await dbService.updateRide(ride._id, { razorpayOrderId: order.id });
      
      return res.json({
        isMock: false,
        keyId: KEY_ID,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency
      });
    } else {
      // Simulated Razorpay Order Creation
      const mockOrderId = `order_mock_${Math.random().toString(36).substring(2, 11)}`;
      
      await dbService.updateRide(ride._id, { razorpayOrderId: mockOrderId });

      return res.json({
        isMock: true,
        keyId: 'rzp_test_mock_keys',
        orderId: mockOrderId,
        amount: amountInPaise,
        currency: 'INR'
      });
    }
  } catch (error) {
    console.error('Create Razorpay order error:', error);
    res.status(500).json({ message: 'Server error creating payment order.', error: error.message });
  }
});

// POST /api/rides/:id/verify-payment (Verify Signature & Complete Payment)
router.post('/:id/verify-payment', authenticateToken, async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, isMockPayment } = req.body;

  try {
    const ride = await dbService.getRideById(req.params.id);
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found.' });
    }

    if (isMockPayment || !razorpayInstance) {
      // Complete mock payment directly
      const updatedRide = await dbService.updateRide(ride._id, {
        status: 'paid',
        razorpayPaymentId: razorpay_payment_id || `pay_mock_${Math.random().toString(36).substring(2, 11)}`,
        razorpayOrderId: razorpay_order_id || ride.razorpayOrderId
      });

      // Emit live status update to notify all participants
      socketEmitter.emitRideStatusUpdate(updatedRide._id, 'paid', updatedRide);

      return res.json({
        message: 'Mock payment verified successfully.',
        ride: updatedRide
      });
    }

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Payment verification parameters are missing.' });
    }

    // Verify signature
    const text = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', KEY_SECRET)
      .update(text)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid payment signature. Verification failed.' });
    }

    // Update ride to paid
    const updatedRide = await dbService.updateRide(ride._id, {
      status: 'paid',
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id
    });

    // Emit live status update to notify all participants
    socketEmitter.emitRideStatusUpdate(updatedRide._id, 'paid', updatedRide);

    res.json({
      message: 'Payment verified successfully.',
      ride: updatedRide
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ message: 'Server error verifying payment.' });
  }
});

// POST /api/webhooks/razorpay (Razorpay Webhook verification)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  if (!signature || !KEY_SECRET) {
    return res.status(400).send('Webhook verification ignored (keys missing or signature absent).');
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(req.body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).send('Invalid signature');
    }

    const payload = JSON.parse(req.body.toString());
    
    // Check event
    if (payload.event === 'payment.captured') {
      const payment = payload.payload.payment.entity;
      const orderId = payment.order_id;
      const paymentId = payment.id;

      // Find ride by razorpayOrderId
      const rides = await dbService.getAllRides();
      const ride = rides.find(r => r.razorpayOrderId === orderId);

      if (ride && ride.status !== 'paid') {
        const updatedRide = await dbService.updateRide(ride._id, {
          status: 'paid',
          razorpayPaymentId: paymentId
        });
        console.log(`💳 Webhook: Marked ride ${ride._id} as paid.`);
        // Emit live status update to notify all participants
        socketEmitter.emitRideStatusUpdate(ride._id, 'paid', updatedRide);
      }
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Webhook server error');
  }
});

export default router;
