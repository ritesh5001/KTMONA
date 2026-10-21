
import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);

// Razorpay: open Checkout for an order, and confirm the payment on return.
router.post('/initiate', paymentController.initiatePayment);
router.post('/razorpay/verify', paymentController.verifyRazorpayPayment);
router.post('/retry/:orderId', paymentController.retryPayment);
router.get('/:orderId', paymentController.getPaymentDetails);

export const paymentRoutes = router;
