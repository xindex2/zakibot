import { PrismaClient } from '@prisma/client';
import { sendEmail } from './email-service.js';
import { getDripTemplate } from './email-templates.js';

const prisma = new PrismaClient();

// ─── Drip Schedule ──────────────────────────────────────────────────────────
// Step → delay from enrollment time
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
 * Check if a user is on a paid plan (anything other than 'Free').
 */
async function isUserPaid(userId: string): Promise<boolean> {
    try {
        const sub = await prisma.subscription.findUnique({ where: { userId } });
        return sub?.plan !== undefined && sub.plan !== 'Free';
    } catch {
        return false;
    }
}

/**
 * Enroll a new user into the drip campaign.
 * Creates all 8 drip rows with scheduled times.
 * Skips enrollment entirely if the user is already on a paid plan.
 */
export async function enrollUser(userId: string, email: string): Promise<void> {
    const now = new Date();

    // Don't enroll users who already upgraded
    if (await isUserPaid(userId)) {
        console.log(`[Drip] User ${email} is on a paid plan, skipping enrollment`);
        return;
    }

    // Check if user is already enrolled (idempotent)
    const existing = await (prisma as any).emailDrip.findFirst({ where: { userId, step: 0 } });
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

    await (prisma as any).emailDrip.createMany({ data: drips });
    console.log(`[Drip] Enrolled ${email} — ${drips.length} emails scheduled`);
}

/**
 * Cancel ALL pending drip emails for a user (called when they upgrade).
 * Marks all pending emails as 'skipped'.
 */
export async function cancelPendingDrips(userId: string): Promise<number> {
    try {
        const result = await (prisma as any).emailDrip.updateMany({
            where: {
                userId,
                status: 'pending',
            },
            data: {
                status: 'skipped',
                sentAt: new Date(),
            },
        });
        console.log(`[Drip] Cancelled ${result.count} pending emails for user ${userId}`);
        return result.count;
    } catch (err: any) {
        console.error(`[Drip] Failed to cancel drips for ${userId}:`, err.message);
        return 0;
    }
}

/**
 * Process all pending drip emails that are due.
 * Called every 15 minutes by the scheduler.
 * If user is on a paid plan → skip ALL remaining drips.
 */
export async function processPendingDrips(): Promise<void> {
    const now = new Date();

    let pendingDrips: any[];
    try {
        pendingDrips = await (prisma as any).emailDrip.findMany({
            where: {
                status: 'pending',
                scheduledFor: { lte: now },
            },
            orderBy: [{ scheduledFor: 'asc' }],
            take: 50,
        });
    } catch (err: any) {
        console.error('[Drip] Failed to query pending drips:', err.message);
        return;
    }

    if (pendingDrips.length === 0) {
        console.log('[Drip] No pending emails to process');
        return;
    }

    console.log(`[Drip] Processing ${pendingDrips.length} pending emails...`);

    for (const drip of pendingDrips) {
        try {
            // Look up the user
            const user = await prisma.user.findUnique({
                where: { id: drip.userId },
                include: { subscription: true },
            });

            // User deleted? Skip
            if (!user) {
                await (prisma as any).emailDrip.update({
                    where: { id: drip.id },
                    data: { status: 'skipped', sentAt: now },
                });
                continue;
            }

            const plan = (user as any).subscription?.plan || 'Free';

            // ★ If user is on ANY paid plan → skip ALL drip emails + cancel future ones
            if (plan !== 'Free') {
                await cancelPendingDrips(drip.userId);
                console.log(`[Drip] User ${drip.email} upgraded to ${plan} — all drips cancelled`);
                continue;
            }

            // Get email template
            const name = user.full_name || 'there';
            const template = getDripTemplate(drip.step, name);

            if (!template) {
                await (prisma as any).emailDrip.update({
                    where: { id: drip.id },
                    data: { status: 'failed', sentAt: now },
                });
                continue;
            }

            // Send it
            const result = await sendEmail(drip.email, template.subject, template.html);

            await (prisma as any).emailDrip.update({
                where: { id: drip.id },
                data: {
                    status: result.success ? 'sent' : 'failed',
                    sentAt: now,
                },
            });

            if (result.success) {
                console.log(`[Drip] ✅ Sent step ${drip.step} to ${drip.email}`);
            } else {
                console.log(`[Drip] ❌ Failed step ${drip.step} for ${drip.email}: ${result.error}`);
            }

            // Brief delay between sends to avoid rate limits
            await new Promise(r => setTimeout(r, 500));

        } catch (err: any) {
            console.error(`[Drip] Error processing drip ${drip.id}:`, err.message);
            await (prisma as any).emailDrip.update({
                where: { id: drip.id },
                data: { status: 'failed', sentAt: now },
            }).catch(() => { });
        }
    }

    console.log('[Drip] Processing complete');
}
