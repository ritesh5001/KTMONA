import { prisma } from '../src/config/db.js';
async function main() {
    const p = await prisma.product.findUnique({
        where: { id: 'cmnjzdra801ffxn50np941bng' },
        select: {
            id: true,
            title: true,
            updatedAt: true,
            variants: {
                select: { size: true, color: true, colorHex: true, sku: true, images: true },
                orderBy: { createdAt: 'asc' },
            },
        },
    });
    console.log(`${p?.title} updatedAt=${p?.updatedAt.toISOString()}`);
    for (const v of p?.variants ?? []) {
        console.log(`  ${v.color} ${v.colorHex} | ${v.size} | ${v.sku} | ${v.images.length} imgs`);
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
//# sourceMappingURL=_tmp-check.js.map