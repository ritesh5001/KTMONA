import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const CATEGORIES = [
    { name: 'Saree', slug: 'saree' },
    { name: 'Lehenga', slug: 'lehenga' },
    { name: 'Kurta', slug: 'kurta' },
    { name: 'Sherwani', slug: 'sherwani' },
    { name: 'Indo-Western', slug: 'indo-western' },
];

const SUPER_ADMIN_EMAIL = 'rgiri5001@gmail.com';
const SUPER_ADMIN_PASSWORD = 'Ritesh5001@';

async function main() {
    console.log('🌱 Starting seed...');

    const superAdminPasswordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);

    const superAdminUser = await prisma.user.upsert({
        where: { email: SUPER_ADMIN_EMAIL },
        update: {
            passwordHash: superAdminPasswordHash,
            role: 'SUPER_ADMIN',
            status: 'ACTIVE',
            isEmailVerified: true,
            isPhoneVerified: false,
        },
        create: {
            email: SUPER_ADMIN_EMAIL,
            passwordHash: superAdminPasswordHash,
            role: 'SUPER_ADMIN',
            status: 'ACTIVE',
            isEmailVerified: true,
            isPhoneVerified: false,
        },
    });

    await prisma.superAdminProfile.upsert({
        where: { userId: superAdminUser.id },
        update: {},
        create: {
            userId: superAdminUser.id,
            firstName: 'Ritesh',
            lastName: 'Giri',
        },
    });

    console.log(`Super admin ensured: ${SUPER_ADMIN_EMAIL}`);

    for (const category of CATEGORIES) {
        const existing = await prisma.category.findUnique({
            where: { slug: category.slug },
        });

        if (!existing) {
            await prisma.category.create({
                data: {
                    name: category.name,
                    slug: category.slug,
                    isActive: true,
                },
            });
            console.log(`Created category: ${category.name}`);
        } else {
            console.log(`Category already exists: ${category.name}`);
        }
    }

    console.log('✅ Seed completed');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
