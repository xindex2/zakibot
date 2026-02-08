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

        console.log(`[Creem] ${status === 'active' ? 'Activated' : 'Deactivated'} subscription for ${email} (plan: ${planName})`);
    }
}
