import { PrismaClient } from '@prisma/client';
import { sendEmail } from './email-service.js';
import { getDripTemplate } from './email-templates.js';

const prisma = new PrismaClient();

// ─── Drip Schedule ──────────────────────────────────────────────────────────
// Step → delay from registration time
const DRIP_SCHEDULE: { step: number; delayMs: number }[] = [
    { step: 0, delayMs: 0 },                          // instant (welcome)
    { step: 1, delayMs: 4 * 60 * 60 * 1000 },         // +4 hours
    { step: 2, delayMs: 24 * 60 * 60 * 1000 },        // day 1
    { step: 3, delayMs: 2 * 24 * 60 * 60 * 1000 },    // day 2
    { step: 4, delayMs: 3 * 24 * 60 * 60 * 1000 },    // day 3
    { step: 5, delayMs: 5 * 24 * 60 * 60 * 1000 },    // day 5
    { step: 6, delayMs: 6 * 24 * 60 * 60 * 1000 },    // day 6
    { step: 7, delayMs: 7 * 24 * 60 * 60 * 1000 },    // day 7
];

/**
 * Enroll a new user into the drip campaign.
 * Creates all 8 drip rows with scheduled times.
 * Step 0 (welcome) is scheduled immediately.
 */
export async function enrollUser(userId: string, email: string): Promise<void> {
    const now = new Date();

    // Check if user is already enrolled (idempotent)
    const existing = await prisma.emailDrip.findFirst({ where: { userId, step: 0 } });
    if (existing) {
        console.log(`[Drip] User ${email} already enrolled, skipping`);
        return;
    }

    const drips = DRIP_SCHEDULE.map(({ step, delayMs }) => ({
        userId,
        email,
        step,
        scheduledFor: new Date(now.getTime() + delayMs),
        status: 'pending',
    }));

    await prisma.emailDrip.createMany({ data: drips });
    console.log(`[Drip] Enrolled ${email} — ${drips.length} emails scheduled`);
}

/**
 * Process all pending drip emails that are due.
 * Called periodically by a cron/interval.
 * Skips users who have upgraded (plan ≠ Free).
 */
export async function processPendingDrips(): Promise<void> {
    const now = new Date();

    const pendingDrips = await prisma.emailDrip.findMany({
        where: {
            status: 'pending',
            scheduledFor: { lte: now },
        },
        orderBy: [{ scheduledFor: 'asc' }],
        take: 50, // batch size
    });

    if (pendingDrips.length === 0) return;

    console.log(`[Drip] Processing ${pendingDrips.length} pending emails...`);

    for (const drip of pendingDrips) {
        try {
            // Check if user has upgraded — skip remaining drips
            const user = await prisma.user.findUnique({
                where: { id: drip.userId },
                include: { subscription: true },
            });

            if (!user) {
                await prisma.emailDrip.update({
                    where: { id: drip.id },
                    data: { status: 'skipped', sentAt: now },
                });
                continue;
            }

            const plan = (user as any).subscription?.plan || 'Free';

            // Skip upgrade/urgency emails (steps 4-7) if user already upgraded
            if (plan !== 'Free' && drip.step >= 4) {
                await prisma.emailDrip.update({
                    where: { id: drip.id },
                    data: { status: 'skipped', sentAt: now },
                });
                console.log(`[Drip] Skipped step ${drip.step} for ${drip.email} (plan: ${plan})`);
                continue;
            }

            // Get template
            const name = user.full_name || 'there';
            const template = getDripTemplate(drip.step, name);

            if (!template) {
                await prisma.emailDrip.update({
                    where: { id: drip.id },
                    data: { status: 'failed', sentAt: now },
                });
                continue;
            }

            // Send email
            const result = await sendEmail(drip.email, template.subject, template.html);

            await prisma.emailDrip.update({
                where: { id: drip.id },
                data: {
                    status: result.success ? 'sent' : 'failed',
                    sentAt: now,
                },
            });

            // Brief delay between sends to avoid rate limits
            await new Promise(r => setTimeout(r, 500));

        } catch (err: any) {
            console.error(`[Drip] Error processing drip ${drip.id}:`, err.message);
            await prisma.emailDrip.update({
                where: { id: drip.id },
                data: { status: 'failed', sentAt: now },
            }).catch(() => { });
        }
    }
}
