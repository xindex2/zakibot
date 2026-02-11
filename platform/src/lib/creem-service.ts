import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class CreemService {
    /**
     * Verify Creem webhook signature (HMAC-SHA256)
     */
    static verifySignature(payload: string, signature: string, secret: string): boolean {
        if (!signature || !secret) return false;

        const hmac = crypto.createHmac('sha256', secret);
        const digest = hmac.update(payload).digest('hex');

        return signature === digest;
    }

    /**
     * Process Creem Webhook Event
     */
    static async handleEvent(event: any) {
        const eventType = event.eventType;
        const data = event.object;

        // Log event (reuse WhopEvent table for audit trail)
        await prisma.whopEvent.create({
            data: {
                eventType: `creem:${eventType}`,
                whopUserId: data?.customer?.id || null,
                email: data?.customer?.email || null,
                payload: JSON.stringify(event)
            }
        });

        switch (eventType) {
            case 'checkout.completed':
                // Check if this is a credit purchase (one-time) or a subscription
                if (await this.isCreditPurchase(data)) {
                    await this.handleCreditPurchase(data, eventType);
                } else {
                    await this.handleSubscriptionStatus(data, eventType, 'active');
                }
                break;
            case 'subscription.active':
            case 'subscription.paid':
            case 'subscription.update':
                await this.handleSubscriptionStatus(data, eventType, 'active');
                break;

            case 'subscription.canceled':
            case 'subscription.expired':
            case 'subscription.past_due':
            case 'refund.created':
            case 'dispute.created':
                await this.handleSubscriptionStatus(data, eventType, 'deactivated');
                break;

            case 'subscription.scheduled_cancel':
            case 'subscription.trialing':
            case 'subscription.paused':
                // Logged only — no immediate status change
                break;

            default:
                console.log(`[Creem] Unhandled event type: ${eventType}`);
        }
    }

    private static async handleSubscriptionStatus(data: any, eventType: string, status: string) {
        // For checkout.completed, customer is nested inside object
        const customer = data?.customer;
        const email = customer?.email;

        if (!email) {
            console.error('[Creem] Event missing customer email:', data);
            return;
        }

        // Extract product and subscription info
        // checkout.completed has nested subscription/product objects
        // subscription.* events have product as nested object
        let productId: string | undefined;
        let subscriptionId: string | undefined;

        if (eventType === 'checkout.completed') {
            productId = data?.product?.id;
            subscriptionId = data?.subscription?.id;
        } else {
            // subscription.* events — product is nested
            productId = data?.product?.id;
            subscriptionId = data?.id;
        }

        // Find or create user by email
        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    email,
                    password: crypto.randomBytes(16).toString('hex'),
                    full_name: customer?.name || 'Commander',
                    acquisition_source: 'Creem'
                }
            });
        }

        // Map Creem product to plan config
        const planConfig = productId ? await prisma.creemPlan.findUnique({
            where: { creemProductId: productId }
        }) : null;

        const maxInstances = planConfig ? planConfig.maxInstances : 1;
        const planName = planConfig ? planConfig.planName : 'Starter';

        await prisma.subscription.upsert({
            where: { userId: user.id },
            update: {
                status,
                plan: planName,
                maxInstances,
                creemSubscriptionId: subscriptionId,
                creemProductId: productId
            },
            create: {
                userId: user.id,
                status,
                plan: planName,
                maxInstances,
                creemSubscriptionId: subscriptionId,
                creemProductId: productId
            }
        });

        // --- Order Tracking ---
        const checkoutId = data?.id || data?.checkout?.id;
        const requestId = data?.request_id; // Our order ID passed during checkout creation
        const amount = data?.amount ? parseFloat(data.amount) / 100 : this.getPlanPrice(planName);

        if (eventType === 'checkout.completed') {
            // Try to find the pending order we created at checkout time
            let pendingOrder = null;
            if (requestId) {
                pendingOrder = await prisma.order.findUnique({ where: { id: requestId } });
            }
            if (!pendingOrder && checkoutId) {
                pendingOrder = await prisma.order.findUnique({ where: { checkoutId } });
            }

            if (pendingOrder) {
                // Update the pending order to completed
                await prisma.order.update({
                    where: { id: pendingOrder.id },
                    data: {
                        status: 'completed',
                        checkoutId: checkoutId || pendingOrder.checkoutId,
                        subscriptionId,
                        amount: amount || pendingOrder.amount,
                        planName: planName || pendingOrder.planName,
                    }
                });
            } else {
                // No pending order found — create a new completed order
                await prisma.order.create({
                    data: {
                        userId: user.id,
                        type: 'subscription',
                        status: 'completed',
                        amount: amount || 0,
                        planName,
                        productId,
                        checkoutId: checkoutId || `sub_${subscriptionId}_${Date.now()}`,
                        subscriptionId,
                        provider: 'creem',
                    }
                });
            }
        } else if (status === 'deactivated') {
            // Mark latest order as refunded on refund/dispute/cancel
            const latestOrder = await prisma.order.findFirst({
                where: { userId: user.id, type: 'subscription', status: 'completed' },
                orderBy: { createdAt: 'desc' }
            });
            if (latestOrder) {
                const newStatus = eventType.includes('refund') || eventType.includes('dispute') ? 'refunded' : 'canceled';
                await prisma.order.update({ where: { id: latestOrder.id }, data: { status: newStatus } });
            }
        }

        console.log(`[Creem] ${status === 'active' ? 'Activated' : 'Deactivated'} subscription for ${email} (plan: ${planName})`);
    }

    /**
     * Get plan price from plan name for order tracking
     */
    private static getPlanPrice(planName: string): number {
        const prices: Record<string, number> = {
            'Starter': 29, 'Pro': 69, 'Elite': 99,
        };
        return prices[planName] || 0;
    }

    /**
     * Check if a checkout event is for credits (one-time purchase) vs subscription
     */
    private static async isCreditPurchase(data: any): Promise<boolean> {
        const productId = data?.product?.id;
        if (!productId) return false;

        const plan = await prisma.creemPlan.findUnique({
            where: { creemProductId: productId }
        });

        // Credit packs use planName starting with "Credits_" (e.g. "Credits_10", "Credits_25")
        return plan?.planName?.startsWith('Credits_') || false;
    }

    /**
     * Handle a one-time credit purchase
     */
    private static async handleCreditPurchase(data: any, eventType: string) {
        const customer = data?.customer;
        const email = customer?.email;
        const productId = data?.product?.id;

        if (!email) {
            console.error('[Creem] Credit purchase missing customer email:', data);
            return;
        }

        // Look up the credit pack configuration
        const creditPack = productId ? await prisma.creemPlan.findUnique({
            where: { creemProductId: productId }
        }) : null;

        if (!creditPack || !creditPack.planName.startsWith('Credits_')) {
            console.error('[Creem] Unknown credit product:', productId);
            return;
        }

        // Extract credit amount from planName (e.g. "Credits_10" => 10)
        const creditAmount = parseFloat(creditPack.planName.replace('Credits_', ''));
        if (isNaN(creditAmount) || creditAmount <= 0) {
            console.error('[Creem] Invalid credit amount from plan:', creditPack.planName);
            return;
        }

        // Find user by email
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    email,
                    password: crypto.randomBytes(16).toString('hex'),
                    full_name: customer?.name || 'Commander',
                    acquisition_source: 'Creem Credits'
                }
            });
        }

        // Ensure subscription exists
        let sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
        if (!sub) {
            sub = await prisma.subscription.create({
                data: { userId: user.id, plan: 'Free', maxInstances: 1 }
            });
        }

        // Add credits to balance
        try {
            await prisma.subscription.update({
                where: { userId: user.id },
                data: { creditBalance: (sub.creditBalance || 0) + creditAmount }
            });
        } catch (e: any) {
            // Fallback if creditBalance column doesn't exist yet
            if (!e.message?.includes('creditBalance')) throw e;
            console.warn('[Creem] creditBalance column not available, skipping credit add');
        }

        // Log the transaction
        await prisma.creditTransaction.create({
            data: {
                userId: user.id,
                amount: creditAmount,
                type: 'topup',
                description: `Credit purchase: $${creditAmount} via Creem`
            }
        });

        // --- Order Tracking ---
        const checkoutId = data?.id || data?.checkout?.id;
        const requestId = data?.request_id;

        // Try to find a pending order from checkout time
        let pendingOrder = null;
        if (requestId) {
            pendingOrder = await prisma.order.findUnique({ where: { id: requestId } });
        }
        if (!pendingOrder && checkoutId) {
            pendingOrder = await prisma.order.findUnique({ where: { checkoutId } });
        }

        if (pendingOrder) {
            await prisma.order.update({
                where: { id: pendingOrder.id },
                data: {
                    status: 'completed',
                    checkoutId: checkoutId || pendingOrder.checkoutId,
                    amount: creditAmount || pendingOrder.amount,
                }
            });
        } else {
            await prisma.order.create({
                data: {
                    userId: user.id,
                    type: 'credit_topup',
                    status: 'completed',
                    amount: creditAmount,
                    planName: creditPack.planName,
                    productId: productId || undefined,
                    checkoutId: checkoutId || `credit_${user.id}_${Date.now()}`,
                    provider: 'creem',
                }
            });
        }

        console.log(`[Creem] Added $${creditAmount} credits for ${email}`);
    }
}
