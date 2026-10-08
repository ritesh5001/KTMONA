import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { settlementRepository } from '../repositories/settlement.repository.js'; // Using repo directly for simple read, or create controller if needed. Plan said generic route but let's stick to simple implementation.
const router = Router();
router.use(authenticate);
router.use(authorize('SELLER', 'ADMIN', 'SUPER_ADMIN'));
router.get('/', async (req, res, next) => {
    try {
        const sellerId = req.user.userId;
        const settlements = await settlementRepository.findSettlementsBySellerId(sellerId);
        res.json({
            success: true,
            data: settlements
        });
    }
    catch (error) {
        next(error);
    }
});
export const sellerSettlementRoutes = router;
//# sourceMappingURL=seller-settlement.routes.js.map