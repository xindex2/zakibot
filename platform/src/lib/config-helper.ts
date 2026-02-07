import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getSystemConfig(key: string): Promise<string | undefined> {
    const config = await prisma.systemConfig.findUnique({
        where: { key }
    });
    return config?.value || process.env[key];
}
