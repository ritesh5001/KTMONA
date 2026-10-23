import { Router } from 'express';
import { reviewController } from '../controllers/review.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const reviewRouter = Router();

// POST /v1/reviews/:id/helpful - Mark as helpful (Authenticated)
reviewRouter.post('/:id/helpful', authenticate, reviewController.markHelpful);

// GET /v1/reviews/my-votes?ids= - Reviews I marked helpful
reviewRouter.get('/my-votes', authenticate, reviewController.myVotes);

// POST /v1/reviews/:id/report - Report a review (spam, fake, offensive…)
reviewRouter.post('/:id/report', authenticate, reviewController.report);

// GET /v1/reviews/product/:productId/eligibility - Can the signed-in buyer review it?
reviewRouter.get('/product/:productId/eligibility', authenticate, reviewController.eligibility);

// GET /v1/reviews/product/:productId - Get reviews (Public) — legacy route
reviewRouter.get('/product/:productId', reviewController.getProductReviews);

// POST /v1/reviews/product/:productId - Create a review (Authenticated) — legacy
// route. Shipped mobile builds post here; without it they get a 404 and the
// in-app review form fails with "route not found".
reviewRouter.post('/product/:productId', authenticate, reviewController.createReview);

export { reviewRouter };
