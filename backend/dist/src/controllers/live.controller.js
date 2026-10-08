import { extractBearerToken, verifyAccessToken } from '../utils/jwt.util.js';
import { onLiveDashboardEvent } from '../live/live-events.js';
import { ApiError } from '../errors/ApiError.js';
function resolveAuthenticatedUser(req) {
    const bearer = extractBearerToken(req.headers.authorization);
    const queryToken = typeof req.query['accessToken'] === 'string' ? req.query['accessToken'] : null;
    const token = bearer ?? queryToken;
    if (!token) {
        throw ApiError.unauthorized('Access token required');
    }
    return verifyAccessToken(token);
}
function canReceiveEvent(event, user) {
    const audience = event.audience;
    if (!audience || audience.allAuthenticated) {
        return true;
    }
    if (audience.userIds?.includes(user.userId)) {
        return true;
    }
    if (audience.roles?.includes(user.role)) {
        return true;
    }
    return false;
}
function writeSseEvent(res, eventName, data) {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}
export class LiveController {
    events = async (req, res, next) => {
        try {
            const user = resolveAuthenticatedUser(req);
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            res.flushHeaders();
            writeSseEvent(res, 'connected', {
                userId: user.userId,
                role: user.role,
                now: new Date().toISOString(),
            });
            const unsubscribe = onLiveDashboardEvent((event) => {
                if (!canReceiveEvent(event, user)) {
                    return;
                }
                writeSseEvent(res, event.type, event);
            });
            const heartbeat = setInterval(() => {
                writeSseEvent(res, 'heartbeat', { now: Date.now() });
            }, 20000);
            req.on('close', () => {
                clearInterval(heartbeat);
                unsubscribe();
            });
        }
        catch (error) {
            next(error);
        }
    };
}
export const liveController = new LiveController();
//# sourceMappingURL=live.controller.js.map