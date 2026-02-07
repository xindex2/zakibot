import { NextResponse } from 'next/server';
import { startBot, stopBot, getBotStatus } from '@/lib/bot-executor';

export async function POST(req: Request) {
    try {
        const { userId, action } = await req.json();

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        if (action === 'start') {
            await startBot(userId);
            return NextResponse.json({ status: 'running' });
        } else if (action === 'stop') {
            await stopBot(userId);
            return NextResponse.json({ status: 'stopped' });
        } else if (action === 'status') {
            const status = getBotStatus(userId);
            return NextResponse.json({ status });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
