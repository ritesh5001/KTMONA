/**
 * Activity log: one row for every successful change made through the admin
 * or seller panels — who made it (account + role), what (method, path, a
 * readable summary, the submitted fields), and when.
 *
 * It hooks the response's `finish` event, so it sees `req.user` after the
 * route's own `authenticate` ran and records only changes that succeeded.
 * Writes are fire-and-forget: logging must never slow down or fail a request.
 */

import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Not "changes": token plumbing and live-connection chatter. */
const SKIP_PATHS = [
    /^\/v1\/auth\/(refresh|login|request-otp|verify-otp|resend-signup-otp|forgot-password|reset-password)/,
    /^\/v1\/live(\/|$)/,
    /^\/v1\/imagekit\/auth/,
    /^\/v1\/notifications\/.*read/,
    /^\/v1\/admin\/notifications\/.*read/,
    /^\/v1\/support\/tickets\/[^/]+\/read/,
];

/** Body fields never written to the log. */
const SECRET_KEY = /pass(word)?|token|secret|otp|pin|cvv|card/i;
const MAX_DETAILS_CHARS = 4000;

/** Path segments that are record ids rather than resource names. */
const ID_SEGMENT = /^([0-9a-f]{8}-[0-9a-f-]{27,}|c[a-z0-9]{20,}|\d+|[A-Z0-9_-]{12,})$/i;
/** Segments that only say which API it is. */
const NOISE_SEGMENT = new Set(['v1', 'admin', 'center', 'seller']);

/** Default wording when the path does not end in an action word. */
const VERB: Record<string, string> = {
    POST: 'created',
    PUT: 'updated',
    PATCH: 'updated',
    DELETE: 'deleted',
};

/** Trailing path segments that name the action taken. */
const ACTION_WORDS: Record<string, string> = {
    approve: 'approved',
    reject: 'rejected',
    review: 'reviewed',
    request: 'requested',
    withdraw: 'withdrawn',
    status: 'status changed',
    suspend: 'suspended',
    toggle: 'switched on/off',
    cancel: 'cancelled',
    refund: 'refunded',
    waive: 'waived',
    ship: 'marked shipped',
    deliver: 'marked delivered',
    accept: 'accepted',
    leave: 'left',
    hide: 'hidden',
    'set-price': 'price set',
    'force-confirm': 'force-confirmed',
    kyc: 'KYC reviewed',
    'payout-hold': 'payout hold changed',
    commission: 'commission changed',
    reschedule: 'rescheduled',
    'block-seller': 'seller blocked',
    'auto-cancel': 'auto-cancel run',
    'override-status': 'status overridden',
    'approve-cancellation': 'cancellation approved',
    messages: 'message sent',
    vacation: 'holiday mode changed',
    apply: 'application sent',
};

function redact(value: unknown, depth = 0): unknown {
    if (depth > 4 || value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
        out[key] = SECRET_KEY.test(key) ? '[hidden]' : redact(v, depth + 1);
    }
    return out;
}

function describe(method: string, path: string) {
    const segments = path.split('/').filter(Boolean);
    const ids = segments.filter((s) => ID_SEGMENT.test(s));
    const names = segments.filter((s) => !ID_SEGMENT.test(s) && !NOISE_SEGMENT.has(s));
    const last = names.at(-1);
    const actionWord = last ? ACTION_WORDS[last] : undefined;
    const resource = (actionWord ? names.slice(0, -1) : names).map((s) => s.replace(/[-_]/g, ' ')).join(' › ') || 'record';
    const sentence = `${resource.charAt(0).toUpperCase()}${resource.slice(1)}: ${actionWord ?? VERB[method] ?? method.toLowerCase()}`;
    return {
        action: sentence,
        entityType: names[0] ?? null,
        entityId: ids[0] ?? null,
    };
}

function panelFor(role: string): string {
    if (role === 'SELLER') return 'seller';
    if (role === 'USER') return 'customer';
    return 'admin';
}

export function activityLogger(req: Request, res: Response, next: NextFunction): void {
    if (!MUTATING.has(req.method)) {
        next();
        return;
    }

    res.on('finish', () => {
        const user = req.user;
        // Customers' own shopping (cart, orders, addresses) is not a change to
        // the website; the log covers the admin and seller panels.
        if (!user || user.role === 'USER') return;
        if (res.statusCode >= 400) return;

        const path = (req.originalUrl || req.url).split('?')[0] ?? '';
        if (SKIP_PATHS.some((re) => re.test(path))) return;

        const { action, entityType, entityId } = describe(req.method, path);
        let details: Prisma.InputJsonValue | undefined;
        if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
            const json = JSON.stringify(redact(req.body));
            details = json.length > MAX_DETAILS_CHARS
                ? { truncated: json.slice(0, MAX_DETAILS_CHARS) }
                : (JSON.parse(json) as Prisma.InputJsonValue);
        }

        prisma.activityLog
            .create({
                data: {
                    actorId: user.userId,
                    actorRole: user.role,
                    actorLabel: user.email ?? user.phone ?? null,
                    panel: panelFor(user.role),
                    method: req.method,
                    path,
                    action,
                    entityType,
                    entityId,
                    statusCode: res.statusCode,
                    ...(details !== undefined ? { details } : {}),
                    ip: req.ip ?? null,
                    userAgent: req.headers['user-agent']?.slice(0, 300) ?? null,
                },
            })
            .catch((err: unknown) => {
                logger.warn({ err: err instanceof Error ? err.message : String(err), path }, 'activity_log_write_failed');
            });
    });

    next();
}
