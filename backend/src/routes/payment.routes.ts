
import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);

// PhonePe: create a payment link/order for checkout, and confirm it on return.
router.post('/initiate', paymentController.initiatePayment);
router.post('/phonepe/verify', paymentController.verifyPhonePePayment);
router.post('/retry/:orderId', paymentController.retryPayment);
router.get('/:orderId', paymentController.getPaymentDetails);

export const paymentRoutes = router;
