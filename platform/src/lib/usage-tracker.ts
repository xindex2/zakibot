import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Deduct credits from a user's balance and log the transaction.
 * Returns the new balance, or throws if insufficient credits.
 */
export async function deductCredits(
    userId: string,
    amount: number,
    description: string
): Promise<number> {
    // Use a transaction to atomically deduct + log
    return await prisma.$transaction(async (tx: any) => {
        const sub = await tx.subscription.findUnique({
            where: { userId }
        });

        if (!sub) throw new Error('No subscription found');

        const newBalance = sub.creditBalance - amount;
        if (newBalance < 0) {
            throw new Error('INSUFFICIENT_CREDITS');
        }

        await tx.subscription.update({
            where: { userId },
            data: { creditBalance: newBalance }
        });

        await tx.creditTransaction.create({
            data: {
                userId,
                amount: -amount, // negative = debit
                type: 'usage',
                description
            }
        });

        return newBalance;
    });
}

/**
 * Check if user has sufficient credits (> $0.001 minimum).
 */
export async function hasCredits(userId: string): Promise<boolean> {
    const sub = await prisma.subscription.findUnique({
        where: { userId },
        select: { creditBalance: true }
    });
    return (sub?.creditBalance ?? 0) > 0.001;
}

/**
 * Get the current credit balance for a user.
 */
export async function getBalance(userId: string): Promise<number> {
    const sub = await prisma.subscription.findUnique({
        where: { userId },
        select: { creditBalance: true }
    });
    return sub?.creditBalance ?? 0;
}

/**
 * Estimate cost for a message based on token counts and model pricing.
 * Prices are per-token from OpenRouter (e.g. "0.000003" = $3/1M tokens).
 */
export function estimateCost(
    inputTokens: number,
    outputTokens: number,
    promptPrice: number,  // USD per token
    completionPrice: number  // USD per token
): number {
    return (inputTokens * promptPrice) + (outputTokens * completionPrice);
}

/**
 * Get recent usage transactions for a user.
 */
export async function getUsageHistory(userId: string, limit: number = 50) {
    return await prisma.creditTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit
    });
}
