import { PrismaClient } from '@prisma/client';
import { decrypt } from './crypto.js';

const prisma = new PrismaClient();

export async function getSystemConfig(key: string): Promise<string | undefined> {
    const config = await prisma.systemConfig.findUnique({
        where: { key }
    });
    if (config?.value) {
        // Decrypt if the value was stored encrypted (starts with 'enc:')
        return decrypt(config.value);
    }
    return process.env[key];
}
