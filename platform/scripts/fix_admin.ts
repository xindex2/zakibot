import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking/Updating Admin Users ---');
    const users = await prisma.user.findMany();
    console.log(`Found ${users.length} users.`);

    for (const user of users) {
        console.log(`- ${user.email} (Role: ${user.role})`);
        if (user.email === 'ezzakyyy@gmail.com' && user.role !== 'admin') {
            console.log(`Promoting ${user.email} to admin...`);
            await prisma.user.update({
                where: { email: user.email },
                data: { role: 'admin' }
            });
            console.log('Done.');
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
