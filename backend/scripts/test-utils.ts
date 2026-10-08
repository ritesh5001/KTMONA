import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env.js';
import { generateAccessToken, Role, UserStatus } from '../src/utils/jwt.util.js';
import bcrypt from 'bcrypt';

export const prisma = new PrismaClient();
export const BASE_URL = `http://localhost:${env.PORT}`;

export const COLORS = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    gray: '\x1b[90m'
};

export const LOG = {
    info: (msg: string) => console.log(`${COLORS.cyan}[INFO]${COLORS.reset} ${msg}`),
    success: (msg: string) => console.log(`${COLORS.green}✅ [PASS]${COLORS.reset} ${msg}`),
    error: (msg: string, details?: any) => {
        console.error(`${COLORS.red}❌ [FAIL]${COLORS.reset} ${msg}`);
        if (details) console.error(COLORS.gray, JSON.stringify(details, null, 2), COLORS.reset);
    },
    step: (msg: string) => console.log(`\n👉 ${msg}`)
};

export async function request(path: string, method: string = 'GET', body?: any, token?: string): Promise<{ status: number; data: any }> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
        let requestBody = body;
        if (
            method.toUpperCase() === 'POST' &&
            path === '/v1/seller/products' &&
            requestBody &&
            requestBody.sellerPrice === undefined
        ) {
            requestBody = {
                ...requestBody,
                sellerPrice: 500,
            };
        }

        const response = await fetch(`${BASE_URL}${path}`, {
            method,
            headers,
            body: requestBody ? JSON.stringify(requestBody) : null
        });

        const data = await response.json().catch(() => ({}));
        return { status: response.status, data };
    } catch (error) {
        return { status: 0, data: error };
    }
}

export async function ensureAdminToken() {
    const email = `script-admin-${Date.now()}@test.com`;
    const admin = await prisma.user.create({
        data: {
            email,
            passwordHash: 'hash',
            role: Role.ADMIN,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
        },
    });

    return generateAccessToken({
        userId: admin.id,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        status: admin.status,
        isEmailVerified: admin.isEmailVerified,
        isPhoneVerified: admin.isPhoneVerified,
    });
}

export async function ensureSeller() {
    const email = 'test-seller@verified.com';
    const phone = '9998887776';

    const password = 'Password123!';
    const passwordHash = await bcrypt.hash(password, 10);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        await prisma.user.update({
            where: { email },
            data: {
                phone,
                passwordHash,
                status: 'ACTIVE',
                role: 'SELLER',
                isEmailVerified: true,
                isPhoneVerified: true,
            },
        });
    } else {
        await prisma.user.create({
            data: {
                email,
                phone,
                passwordHash,
                role: 'SELLER',
                status: 'ACTIVE',
                isEmailVerified: true,
                isPhoneVerified: true,
            },
        });
    }

    return { email, password };
}

export async function ensureBuyer() {
    const email = 'test-buyer@verified.com';
    const phone = '1112223334';

    const password = 'Password123!';
    const passwordHash = await bcrypt.hash(password, 10);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        await prisma.user.update({
            where: { email },
            data: {
                phone,
                passwordHash,
                role: 'USER',
                status: 'ACTIVE',
                isEmailVerified: true,
                isPhoneVerified: true,
            },
        });
    } else {
        await prisma.user.create({
            data: {
                email,
                phone,
                passwordHash,
                role: 'USER',
                status: 'ACTIVE',
                isEmailVerified: true,
                isPhoneVerified: true,
            },
        });
    }

    return { email, password };
}
