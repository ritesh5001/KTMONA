import { verifyAuth } from './verify-auth.js';
import { verifyProduct } from './verify-product.js';
import { verifyCart } from './verify-cart.js';
import { verifyOrders } from './verify-orders.js';
import { verifyPayment } from './verify-payment.js';
import { verifyAdmin } from './verify-admin.js';
import { verifyNotifications } from './verify-notifications.js';
import { verifyShipping } from './verify-shipping.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runAll() {
    try {
        await verifyAuth();
        console.log('\n----------------------------------------\n');
        await verifyProduct();
        console.log('\n----------------------------------------\n');
        await verifyCart();
        console.log('\n----------------------------------------\n');
        await verifyOrders();
        console.log('\n----------------------------------------\n');
        await verifyPayment();
        console.log('\n----------------------------------------\n');
        await verifyAdmin();
        console.log('\n----------------------------------------\n');
        await verifyNotifications();
        console.log('\n----------------------------------------\n');
        await verifyShipping();
        console.log('\n✅ ALL SYSTEMS GO! ✨');
    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

runAll().catch(console.error);
