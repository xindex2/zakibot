import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const plans = await prisma.whopPlan.findMany({
            orderBy: { maxInstances: 'asc' }
        });
        console.log("Success:", plans);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
