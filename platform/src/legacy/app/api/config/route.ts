import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        const config = await prisma.botConfig.findFirst({
            where: { userId },
        });
        return NextResponse.json(config || {});
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { userId, ...configData } = body;

        console.log(`[Config API] Received POST for user: ${userId}`);

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
        }

        // Ensure user exists (demo-user fallback)
        let user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user && userId === 'demo-user') {
            user = await prisma.user.create({
                data: {
                    id: 'demo-user',
                    email: 'demo@openclaw-host.ai',
                    password: 'demo_password_hash'
                }
            });
            console.log(`[Config API] Created demo-user record`);
        } else if (!user) {
            return NextResponse.json({ error: 'User does not exist' }, { status: 400 });
        }

        const existingConfig = await prisma.botConfig.findFirst({
            where: { userId },
        });

        // Clean up data before saving to prisma
        const cleanData: any = { ...configData };
        delete cleanData.id;
        delete cleanData.createdAt;
        delete cleanData.updatedAt;
        delete cleanData.userId;
        delete cleanData.user;

        // Type coercion for numbers
        if (cleanData.gatewayPort) cleanData.gatewayPort = parseInt(cleanData.gatewayPort);
        if (cleanData.maxToolIterations) cleanData.maxToolIterations = parseInt(cleanData.maxToolIterations);

        const config = await prisma.botConfig.upsert({
            where: { id: existingConfig?.id || 'new-uuid-placeholder' },
            update: cleanData,
            create: {
                userId,
                ...cleanData,
            },
        });

        console.log(`[Config API] Successfully saved bot config for ${userId}`);
        return NextResponse.json(config);
    } catch (error: any) {
        console.error('[Config API Error]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
