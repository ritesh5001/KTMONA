# KTMONA Multi-Vendor E-commerce Platform

KTMONA is a full-stack, multi-vendor commerce platform focused on wedding and occasion wear. The repository contains three applications that share the same domain model and APIs:

- backend: Express + Prisma API
- frontend: Next.js web application
- mobile: Expo React Native application

## Table of Contents

- Overview
- Core Features
- Architecture
- Tech Stack
- Repository Structure
- Prerequisites
- Environment Setup
- Local Development
- API Reference and Endpoints
- Backend Verification and Quality Checks
- Build and Production Run
- Troubleshooting
- Contributing
- License

## Overview

The platform supports buyers, sellers, and administrators with workflows for catalog management, media, cart and checkout, payments, shipping, notifications, reviews, and moderation.

The codebase is designed so that:

- backend owns domain logic, persistence, and integrations
- frontend provides SEO-oriented web experiences and dashboards
- mobile provides app-first buyer flows with shared backend APIs

## Core Features

- Multi-vendor product catalog and seller product management
- Category and occasion merchandising
- Cart, checkout, and multi-seller order workflows
- Payment integration with Razorpay, including webhook verification
- Shipping and fulfillment status tracking
- Notification domain with queue worker and email delivery
- Product reviews and moderation workflows
- Admin moderation and product approval lifecycle
- Three-price model support:
  - seller price
  - admin listing price
  - order-time margin snapshots

## Architecture

### Backend

Layered architecture in backend/src:

- controllers: HTTP request/response layer
- services: business rules and orchestration
- repositories: persistence access patterns
- middlewares: auth, validation, error handling
- notifications: queue and delivery channels
- config, events, jobs, validators, utils: cross-cutting support modules

Data and migrations are managed through Prisma:

- backend/prisma/schema.prisma
- backend/prisma/migrations
- backend/prisma/seed.ts

### Frontend

Next.js App Router application with route groups and role-based dashboards. API access is centralized in frontend/src/services.

### Mobile

Expo Router application with mobile-specific screens and shared service modules in mobile/src/services.

## Tech Stack

### Backend

- Node.js, TypeScript, Express
- PostgreSQL, Prisma ORM
- Redis and BullMQ for queue processing
- Upstash Redis for caching paths
- Zod validation
- Scalar API docs/OpenAPI support
- Razorpay payments
- Resend email delivery

### Frontend

- Next.js 16, React 19, TypeScript
- Tailwind CSS 4
- Framer Motion, Swiper, Recharts

### Mobile

- Expo 54, React Native 0.81, TypeScript
- Expo Router
- React Query and Async Storage persistence

## Repository Structure

```text
.
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── migrations/
│   ├── scripts/
│   └── src/
│       ├── app.ts
│       ├── server.ts
│       ├── worker.ts
│       ├── config/
│       ├── controllers/
│       ├── docs/
│       ├── events/
│       ├── jobs/
│       ├── middlewares/
│       ├── monitoring/
│       ├── notifications/
│       ├── repositories/
│       ├── routes/
│       ├── services/
│       ├── types/
│       ├── utils/
│       └── validators/
├── frontend/
│   ├── public/
│   └── src/
└── mobile/
    ├── app/
    ├── assets/
    ├── public/
    └── src/
```

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- PostgreSQL instance
- Redis instance for queue worker flows

Recommended:

- Separate terminal windows for API, worker, web, and mobile
- A local environment manager for secrets

## Environment Setup

Create these environment files before running the apps.

### backend/.env

```env
# Runtime
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME"

# Auth
JWT_ACCESS_SECRET="replace-with-strong-secret"
JWT_REFRESH_SECRET="replace-with-strong-secret"
ACCESS_TOKEN_EXPIRY="15m"
REFRESH_TOKEN_EXPIRY="7d"

# Redis cache (Upstash)
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."

# Redis queue (BullMQ)
REDIS_URL="redis://default:password@host:port"

# Email
RESEND_API_KEY="re_..."
EMAIL_FROM="noreply@yourdomain.com"

# Mobile OTP
FAST2SMS_API_KEY="your-fast2sms-api-key"
FAST2SMS_BASE_URL="https://www.fast2sms.com/dev/bulkV2"

# ImageKit
IMAGEKIT_PUBLIC_KEY="..."
IMAGEKIT_PRIVATE_KEY="..."
IMAGEKIT_URL_ENDPOINT="https://ik.imagekit.io/..."

# Razorpay
RAZORPAY_KEY_ID="rzp_..."
RAZORPAY_KEY_SECRET="..."
RAZORPAY_WEBHOOK_SECRET="..."

# Optional CORS override
CORS_ORIGIN="http://localhost:3001"
```

### frontend/.env.local

```env
NEXT_PUBLIC_API_BASE_URL="http://localhost:3000"
NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY="..."
NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT="https://ik.imagekit.io/..."
```

### mobile/.env

```env
EXPO_PUBLIC_API_BASE_URL="http://localhost:3000"
```

Notes:

- For physical devices and emulators, use a reachable LAN URL instead of localhost when needed.
- Keep production secrets out of source control.

## Local Development

### 1) Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
cd ../mobile && npm install
```

### 2) Initialize backend database

```bash
cd backend
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

### 3) Run applications

Backend API:

```bash
cd backend
npm run dev:api
```

Backend worker:

```bash
cd backend
npm run dev:worker
```

Frontend web:

```bash
cd frontend
npm run dev -- -p 3001
```

Mobile app:

```bash
cd mobile
npm run dev
```

## API Reference and Endpoints

When backend is running locally:

- Base URL: http://localhost:3000
- Health check: GET /health
- API docs: http://localhost:3000/docs

Primary route groups include:

- /v1/auth
- /v1/categories
- /v1/products
- /v1/cart
- /v1/checkout
- /v1/orders
- /v1/payments
- /v1/reviews
- /v1/seller/*
- /v1/admin/*

## Backend Verification and Quality Checks

Run from backend.

Domain verification scripts:

```bash
npm run verify:auth
npm run verify:product
npm run verify:cart
npm run verify:orders
npm run verify:payment
npm run verify:shipping
npm run verify:admin
npm run verify:notifications
npm run verify:razorpay
npm run verify:all
```

Race and concurrency simulations:

```bash
npm run verify:cancellation-race
npm run verify:return-race
npm run verify:refund-race
npm run verify:commission-race
npm run verify:coupon-race
```

Type and build checks:

```bash
npm run typecheck
npm run build
```

## Build and Production Run

### Backend

```bash
cd backend
npm run build
npm run start:api
```

Run worker process separately:

```bash
cd backend
npm run start:worker
```

Apply Prisma migrations in deployment pipelines:

```bash
cd backend
npx prisma migrate deploy
```

### Frontend

```bash
cd frontend
npm run build
npm run start
```

### Mobile

Use Expo build and run flows as required by your deployment target.

## Troubleshooting

- If frontend cannot reach backend, verify NEXT_PUBLIC_API_BASE_URL and CORS settings.
- If worker jobs are not processing, verify REDIS_URL and that the worker process is running.
- If media upload fails, verify ImageKit keys and backend auth endpoint.
- If payment webhook verification fails, verify Razorpay webhook secret and raw body handling configuration.
- If Prisma errors occur after schema updates, run prisma generate and apply migrations.

## Contributing

1. Create a feature branch from main.
2. Keep pull requests focused and include test or verification evidence.
3. Document migration or env changes clearly in the pull request.
4. Run relevant backend verification scripts before requesting review.

## License

This repository is private/proprietary unless maintainers publish a separate license.
