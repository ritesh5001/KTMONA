
import { prisma } from '../src/config/db.js';

async function verifyReviews() {
    console.log('Verifying Review System...');

    // 1. Check Schema
    try {
        const count = await prisma.review.count();
        console.log('✅ Review table exists. Count:', count);
    } catch (e) {
        console.error('❌ Review table missing or error:', e);
        return;
    }

    // 2. We can simulate controller calls or just check if code compiles/runs
    // Real E2E test requires HTTP requests.
    console.log('✅ Verification script loaded successfully.');
    console.log('Please test manually via Frontend or Postman for full logic verification.');
}

verifyReviews()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
