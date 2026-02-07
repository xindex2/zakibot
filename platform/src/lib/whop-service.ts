import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class WhopService {
    /**
     * Verify Whop webhook signature
     */
    static verifySignature(payload: string, signature: string, secret: string) {
        if (!signature || !secret) return false;

        const hmac = crypto.createHmac('sha256', secret);
        const digest = hmac.update(payload).digest('hex');

        return signature === digest;
    }

    /**
     * Process Whop Webhook Event
     */
    static async handleEvent(event: any) {
        console.log(`[Whop] Processing event: ${event.action || event.type}`);

        let eventType = event.action || event.type;
        let data = event.data || event;

        // Log event to database
        await prisma.whopEvent.create({
            data: {
                eventType: String(eventType),
                whopUserId: data.user_id || data.customer_id || data.user?.id,
                email: data.email || data.user?.email,
                payload: JSON.stringify(event)
            }
        });

        switch (eventType) {
            case 'membership.activated':
            case 'membership_activated':
            case 'membership.updated':
            case 'membership_updated':
            case 'entry.approved':
            case 'entry_approved':
            case 'payment.succeeded':
            case 'payment_succeeded':
                await this.handleMembershipStatus(data, 'active');
                break;

            case 'membership.deactivated':
            case 'membership_deactivated':
            case 'membership.cancel.at.period.end.changed':
            case 'membership_cancel_at_period_end_changed':
            case 'payment.failed':
            case 'payment_failed':
            case 'refund.created':
            case 'refund_created':
            case 'dispute.created':
            case 'dispute_created':
                await this.handleMembershipStatus(data, 'deactivated');
                break;

            // Audit events - Logged to WhopEvent table automatically at start of handleEvent
            case 'invoice.created':
            case 'invoice_created':
            case 'invoice.paid':
            case 'invoice_paid':
            case 'invoice.past.due':
            case 'invoice_past_due':
            case 'invoice.voided':
            case 'invoice_voided':
            case 'entry.created':
            case 'entry_created':
            case 'entry.denied':
            case 'entry_denied':
            case 'entry.deleted':
            case 'entry_deleted':
            case 'setup.intent.requires.action':
            case 'setup_intent_requires_action':
            case 'setup.intent.succeeded':
            case 'setup_intent_succeeded':
            case 'setup.intent.canceled':
            case 'setup_intent_canceled':
            case 'withdrawal.created':
            case 'withdrawal_created':
            case 'withdrawal.updated':
            case 'withdrawal_updated':
            case 'course.lesson.interaction.completed':
            case 'course_lesson_interaction_completed':
            case 'payout.method.created':
            case 'payout_method_created':
            case 'verification.succeeded':
            case 'verification_succeeded':
            case 'payment.created':
            case 'payment_created':
            case 'payment.pending':
            case 'payment_pending':
            case 'dispute.updated':
            case 'dispute_updated':
            case 'refund.updated':
            case 'refund_updated':
                console.log(`[Whop] Audit event acknowledged: ${eventType}`);
                break;

            default:
                console.log(`[Whop] No specific handler for event: ${eventType}`);
        }
    }

    private static async handleMembershipStatus(data: any, status: string) {
        const whopUserId = data.user_id || data.customer_id || data.user?.id;
        const email = data.email || data.user?.email;
        const planId = data.plan_id;
        const membershipId = data.id;

        if (!email) {
            console.error('[Whop] Event missing email:', data);
            return;
        }

        // Find or create user
        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            console.log(`[Whop] Creating new user for ${email}`);
            user = await prisma.user.create({
                data: {
                    email,
                    password: crypto.randomBytes(16).toString('hex'), // Random password for SaaS users
                    whop_user_id: whopUserId,
                    acquisition_source: 'Whop'
                }
            });
        } else if (!user.whop_user_id) {
            await prisma.user.update({
                where: { id: user.id },
                data: { whop_user_id: whopUserId }
            });
        }

        // Map Whop plans to instances from DB
        const planConfig = await prisma.whopPlan.findUnique({
            where: { whopPlanId: planId }
        });

        const maxInstances = planConfig ? planConfig.maxInstances : 1;
        const planName = planConfig ? planConfig.planName : (planId === 'XXO2Ey0ki51AI' ? 'Elite' : (planId === '9NRNdPMrVzwi8' ? 'Pro' : 'Starter'));

        await prisma.subscription.upsert({
            where: { userId: user.id },
            update: {
                status,
                maxInstances,
                whopMembershipId: membershipId,
                whopPlanId: planId
            },
            create: {
                userId: user.id,
                status,
                maxInstances,
                whopMembershipId: membershipId,
                whopPlanId: planId,
                plan: planName
            }
        });

        console.log(`[Whop] Subscription ${status} for user ${user.id} (Plan: ${planId})`);
    }
}
