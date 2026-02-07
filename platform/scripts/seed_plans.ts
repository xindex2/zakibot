import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding Whop Plans...');

    const plans = [
        { id: 'plan_Ke7ZeyJO29DwZ', name: 'Starter (1 Agent)', limit: 1 },
        { id: 'plan_9NRNdPMrVzwi8', name: 'Pro (5 Agents)', limit: 5 },
        { id: 'plan_XXO2Ey0ki51AI', name: 'Elite (10 Agents)', limit: 10 }
    ];

    for (const plan of plans) {
        await prisma.whopPlan.upsert({
            where: { whopPlanId: plan.id },
            update: {
                planName: plan.name,
                maxInstances: plan.limit
            },
            create: {
                whopPlanId: plan.id,
                planName: plan.name,
                maxInstances: plan.limit
            }
        });
        console.log(`✅ Seeded plan: ${plan.name} (${plan.id})`);
    }

    console.log('✨ Seeding complete');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
