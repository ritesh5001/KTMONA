import { bestsellerService } from '../services/bestseller.service.js';
export const bestsellerController = {
    /**
     * GET /v1/bestsellers
     */
    list: async (req, res, next) => {
        try {
            const limitParam = req.query['limit'];
            const limit = limitParam ? Number(limitParam) : undefined;
            const audienceRaw = req.query['audience'];
            const audience = typeof audienceRaw === 'string' && (audienceRaw.toUpperCase() === 'MENS' || audienceRaw.toUpperCase() === 'KIDS')
                ? audienceRaw.toUpperCase()
                : undefined;
            const result = await bestsellerService.listPublic(limit, audience);
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    },
};
//# sourceMappingURL=bestseller.controller.js.map